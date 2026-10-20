"""Run learner code against assert tests; read JSON from stdin, write JSON to stdout."""
import io
import json
import signal
import sys
import time
from contextlib import redirect_stdout


class SandboxTimeout(Exception):
    pass


def raises(exc_type, fn, *args, **kwargs):
    """Return True if calling fn(*args, **kwargs) raises exc_type."""
    try:
        fn(*args, **kwargs)
    except exc_type:
        return True
    except Exception:
        return False
    return False


def _on_alarm(_signum, _frame):
    raise SandboxTimeout("execution exceeded time limit")


def _line_at(code: str, line_no: int | None) -> str:
    lines = code.splitlines() or [code]
    if line_no is None or line_no < 1 or line_no > len(lines):
        return lines[0] if lines else code
    return lines[line_no - 1]


def _syntax_check(code: str, label: str = "<user_code>") -> str | None:
    try:
        compile(code, label, "exec")
        return None
    except SyntaxError as exc:
        line_no = exc.lineno if exc.lineno is not None else 1
        line_text = _line_at(code, line_no)
        return f"SyntaxError: {exc.msg} (line {line_no}): {line_text}"


def _syntax_check_tests(tests: list) -> list[dict]:
    failures = []
    for index, test in enumerate(tests):
        err = _syntax_check(test, f"<test_{index + 1}>")
        if err:
            failures.append(
                {
                    "index": index,
                    "passed": False,
                    "stdout": "",
                    "error": f"Test {index + 1} is not valid Python: {err} — {test}",
                    "test": test,
                }
            )
    return failures


def _timeout_error(timeout_seconds: int, phase: str) -> str:
    return f"Code timed out after {timeout_seconds}s (possible infinite loop) during {phase}"


def _run_tests_in_namespace(namespace: dict, tests: list, timeout_seconds: int) -> list:
    results = []
    for index, test in enumerate(tests):
        signal.signal(signal.SIGALRM, _on_alarm)
        signal.alarm(timeout_seconds)
        buffer = io.StringIO()
        try:
            with redirect_stdout(buffer):
                exec(test, namespace)
            results.append(
                {
                    "index": index,
                    "passed": True,
                    "stdout": buffer.getvalue(),
                    "error": None,
                }
            )
        except SandboxTimeout:
            results.append(
                {
                    "index": index,
                    "passed": False,
                    "stdout": buffer.getvalue(),
                    "error": f"{_timeout_error(timeout_seconds, f'test {index + 1}')} — {test}",
                }
            )
            return results
        except SyntaxError as exc:
            line_no = exc.lineno if exc.lineno is not None else 1
            line_text = _line_at(test, line_no)
            results.append(
                {
                    "index": index,
                    "passed": False,
                    "stdout": buffer.getvalue(),
                    "error": f"SyntaxError: {exc.msg} (line {line_no}): {line_text}",
                }
            )
        except AssertionError as exc:
            results.append(
                {
                    "index": index,
                    "passed": False,
                    "stdout": buffer.getvalue(),
                    "error": str(exc) if str(exc) else f"AssertionError — {test}",
                }
            )
        except Exception as exc:
            results.append(
                {
                    "index": index,
                    "passed": False,
                    "stdout": buffer.getvalue(),
                    "error": f"{type(exc).__name__}: {exc} — {test}",
                }
            )
        finally:
            signal.alarm(0)
    return results


def main() -> None:
    started = time.perf_counter()
    setup_ms = 0
    tests_ms = 0

    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        json.dump(
            {"ok": False, "status": "invalid_input", "error": str(exc), "results": []},
            sys.stdout,
        )
        return

    code = payload.get("code", "")
    tests = payload.get("tests") or []
    timeout_seconds = int(payload.get("timeout_seconds") or 5)

    test_syntax_failures = _syntax_check_tests(tests)
    if test_syntax_failures:
        first = test_syntax_failures[0]
        json.dump(
            {
                "ok": False,
                "status": "test_syntax_error",
                "error": first["error"],
                "results": test_syntax_failures,
                "timings": {"setup_ms": 0, "tests_ms": 0, "total_ms": int((time.perf_counter() - started) * 1000)},
            },
            sys.stdout,
        )
        return

    syntax_error = _syntax_check(code)
    if syntax_error:
        json.dump(
            {
                "ok": False,
                "status": "syntax_error",
                "error": syntax_error,
                "results": [],
                "timings": {"setup_ms": 0, "tests_ms": 0, "total_ms": int((time.perf_counter() - started) * 1000)},
            },
            sys.stdout,
        )
        return

    namespace: dict = {"raises": raises}
    signal.signal(signal.SIGALRM, _on_alarm)
    signal.alarm(timeout_seconds)
    setup_buffer = io.StringIO()
    setup_started = time.perf_counter()
    try:
        with redirect_stdout(setup_buffer):
            exec(code, namespace)
    except SandboxTimeout:
        json.dump(
            {
                "ok": False,
                "status": "timeout",
                "error": _timeout_error(timeout_seconds, "user code setup"),
                "results": [],
                "timings": {
                    "setup_ms": int((time.perf_counter() - setup_started) * 1000),
                    "tests_ms": 0,
                    "total_ms": int((time.perf_counter() - started) * 1000),
                },
            },
            sys.stdout,
        )
        return
    except SyntaxError as exc:
        line_no = exc.lineno if exc.lineno is not None else 1
        line_text = _line_at(code, line_no)
        json.dump(
            {
                "ok": False,
                "status": "syntax_error",
                "error": f"SyntaxError: {exc.msg} (line {line_no}): {line_text}",
                "results": [],
                "timings": {
                    "setup_ms": int((time.perf_counter() - setup_started) * 1000),
                    "tests_ms": 0,
                    "total_ms": int((time.perf_counter() - started) * 1000),
                },
            },
            sys.stdout,
        )
        return
    except Exception as exc:
        json.dump(
            {
                "ok": False,
                "status": "completed",
                "error": f"{type(exc).__name__}: {exc}",
                "results": [],
                "timings": {
                    "setup_ms": int((time.perf_counter() - setup_started) * 1000),
                    "tests_ms": 0,
                    "total_ms": int((time.perf_counter() - started) * 1000),
                },
            },
            sys.stdout,
        )
        return
    finally:
        signal.alarm(0)

    setup_ms = int((time.perf_counter() - setup_started) * 1000)

    if not tests:
        json.dump(
            {
                "ok": True,
                "status": "completed",
                "error": None,
                "results": [],
                "timings": {
                    "setup_ms": setup_ms,
                    "tests_ms": 0,
                    "total_ms": int((time.perf_counter() - started) * 1000),
                },
            },
            sys.stdout,
        )
        return

    tests_started = time.perf_counter()
    results = _run_tests_in_namespace(namespace, tests, timeout_seconds)
    tests_ms = int((time.perf_counter() - tests_started) * 1000)

    timed_out = any(
        (r.get("error") or "").startswith("Code timed out after") for r in results
    )
    if timed_out:
        idx = next(
            i
            for i, r in enumerate(results)
            if (r.get("error") or "").startswith("Code timed out after")
        )
        json.dump(
            {
                "ok": False,
                "status": "timeout",
                "error": results[idx]["error"],
                "results": results,
                "timings": {
                    "setup_ms": setup_ms,
                    "tests_ms": tests_ms,
                    "total_ms": int((time.perf_counter() - started) * 1000),
                },
            },
            sys.stdout,
        )
        return

    all_passed = all(r["passed"] for r in results)
    json.dump(
        {
            "ok": all_passed,
            "status": "completed",
            "error": None if all_passed else "one or more tests failed",
            "results": results,
            "timings": {
                "setup_ms": setup_ms,
                "tests_ms": tests_ms,
                "total_ms": int((time.perf_counter() - started) * 1000),
            },
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()

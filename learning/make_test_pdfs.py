"""Printable pre/post tests from Context/assessment.md, via headless Chrome.

  python learning/make_test_pdfs.py   writes Context/tests/form-A.pdf, form-B.pdf, answer-key.pdf
  CHROME=<path to chrome> overrides the browser location."""

import html
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
CONTEXT = os.path.join(HERE, "..", "Context")
OUT = os.path.join(CONTEXT, "tests")
CHROME = os.environ.get("CHROME") or {
    "win32": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "darwin": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
}.get(sys.platform, "google-chrome")

STYLE = """
@page { size: letter; margin: 0.6in; }
body { font: 11pt/1.35 system-ui, 'Segoe UI', Roboto, sans-serif; color: #1b1d1f; margin: 0; }
h1 { font-size: 17pt; margin: 0 0 4pt; }
.fields { display: flex; gap: 24pt; margin: 12pt 0 8pt; }
.fields span { flex: 1; border-bottom: 1px solid #1b1d1f; padding-bottom: 2pt; }
.note { color: #5b6168; margin: 0 0 14pt; }
.q { break-inside: avoid; margin: 0 0 10pt; }
.q p { margin: 0 0 5pt; }
.q b { margin-right: 4pt; }
ul { list-style: none; margin: 0; padding: 0 0 0 18pt; }
li { margin: 2pt 0; }
.l { display: inline-block; width: 15pt; height: 15pt; line-height: 15pt; border: 1px solid #1b1d1f;
     border-radius: 50%; text-align: center; font-size: 9pt; margin-right: 8pt; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; border-bottom: 1px solid #d5d8dc; padding: 4pt 6pt; vertical-align: top; }
td:last-child { white-space: nowrap; }
.score { margin-top: 16pt; color: #5b6168; }
"""


def parse(text):
    forms = {}
    for item, prompt, body in re.findall(r"^\*\*([AB]\d+)\.\*\* (.+?)\n((?:- [A-D]\. .+\n?)+)", text, re.M):
        forms.setdefault(item[0], []).append((item, prompt, re.findall(r"^- ([A-D])\. (.+)$", body, re.M)))
    key = re.findall(r"^\| ([AB]\d+) \| ([A-D]) \| ([^|]+) \| ([^|]+) \|", text, re.M)
    return forms, key


def page(title, body):
    return f"<!doctype html><html lang='en'><meta charset='utf-8'><title>{title}</title><style>{STYLE}</style><body>{body}</body></html>"


def form_html(form, questions):
    qs = "".join(
        f"<div class='q'><p><b>{n}.</b>{html.escape(prompt)}</p><ul>"
        + "".join(f"<li><span class='l'>{letter}</span>{html.escape(choice)}</li>" for letter, choice in choices)
        + "</ul></div>"
        for n, (_, prompt, choices) in enumerate(questions, 1))
    return page(f"Form {form}", f"<h1>Clipcademy review study · Form {form}</h1>"
                f"<div class='fields'><span>Participant code:</span><span>Date:</span></div>"
                f"<p class='note'>{len(questions)} questions. Circle one letter for each. Don't use notes or your phone. "
                f"Your answers don't affect your grade.</p>{qs}"
                f"<p class='score'>Moderator only: score ______ / {len(questions)}</p>")


def key_html(key):
    rows = "".join(f"<tr><td>{i}</td><td><b>{a}</b></td><td>{html.escape(idea.strip())}</td><td>{html.escape(src.strip())}</td></tr>"
                   for i, a, idea, src in sorted(key, key=lambda r: (r[0][0], int(r[0][1:]))))
    return page("Answer key", "<h1>Clipcademy review study · Answer key</h1>"
                "<p class='note'>Moderator only. Don't show participants, and don't share scores or answers until after Day 2. "
                "One point per correct answer.</p>"
                f"<table><tr><th>Item</th><th>Answer</th><th>Idea tested</th><th>Source</th></tr>{rows}</table>")


def to_pdf(doc, name, tmp):
    src = os.path.join(tmp, name + ".html")
    with open(src, "w", encoding="utf-8") as f:
        f.write(doc)
    out = os.path.abspath(os.path.join(OUT, name + ".pdf"))
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={out}", "file:///" + src.replace("\\", "/")], check=True, capture_output=True)
    print("wrote", os.path.relpath(out, os.path.join(HERE, "..")))


def main():
    with open(os.path.join(CONTEXT, "assessment.md"), encoding="utf-8") as f:
        forms, key = parse(f.read())
    assert sorted(forms) == ["A", "B"] and len(forms["A"]) == len(forms["B"]) == len(key) // 2, "assessment.md format changed"
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for form, questions in sorted(forms.items()):
            to_pdf(form_html(form, questions), f"form-{form}", tmp)
        to_pdf(key_html(key), "answer-key", tmp)


if __name__ == "__main__":
    main()

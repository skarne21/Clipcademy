import { describe, expect, it } from "vitest";
import { formatSourceRef, formatSourceRefs } from "./sourceRefs";

describe("formatSourceRef", () => {
  it('formats "L19-p1" as "Lecture 19, p. 1"', () => {
    expect(formatSourceRef("L19-p1")).toBe("Lecture 19, p. 1");
  });

  it('formats "L22-p2" as "Lecture 22, p. 2"', () => {
    expect(formatSourceRef("L22-p2")).toBe("Lecture 22, p. 2");
  });

  it("returns an unmatched string unchanged", () => {
    expect(formatSourceRef("Appendix-A")).toBe("Appendix-A");
    expect(formatSourceRef("L19")).toBe("L19");
  });
});

describe("formatSourceRefs", () => {
  it("joins multiple formatted refs with semicolon and space", () => {
    expect(formatSourceRefs(["L19-p1", "L19-p2"])).toBe(
      "Lecture 19, p. 1; Lecture 19, p. 2",
    );
  });

  it("returns an empty string for an empty array", () => {
    expect(formatSourceRefs([])).toBe("");
  });
});

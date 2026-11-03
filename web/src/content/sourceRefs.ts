const LECTURE_PAGE_REF = /^L(\d+)-p(\d+)$/;

export function formatSourceRef(ref: string): string {
  const match = LECTURE_PAGE_REF.exec(ref);
  if (!match) {
    return ref;
  }
  return `Lecture ${match[1]}, p. ${match[2]}`;
}

export function formatSourceRefs(refs: string[]): string {
  return refs.map(formatSourceRef).join("; ");
}

// Like .trim(), but only strips leading/trailing newlines — leaves
// significant leading spaces on the first content line intact, which
// matters for ASCII art templates.
export function trimNl(s: string): string {
  return s.replace(/^\n+|\n+$/g, '');
}

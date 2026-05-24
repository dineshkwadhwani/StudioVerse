export function pluralize(label: string): string {
  if (!label) return label;
  const lower = label.toLowerCase();
  if (lower.endsWith("s") || lower.endsWith("x") || lower.endsWith("z") || lower.endsWith("ch") || lower.endsWith("sh")) {
    return lower.endsWith("s") ? label : `${label}es`;
  }
  if (/[^aeiou]y$/.test(lower)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

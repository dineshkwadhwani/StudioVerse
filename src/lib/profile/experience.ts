export function formatExperienceValue(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "";
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return normalized;
  }

  return parsed.toFixed(2);
}
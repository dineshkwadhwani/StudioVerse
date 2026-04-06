export const MASTER_SUPERADMIN = {
  fullName: "Dinesh Wadhwani",
  email: "thecoachdinesh@gmail.com",
  phoneLocal: "9767676738",
};

export function normalizePhone(phoneInput: string): string {
  const trimmed = phoneInput.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length > 10 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export const MASTER_SUPERADMIN_PHONE_E164 = normalizePhone(
  MASTER_SUPERADMIN.phoneLocal
);

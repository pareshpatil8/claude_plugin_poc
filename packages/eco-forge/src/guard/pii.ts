/**
 * Detects real Indian PII before it reaches the model (DPDP). Tuned to minimise false positives:
 * Aadhaar is confirmed with the Verhoeff checksum, PAN with its fixed letter/digit layout, so
 * synthetic fixtures that are deliberately invalid (and ordinary 12-digit numbers) pass through.
 */

export interface PiiFinding {
  readonly kind: "aadhaar" | "pan" | "phone" | "email" | "bulk";
  readonly sample: string;
}

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function isValidAadhaar(digits: string): boolean {
  if (!/^\d{12}$/.test(digits) || digits[0] === "0" || digits[0] === "1") {
    return false;
  }
  let c = 0;
  const reversed = digits.split("").reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    const row = VERHOEFF_D[c] ?? [];
    const permuted = (VERHOEFF_P[i % 8] ?? [])[reversed[i] as number] ?? 0;
    c = row[permuted] ?? 0;
  }
  return c === 0;
}

function isValidPan(value: string): boolean {
  // AAAAA9999A: 5 letters, 4 digits, 1 letter; 4th char is the holder type.
  return /^[A-Z]{3}[ABCFGHLJPTK][A-Z]\d{4}[A-Z]$/.test(value);
}

const PATTERNS = {
  aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
  pan: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
  // +91 then a 10-digit number that may be split by one space/hyphen; or a bare 10-digit mobile.
  phone: /\+91[-\s]?[6-9]\d{4}[-\s]?\d{5}\b|\b[6-9]\d{9}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
};

// Domains that are safe by convention (RFC 2606 / test fixtures), so they never count as PII.
const SAFE_EMAIL = /@(example\.(com|org|net|test)|.*\.example|test|localhost|invalid)$/i;
const BULK_THRESHOLD = 10;

export function scanForPii(text: string): PiiFinding[] {
  const findings: PiiFinding[] = [];
  const emails = new Set<string>();

  for (const match of text.matchAll(PATTERNS.aadhaar)) {
    const digits = match[0].replace(/\s/g, "");
    if (isValidAadhaar(digits)) {
      findings.push({ kind: "aadhaar", sample: redact(match[0]) });
    }
  }
  for (const match of text.matchAll(PATTERNS.pan)) {
    if (isValidPan(match[0])) {
      findings.push({ kind: "pan", sample: redact(match[0]) });
    }
  }
  for (const match of text.matchAll(PATTERNS.email)) {
    if (!SAFE_EMAIL.test(match[0])) {
      emails.add(match[0].toLowerCase());
      findings.push({ kind: "email", sample: redact(match[0]) });
    }
  }
  for (const match of text.matchAll(PATTERNS.phone)) {
    const digits = match[0].replace(/\D/g, "").slice(-10);
    // Ten identical/sequential digits are almost always placeholders, not real numbers.
    if (!/^(\d)\1{9}$/.test(digits) && digits !== "1234567890") {
      findings.push({ kind: "phone", sample: redact(match[0]) });
    }
  }

  // A dump of many distinct emails is a data export even if each one is individually plausible.
  if (emails.size >= BULK_THRESHOLD) {
    findings.unshift({ kind: "bulk", sample: `${emails.size} distinct email addresses` });
  }
  return dedupe(findings);
}

function redact(value: string): string {
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return `${(local as string).slice(0, 2)}***@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  return `${value.slice(0, 2)}***${digits.slice(-2)}`;
}

function dedupe(findings: PiiFinding[]): PiiFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.kind}:${f.sample}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

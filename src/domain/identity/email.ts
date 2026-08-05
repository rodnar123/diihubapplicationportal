/**
 * Institutional email rules.
 *
 * The portal is closed to the public: only official PNGUoT addresses may hold
 * an account. These helpers are pure so that the identical rule can run in the
 * browser (instant feedback), in a Server Action (authoritative check), and in
 * the auth callback (last line of defence before a session is minted).
 */

/** Canonical student mailbox domain, e.g. 25530061jose@student.pnguot.ac.pg */
export const DEFAULT_STUDENT_DOMAIN = "student.pnguot.ac.pg";

/** Staff / faculty mailbox domain used by challenge administrators. */
export const DEFAULT_STAFF_DOMAIN = "pnguot.ac.pg";

/**
 * The exact wording the specification requires when a non-institutional
 * address is used.
 */
export const INVALID_EMAIL_DOMAIN_MESSAGE =
  "Only official PNG University of Technology student email accounts are permitted.";

/**
 * Common consumer providers, listed purely so the UI can give a more specific
 * hint. Rejection is allowlist-based, never blocklist-based.
 */
const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "zoho.com",
  "yandex.com",
]);

/** Shape of an address the portal accepts. Deliberately conservative. */
const EMAIL_SHAPE = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9.-]+\.[a-z]{2,}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  return at === -1 ? "" : normalized.slice(at + 1);
}

export function localPart(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  return at === -1 ? normalized : normalized.slice(0, at);
}

export function hasValidEmailShape(email: string): boolean {
  return EMAIL_SHAPE.test(normalizeEmail(email));
}

export function isConsumerEmail(email: string): boolean {
  return CONSUMER_DOMAINS.has(emailDomain(email));
}

export function isStudentEmail(email: string, studentDomain = DEFAULT_STUDENT_DOMAIN): boolean {
  return hasValidEmailShape(email) && emailDomain(email) === studentDomain.toLowerCase();
}

export function isStaffEmail(email: string, staffDomain = DEFAULT_STAFF_DOMAIN): boolean {
  return hasValidEmailShape(email) && emailDomain(email) === staffDomain.toLowerCase();
}

export type EmailPolicyResult =
  | { ok: true; kind: "student" | "staff"; email: string }
  | { ok: false; message: string; email: string };

/**
 * The single authority on whether an address may sign in.
 *
 * `allowStaff` is false on the student-facing sign-in form and true in the
 * auth callback, where a staff address must be able to reach the admin
 * console.
 */
export function evaluateEmailPolicy(
  rawEmail: string,
  options: {
    studentDomain?: string;
    staffDomain?: string;
    allowStaff?: boolean;
  } = {},
): EmailPolicyResult {
  const {
    studentDomain = DEFAULT_STUDENT_DOMAIN,
    staffDomain = DEFAULT_STAFF_DOMAIN,
    allowStaff = true,
  } = options;

  const email = normalizeEmail(rawEmail);

  if (!email) {
    return { ok: false, message: "Enter your university email address.", email };
  }

  if (!hasValidEmailShape(email)) {
    return { ok: false, message: "Enter a valid email address.", email };
  }

  if (isStudentEmail(email, studentDomain)) {
    return { ok: true, kind: "student", email };
  }

  if (allowStaff && isStaffEmail(email, staffDomain)) {
    return { ok: true, kind: "staff", email };
  }

  return { ok: false, message: INVALID_EMAIL_DOMAIN_MESSAGE, email };
}

/**
 * PNGUoT student numbers are all-digit, e.g. "25530061".
 */
export const STUDENT_ID_PATTERN = /^\d{6,10}$/;

export function isValidStudentId(value: string): boolean {
  return STUDENT_ID_PATTERN.test(value.trim());
}

/**
 * Student mailboxes are formed as `<studentId><givenName>@student.pnguot.ac.pg`
 * (e.g. `25530061jose@…`), so the number can be recovered from the address and
 * offered as a pre-filled default. Returns null when the local part does not
 * follow the convention — the student then types it themselves.
 */
export function studentIdFromEmail(email: string): string | null {
  const match = /^(\d{6,10})[a-z][a-z0-9._-]*$/.exec(localPart(email));
  return match ? match[1] : null;
}

/**
 * Best-effort given name from the mailbox, used only to pre-fill the profile
 * form; the student always confirms it.
 */
export function givenNameFromEmail(email: string): string | null {
  const match = /^\d{6,10}([a-z]+)/.exec(localPart(email));
  if (!match) return null;
  const name = match[1];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

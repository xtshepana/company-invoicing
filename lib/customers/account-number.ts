/**
 * The customer account number ("customer_reference"): system-generated as 3 letters from the company name plus a
 * sequential number, e.g. ABC001 (see supabase/migrations/0028 and 0039). It is also the "Payment Reference" printed on
 * invoices, so customers quote it on their bank payments - which is why bank matching uses it (see
 * server/services/bank-transactions.ts) and why it must never be changed or reused.
 */
export const ACCOUNT_NUMBER_PATTERN = /^[A-Z]{3}[0-9]{3,}$/;

/** How a customer is shown wherever staff pick one: the name plus the account number, so similarly named customers can't be mixed up. */
export function customerOptionLabel(customer: { company_name: string; customer_reference?: string | null }): string {
  return customer.customer_reference ? `${customer.company_name} (${customer.customer_reference})` : customer.company_name;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Which of the given account numbers appear in `text` (a bank description / reference) as a whole token, ignoring case.
 * "BAL007" is found in "PAYMENT BAL007 OCT" and "ref:bal007", but not in "BAL0071" or "XBAL007".
 */
export function findQuotedAccountNumbers(text: string, references: readonly string[]): Set<string> {
  const upper = text.toUpperCase();
  const found = new Set<string>();
  for (const reference of references) {
    if (!reference) continue;
    if (new RegExp(`(^|[^A-Z0-9])${escapeRegExp(reference.toUpperCase())}([^A-Z0-9]|$)`).test(upper)) found.add(reference);
  }
  return found;
}

const COMPANY_SUFFIX_WORDS = new Set(["pty", "ltd", "cc", "inc", "co", "the", "and"]);

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

/** The words of a company name that say something about who it is: 3+ letters, not a generic company suffix. */
export function significantNameWords(companyName: string): string[] {
  return normalizeForMatch(companyName)
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !COMPANY_SUFFIX_WORDS.has(word));
}

/**
 * Words that appear in the names of several customers ("attorneys" in a firm whose clients are mostly attorneys) and
 * therefore identify none of them. A bank line containing such a word must not count as a name match for all of them.
 */
export function genericNameWords(companyNames: readonly string[], minCustomers = 5): Set<string> {
  const counts = new Map<string, number>();
  for (const name of companyNames) {
    for (const word of new Set(significantNameWords(name))) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count >= minCustomers).map(([word]) => word));
}

/**
 * Does any distinguishing word of the customer's name show up in the bank line's free text? Generic words (see
 * genericNameWords) are ignored, so a customer whose name is only generic words can only be identified by its account
 * number or amount.
 */
export function nameAppearsIn(companyName: string, haystack: string, generic: ReadonlySet<string> = new Set()): boolean {
  const words = significantNameWords(companyName).filter((word) => !generic.has(word));
  if (words.length === 0) return false;
  const normalizedHaystack = normalizeForMatch(haystack);
  return words.some((word) => normalizedHaystack.includes(word));
}

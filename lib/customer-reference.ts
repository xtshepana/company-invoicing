/** First 3 letters of the company name (uppercased, non-letters stripped, padded with X if too short) + a random 5-digit number, e.g. "ABC48213". */
export function generateCustomerReferenceCandidate(companyName: string): string {
  const letters = companyName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .padEnd(3, "X")
    .slice(0, 3);
  const digits = Math.floor(10000 + Math.random() * 90000);
  return `${letters}${digits}`;
}

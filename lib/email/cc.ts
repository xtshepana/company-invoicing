/**
 * The CC to actually put on an outgoing email: nothing when no address is
 * configured, and nothing when it's the same mailbox as the recipient
 * (a customer whose email is the accounts address would otherwise get two
 * copies, and some providers reject a duplicated address outright).
 */
export function resolveCc(to: string, cc: string | null | undefined): string | undefined {
  const address = cc?.trim();
  if (!address) return undefined;
  if (address.toLowerCase() === to.trim().toLowerCase()) return undefined;
  return address;
}

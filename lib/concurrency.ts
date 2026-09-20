/**
 * Runs `fn` over `items` with at most `limit` in flight at once, preserving
 * result order. Used where full sequential processing risks a timeout
 * (e.g. the daily cron's 60s budget) but full unbounded parallelism risks
 * overloading something else (a third-party API's rate limit, too many
 * simultaneous connections).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

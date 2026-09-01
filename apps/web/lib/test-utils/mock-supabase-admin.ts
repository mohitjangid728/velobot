/**
 * Minimal fake for the subset of the supabase-js query builder these tests
 * exercise: chained `.eq()`/`.select()` calls that eventually resolve (the
 * real builder is a PromiseLike, not a plain object — every chain method
 * here returns `this` so the chain reads identically to production code,
 * and `.then` makes `await` resolve to the configured result).
 */
export function makeQueryResult<T>(result: { data?: T; error?: unknown; count?: number | null }) {
  const chain: Record<string, unknown> = {
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    select: () => chain,
    single: () => chain,
    maybeSingle: () => chain,
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return chain;
}

/** `table -> query result` map; `.from(table)` returns whatever was configured for that table, in call order if an array was given. */
export function makeMockAdminClient(resultsByTable: Record<string, ReturnType<typeof makeQueryResult> | ReturnType<typeof makeQueryResult>[]>) {
  const callCounts: Record<string, number> = {};
  return {
    from(table: string) {
      const configured = resultsByTable[table];
      if (Array.isArray(configured)) {
        const i = callCounts[table] ?? 0;
        callCounts[table] = i + 1;
        return configured[Math.min(i, configured.length - 1)];
      }
      return configured;
    },
  };
}

/**
 * Runs async work with at most `limit` jobs at once and a bounded waiting line: when the line is full, new work
 * is dropped (and reported) instead of piling up in memory. For best-effort background work only.
 */
export function createConcurrencyLimit(limit: number, maxWaiting: number) {
  let running = 0;
  const waiting: Array<() => void> = [];

  const next = () => {
    if (running >= limit) return;
    const start = waiting.shift();
    if (start) start();
  };

  return {
    /** Resolves when the job has run; returns false (without running it) if the waiting line was full. */
    run(job: () => Promise<unknown>): Promise<boolean> {
      if (running >= limit && waiting.length >= maxWaiting) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        const start = () => {
          running++;
          void job()
            .catch(() => undefined)
            .finally(() => {
              running--;
              resolve(true);
              next();
            });
        };
        if (running < limit) start();
        else waiting.push(start);
      });
    },
    stats: () => ({ running, waiting: waiting.length }),
  };
}

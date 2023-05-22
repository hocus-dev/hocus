import { Context } from "@temporalio/activity";

export const runActivityHeartbeat = <T>(
  options: {
    /** Default: 5000 */
    intervalMs?: number;
  },
  fn: () => Promise<T>,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      Context.current().heartbeat();
    }, options.intervalMs ?? 5000);

    fn()
      .then((result) => {
        clearInterval(interval);
        resolve(result);
      })
      .catch((err) => {
        clearInterval(interval);
        reject(err);
      });
  });
};

export const withActivityHeartbeat = <T, Args extends unknown[]>(
  options: {
    /** Default: 5000 */
    intervalMs?: number;
  },
  fn: (...args: Args) => Promise<T>,
): ((...args: Args) => Promise<T>) => {
  return (...args: Args) => {
    return runActivityHeartbeat(options, () => fn(...args));
  };
};

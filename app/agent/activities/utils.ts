import { Context } from "@temporalio/activity";

export const runActivityHeartbeat = <T>(
  options: {
    /** Default: 5000 */
    intervalMs?: number;
  },
  fn: (...args: any[]) => Promise<T>,
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

export const withActivityHeartbeat = <T>(
  ...args: Parameters<typeof runActivityHeartbeat<T>>
): (() => Promise<T>) => {
  return () => runActivityHeartbeat(...args);
};

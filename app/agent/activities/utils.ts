import { Context } from "@temporalio/activity";

export const withActivityHeartbeat = <T>(
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
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      })
      .finally(() => clearInterval(interval));
  });
};

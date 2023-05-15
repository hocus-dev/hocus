import { Context } from "@temporalio/activity";

export const runActivityHeartbeat = <T>(
  options: {
    /** Default: 5000 */
    intervalMs?: number;
  },
  fn: () => Promise<T>,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    let progress = 0;
    const interval = setInterval(() => {
      Context.current().heartbeat(progress);
      progress += options.intervalMs ?? 5000;
    }, options.intervalMs ?? 5000);

    Context.current()
      .cancelled.then(() => console.log("wtf"))
      .catch((err) => {
        console.log("activity got cancelled", err);
      });
    console.log("yo!");

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

export const withActivityHeartbeat = <T, Args>(
  options: {
    /** Default: 5000 */
    intervalMs?: number;
  },
  fn: (args: Args) => Promise<T>,
): ((args: Args) => Promise<T>) => {
  return (args: Args) => {
    return runActivityHeartbeat(options, () => fn(args));
  };
};

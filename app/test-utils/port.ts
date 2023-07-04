import portfinder from "portfinder";

export const withFreePort = <T>(fn: (port: number) => Promise<T>): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    portfinder.getPort(async (err, port) => {
      if (err != null) {
        reject(err);
      }
      try {
        const result = await fn(port);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
};

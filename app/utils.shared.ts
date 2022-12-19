import { GroupError } from "./group-error";

export const unwrap = <T>(value: T | undefined | null): T => {
  if (value === undefined || value === null) {
    throw new Error(`Value is ${value}`);
  }
  return value;
};

export const mapenum =
  <K extends string | number | symbol>() =>
  <V, T extends Record<K, V>>(map: T): { [key in K]: T[key] } =>
    map;

/**
 * Removes the traling slash from a url.
 */
export const removeTrailingSlash = (url: string): string => {
  if (url.slice(-1) === "/") {
    return url.slice(0, -1);
  }
  return url;
};

/**
 * Works like `Promise.allSettled` but throws an error if any of the promises fail.
 */
export const waitForPromises = async <T>(promises: Iterable<T>): Promise<Awaited<T>[]> => {
  const results = await Promise.allSettled(promises);
  const errors = results
    .filter((result) => result.status === "rejected")
    .map((result) => {
      const reason = (result as PromiseRejectedResult).reason;
      if (reason instanceof Error) {
        return reason;
      }
      if (typeof reason === "string") {
        return new Error(reason);
      }
      return new Error("unknown error");
    });
  if (errors.length > 0) {
    throw new GroupError(errors);
  }

  return results.map((result) => (result as PromiseFulfilledResult<Awaited<T>>).value);
};

export const displayError = (err: unknown): string => {
  if (err instanceof Error) {
    return `${err.message}\nStack: ${err.stack}`;
  }
  return String(err);
};

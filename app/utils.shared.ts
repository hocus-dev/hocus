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
      return new Error(String(reason));
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

type NumericType = bigint | number;
export const numericSort = (a: NumericType, b: NumericType): number => {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
};

export const numericOrNullSort = (a: NumericType | null, b: NumericType | null): number => {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return -1;
  }
  if (b === null) {
    return 1;
  }
  return numericSort(a, b);
};

export const mapOverNull = <T, U>(
  values: (T | null | undefined)[],
  fn: (value: T, idx: number) => U,
): (U | null)[] => {
  return values.map((value, idx) => (value == null ? null : fn(value, idx)));
};

export const filterNull = <T>(values: (T | null | undefined)[]): T[] => {
  return values.filter((value) => value != null) as T[];
};

export const makeMap = <T, K>(values: T[], fn: (value: T) => K): Map<K, T> => {
  return new Map(values.map((value) => [fn(value), value]));
};

export const groupBy = <T, K, V>(
  arr: Iterable<T>,
  getKey: (x: T) => K,
  getItem: (x: T) => V,
): Map<K, V[]> => {
  const map = new Map<K, V[]>();
  for (const item of arr) {
    const key = getKey(item);
    const value = getItem(item);
    const existing = map.get(key);
    if (existing == null) {
      map.set(key, [value]);
    } else {
      existing.push(value);
    }
  }
  return map;
};

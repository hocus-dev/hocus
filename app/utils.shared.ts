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

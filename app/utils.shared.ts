export const unwrap = <T>(value: T | undefined | null): T => {
  if (value === undefined || value === null) {
    throw new Error(`Value is ${value}`);
  }
  return value;
};

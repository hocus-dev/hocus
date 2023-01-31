import { translateIntoHttpError } from "./http-error.server";

export const handleRouteErrors = <T, U, Y extends U[]>(
  fn: (...args: Y) => Promise<T>,
): ((...args: Y) => Promise<T>) => {
  return async (...args: Y) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw translateIntoHttpError(error);
    }
  };
};

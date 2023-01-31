import { Response } from "@remix-run/node";
import type { StatusCodes } from "http-status-codes";
import { getReasonPhrase } from "http-status-codes";

import { ValidationError } from "./schema/utils.server";

export class HttpError extends Response {
  constructor(status: StatusCodes, message?: string) {
    super(void 0, {
      status,
      statusText: message ?? getReasonPhrase(status),
    });
  }
}

export const translateIntoHttpError = (error: unknown): HttpError => {
  if (error instanceof HttpError) {
    return error;
  }
  if (error instanceof ValidationError) {
    const messages = error.errors.map((err) => err.message);
    return new HttpError(400, messages.join(",\n"));
  }
  if (error instanceof Response) {
    return new HttpError(error.status, error.statusText);
  }
  return new HttpError(500, "Internal Server Error");
};

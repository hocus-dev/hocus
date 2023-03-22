import { Type as t } from "@sinclair/typebox";

export const LicenseSchema = t.Object({
  sub: t.String({ minLength: 1 }),
  iat: t.Number({ minimum: 1 }),
  numSeats: t.Number({ minimum: 1 }),
  /// Unix timestamp in milliseconds
  validUntil: t.Number({ minimum: 0 }),
});

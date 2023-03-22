import jwt from "jsonwebtoken";
import type { Logger } from "winston";
import type { Config } from "~/config";
import type { License } from "~/schema/license.validator.server";
import { LicenseValidator } from "~/schema/license.validator.server";
import { Token } from "~/token";

class UserMessageError extends Error {}

export class LicenseService {
  static inject = [Token.Config, Token.Logger] as const;
  public readonly numSeats: number;
  constructor(config: Config, private readonly logger: Logger) {
    this.numSeats = 3;
    const { license: licenseText, licensePublicKey } = config.controlPlane();
    const license = (() => {
      try {
        return LicenseService.parseLicense(licensePublicKey, licenseText, new Date());
      } catch (err) {
        if (err instanceof UserMessageError) {
          this.logger.warn(`Invalid license: ${err.message}`);
        } else {
          throw err;
        }
      }
    })();
    if (license == null) {
      return;
    }
    const validUntil = new Date(license.validUntil).toISOString();
    this.logger.info(
      `License loaded. Number of seats: ${license.numSeats}. Valid until: ${validUntil}`,
    );
  }

  static parseLicense(
    publicKey: string,
    licenseText: string | undefined,
    now: Date,
  ): License | undefined {
    if (licenseText == null) {
      return void 0;
    }
    const licenseContent = (() => {
      try {
        return jwt.verify(licenseText, publicKey, { algorithms: ["ES256"] });
      } catch (err) {
        throw new UserMessageError((err as any)?.message ?? "Could not verify license");
      }
    })();
    const { success, error, value: license } = LicenseValidator.SafeParse(licenseContent);
    if (!success) {
      throw new UserMessageError(error.message);
    }
    const validUntil = new Date(license.validUntil);
    if (validUntil.getTime() < now.getTime()) {
      throw new UserMessageError(`Expired at ${validUntil}`);
    }
    return license;
  }
}

import { stubInterface } from "ts-sinon";
import type { Logger } from "winston";
import { createAppInjector } from "~/app-injector.server";
import { Token } from "~/token";

import { DEFAULT_SEATS_LIMIT } from "./constants";
import { LicenseService } from "./license.service";

// https://github.com/auth0/node-jsonwebtoken/issues/862#issue-1506802337
const TEST_LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEVm2WL3lUtRZH120SxymJCWqHJVwj
64sz0fpxKRXOy/Qy4fzlq6/zqbYpObeWj4MmRd8aV+75AwGOPWPV+Gq18w==
-----END PUBLIC KEY-----`;
const _TEST_LICENSE_PRIVATE_KEY = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIEDA51WfRdReySfYiQxlW1RHDqI4O3yAg6jsVAmU/v/hoAoGCCqGSM49
AwEHoUQDQgAEVm2WL3lUtRZH120SxymJCWqHJVwj64sz0fpxKRXOy/Qy4fzlq6/z
qbYpObeWj4MmRd8aV+75AwGOPWPV+Gq18w==
-----END EC PRIVATE KEY-----`;
const VALID_LICENSE_TEXT =
  "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYmMiLCJudW1TZWF0cyI6MTUsInZhbGlkVW50aWwiOjE2Nzk1MDU0NTg0NjAsImlhdCI6MTY3OTUwNTQ2Mn0.WuSd7CrYKc5YjedoUPmy7EHkWt5uPx5dvNp61IMDWbPq7d3pgPBhBayesy5dE_QwubHAhlGlCbCgXIfQezTF2g";

test("parseLicense", () => {
  const pastDate = new Date("2020-01-01");
  expect(LicenseService.parseLicense(TEST_LICENSE_PUBLIC_KEY, undefined, pastDate)).toBeUndefined();
  expect(() =>
    LicenseService.parseLicense(TEST_LICENSE_PUBLIC_KEY, "invalid", pastDate),
  ).toThrowError("jwt malformed");
  expect(() =>
    LicenseService.parseLicense(
      TEST_LICENSE_PUBLIC_KEY,
      "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ4ZCI6MywiaWF0IjoxNjc5NTA1Mjk4fQ.nPKk1QNDzgDWrh2OHaaUxLpMJH0QVicDkKu_KWUNvcK1mSsLotRWpwSw8kSJS4bInOcPdIhg7PhseLTVokcQGw",
      pastDate,
    ),
  ).toThrowError(/Expected required property/);
  const validLicense = LicenseService.parseLicense(
    TEST_LICENSE_PUBLIC_KEY,
    VALID_LICENSE_TEXT,
    pastDate,
  );
  expect(validLicense).toEqual({
    sub: "abc",
    validUntil: 1679505458460,
    numSeats: 15,
    iat: 1679505462,
  });
  expect(() =>
    LicenseService.parseLicense(
      TEST_LICENSE_PUBLIC_KEY,
      VALID_LICENSE_TEXT,
      new Date("2024-01-01"),
    ),
  ).toThrowError(/Expired at/);
});

test("LicenseService constructor", () => {
  const pastDate = new Date("2020-01-01");
  const defaultInjector = createAppInjector();
  const config = defaultInjector.resolve(Token.Config);
  const createTestInjector = (license: string | undefined) =>
    createAppInjector({
      [Token.Config]: {
        ...config,
        controlPlane: () => ({
          ...config.controlPlane(),
          license,
          licensePublicKey: TEST_LICENSE_PUBLIC_KEY,
        }),
      },
      [Token.TimeService]: class {
        now() {
          return pastDate;
        }
      },
      [Token.Logger]: stubInterface<Logger>(),
    });
  const testInjector1 = createTestInjector(undefined);
  expect(testInjector1.resolve(Token.LicenseService).numSeats).toEqual(DEFAULT_SEATS_LIMIT);
  const testInjector2 = createTestInjector(VALID_LICENSE_TEXT);
  expect(testInjector2.resolve(Token.LicenseService).numSeats).toEqual(15);
  const testInjector3 = createTestInjector("invalid");
  expect(testInjector3.resolve(Token.LicenseService).numSeats).toEqual(DEFAULT_SEATS_LIMIT);
});

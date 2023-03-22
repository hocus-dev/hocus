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
  const validLicenseText =
    "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYmMiLCJudW1TZWF0cyI6MTUsInZhbGlkVW50aWwiOjE2Nzk1MDU0NTg0NjAsImlhdCI6MTY3OTUwNTQ2Mn0.WuSd7CrYKc5YjedoUPmy7EHkWt5uPx5dvNp61IMDWbPq7d3pgPBhBayesy5dE_QwubHAhlGlCbCgXIfQezTF2g";
  const validLicense = LicenseService.parseLicense(
    TEST_LICENSE_PUBLIC_KEY,
    validLicenseText,
    pastDate,
  );
  expect(validLicense).toEqual({
    sub: "abc",
    validUntil: 1679505458460,
    numSeats: 15,
    iat: 1679505462,
  });
  expect(() =>
    LicenseService.parseLicense(TEST_LICENSE_PUBLIC_KEY, validLicenseText, new Date("2024-01-01")),
  ).toThrowError(/Expired at/);
});

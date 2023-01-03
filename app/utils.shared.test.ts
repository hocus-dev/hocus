import { bigintOrNullSort } from "./utils.shared";

test("bigintOrNullSort", () => {
  const testCase = [BigInt(4), BigInt(2), null, BigInt(3), null, BigInt(-1)];
  const expected = [null, null, BigInt(-1), BigInt(2), BigInt(3), BigInt(4)];
  expect(testCase.sort(bigintOrNullSort)).toEqual(expected);
});

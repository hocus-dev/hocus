import { NonnegativeIntegerValidator } from "./nonnegative-integer.validator.server";

test("NonnegativeInteger", () => {
  for (let i = -10; i < 10; i++) {
    const { success } = NonnegativeIntegerValidator.SafeParse(i.toString());
    expect(success).toBe(i >= 0);
  }
  NonnegativeIntegerValidator.Parse("4098");
});

import { RemoteInfoTupleValidator } from "./validator";

test.concurrent("RemoteInfoTuple", () => {
  expect(RemoteInfoTupleValidator.SafeParse(["a", "b"]).success).toBe(true);
  expect(RemoteInfoTupleValidator.SafeParse(["", "b"]).success).toBe(false);
  expect(RemoteInfoTupleValidator.SafeParse(["a", "b", "c"]).success).toBe(false);
});

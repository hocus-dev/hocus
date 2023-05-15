import type { CreateActivity } from "../types";

export type CancellationTestActivity = (result: string) => Promise<string>;
export const cancellationTest: CreateActivity<CancellationTestActivity> = () => async (result) => {
  return result;
};

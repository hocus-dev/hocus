import type { CreateActivity } from "../types";

export type MutexTestActivity = () => Promise<number>;
export const mutexTest: CreateActivity<MutexTestActivity> = () => async () => {
  return 0;
};

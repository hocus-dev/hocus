import type { valueof } from "~/types/utils";

export type FifoFlags = valueof<typeof FifoFlags>;
export const FifoFlags = {
  /** taken from https://pkg.go.dev/syscall#O_RDONLY */
  O_RDONLY: 0,
  /** taken from https://pkg.go.dev/syscall#O_NONBLOCK */
  O_NONBLOCK: 2048,
} as const;

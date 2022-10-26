import type { SpawnSyncReturns } from "child_process";
import { spawnSync } from "child_process";

export const execCmd = (...args: string[]): SpawnSyncReturns<Buffer> => {
  const output = args.length > 1 ? spawnSync(args[0], args.slice(1)) : spawnSync(args[0]);
  if (output.status !== 0) {
    throw new Error(
      `Command "${args.join(" ")}" failed with status ${output.status}, error name: "${
        output.error?.name
      }", error message: "${output.error?.message}", and output:\n${output.output?.toString()}`,
    );
  }
  return output;
};

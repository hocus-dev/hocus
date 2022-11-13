import type { valueof } from "~/types/utils";

export const PREBUILD_SCRIPT_TEMPLATE = `#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset
set -o xtrace

`;

export type PrebuildTaskStatus = valueof<typeof PrebuildTaskStatus>;
export const PrebuildTaskStatus = {
  Ok: "ok",
  Error: "error",
  Cancelled: "cancelled",
} as const;

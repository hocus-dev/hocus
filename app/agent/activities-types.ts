import type { ProjectConfig } from "./project-config/validator";

import type { ValidationError } from "~/schema/utils.server";

export type CheckoutAndInspectResult =
  | {
      projectConfig: ProjectConfig;
      imageFileHash: string | null;
    }
  | null
  | ValidationError;

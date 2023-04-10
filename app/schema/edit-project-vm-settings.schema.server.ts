import { Type as t } from "@sinclair/typebox";

import { NonnegativeIntegerSchema } from "./nonnegative-integer.schema.server";
import { UuidSchema } from "./uuid.schema.server";

export const EditProjectVmSettingsSchema = t.Object({
  projectExternalId: UuidSchema,
  maxPrebuildRamMib: t.Optional(NonnegativeIntegerSchema),
  maxPrebuildVCPUCount: t.Optional(NonnegativeIntegerSchema),
  maxWorkspaceRamMib: t.Optional(NonnegativeIntegerSchema),
  maxWorkspaceVCPUCount: t.Optional(NonnegativeIntegerSchema),
  maxWorkspaceProjectDriveSizeMib: t.Optional(NonnegativeIntegerSchema),
  maxWorkspaceRootDriveSizeMib: t.Optional(NonnegativeIntegerSchema),
  maxPrebuildRootDriveSizeMib: t.Optional(NonnegativeIntegerSchema),
});

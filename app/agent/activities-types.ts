import type { ProjectConfig } from "./project-config/validator";

export type CheckoutAndInspectResult = {
  projectConfig: ProjectConfig;
  imageFileHash: string | null;
} | null;

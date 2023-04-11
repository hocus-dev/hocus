import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { StatusCodes } from "http-status-codes";
import { ProjectPage } from "~/components/projects/project-page";
import { SettingsTab, VmSettingsField, VmSettingsFields } from "~/components/projects/settings-tab";
import { HttpError } from "~/http-error.server";
import { ProjectPathTabId } from "~/page-paths.shared";
import { EditProjectVmSettingsValidator } from "~/schema/edit-project-vm-settings.validator.server";
import { Token } from "~/token";

export const loader = async ({ context: { db, req, app } }: LoaderArgs) => {
  const projectService = app.resolve(Token.ProjectService);
  const maxRepositoryDriveSizeMib = app.resolve(Token.Config).shared().maxRepositoryDriveSizeMib;
  const { projectPageProps, project } = await projectService.getProjectFromRequest(db, req);
  const vmSettings = Object.fromEntries(
    Array.from(Object.values(VmSettingsField)).map((field) => [field, project[field]] as const),
  ) as Record<VmSettingsField, number>;
  return json({
    ...projectPageProps,
    vmSettings,
    maxRepositoryDriveSizeMib,
  });
};

export const action = async ({ context: { db, req } }: ActionArgs) => {
  const { success, error, value: formData } = EditProjectVmSettingsValidator.SafeParse(req.body);
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, error.message);
  }
  const values = Object.fromEntries(
    VmSettingsFields.map((field) => {
      const value = formData[field];
      if (value == null) {
        return null;
      }
      const valueAsInt = parseInt(value);
      if (isNaN(valueAsInt) || valueAsInt < 1) {
        throw new HttpError(StatusCodes.BAD_REQUEST, `Invalid value for "${field}"`);
      }
      return [field, valueAsInt] as const;
    }).filter((x): x is [VmSettingsField, number] => x != null),
  ) as { [K in VmSettingsField]?: number };

  const isVCPUCountValid = (value: number | undefined): boolean => {
    if (value === void 0) {
      return true;
    }
    return value % 2 === 0 || value === 1;
  };

  if (!isVCPUCountValid(values.maxPrebuildVCPUCount)) {
    throw new HttpError(
      StatusCodes.BAD_REQUEST,
      "maxPrebuildVCPUCount must be 1 or a multiple of 2",
    );
  }
  if (!isVCPUCountValid(values.maxWorkspaceVCPUCount)) {
    throw new HttpError(
      StatusCodes.BAD_REQUEST,
      "maxWorkspaceVCPUCount must be 1 or a multiple of 2",
    );
  }

  const projectExternalId = formData.projectExternalId;

  await db.project.update({
    where: { externalId: projectExternalId },
    data: values,
  });

  return json({ ok: true });
};

export default function Settings() {
  const { project, gitRepository, vmSettings, maxRepositoryDriveSizeMib } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return (
    <ProjectPage
      project={project}
      gitRepository={gitRepository}
      activeTab={ProjectPathTabId.SETTINGS}
      content={
        <SettingsTab
          projectExternalId={project.externalId}
          vmSettings={vmSettings}
          showSuccess={actionData != null}
          maxRepositoryDriveSizeMib={maxRepositoryDriveSizeMib}
        />
      }
    />
  );
}

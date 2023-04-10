import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ProjectPage } from "~/components/projects/project-page";
import { SettingsTab, VmSettingsField } from "~/components/projects/settings-tab";
import { ProjectPathTabId } from "~/page-paths.shared";
import { Token } from "~/token";

export const loader = async ({ context: { db, req, app } }: LoaderArgs) => {
  const projectService = app.resolve(Token.ProjectService);
  const { projectPageProps, project } = await projectService.getProjectFromRequest(db, req);
  const vmSettings = Object.fromEntries(
    Array.from(Object.values(VmSettingsField)).map((field) => [field, project[field]] as const),
  ) as Record<VmSettingsField, number>;
  return json({
    ...projectPageProps,
    vmSettings,
  });
};

export default function Settings() {
  const { project, gitRepository, vmSettings } = useLoaderData<typeof loader>();
  return (
    <ProjectPage
      project={project}
      gitRepository={gitRepository}
      activeTab={ProjectPathTabId.SETTINGS}
      content={<SettingsTab {...vmSettings} />}
    />
  );
}

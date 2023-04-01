import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ProjectPage } from "~/components/projects/project-page";
import { SettingsTab } from "~/components/projects/settings-tab";
import { ProjectPathTabId } from "~/page-paths.shared";
import { Token } from "~/token";

export const loader = async ({ context: { db, req, app } }: LoaderArgs) => {
  const projectService = app.resolve(Token.ProjectService);
  const { projectPageProps } = await projectService.getProjectFromRequest(db, req);
  return json({
    ...projectPageProps,
  });
};

export default function Settings() {
  const { project, gitRepository } = useLoaderData<typeof loader>();
  return (
    <ProjectPage
      project={project}
      gitRepository={gitRepository}
      activeTab={ProjectPathTabId.SETTINGS}
      content={<SettingsTab maxPrebuildRamMib={4096} />}
    />
  );
}

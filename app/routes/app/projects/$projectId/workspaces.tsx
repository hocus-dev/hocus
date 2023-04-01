import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ProjectPage } from "~/components/projects/project-page";
import { WorkspaceList } from "~/components/workspaces/workspace-list";
import { ProjectPathTabId } from "~/page-paths.shared";
import { Token } from "~/token";
import { formatBranchName, unwrap } from "~/utils.shared";

export const loader = async ({ context: { db, req, user, app } }: LoaderArgs) => {
  const projectService = app.resolve(Token.ProjectService);
  const config = app.resolve(Token.Config).controlPlane();
  const { project, projectPageProps } = await projectService.getProjectFromRequest(db, req);
  const workspaces = await db.workspace.findMany({
    where: { prebuildEvent: { projectId: project.id }, userId: unwrap(user).id },
    orderBy: { createdAt: "desc" },
    include: {
      gitBranch: true,
      prebuildEvent: { include: { gitObject: true } },
      agentInstance: true,
      activeInstance: true,
    },
  });
  return json({
    projectPageProps,
    workspaces: workspaces.map((w) => ({
      externalId: w.externalId,
      status: w.status,
      createdAt: w.createdAt.getTime(),
      name: w.name,
      lastOpenedAt: w.lastOpenedAt.getTime(),
      branchName: formatBranchName(w.gitBranch.name),
      commitHash: w.prebuildEvent.gitObject.hash,
      agentHostname: config.agentHostname,
      workspaceHostname: w.activeInstance?.vmIp,
    })),
  });
};

export default function Prebuilds() {
  const { projectPageProps, workspaces } = useLoaderData<typeof loader>();
  return (
    <ProjectPage
      {...projectPageProps}
      activeTab={ProjectPathTabId.WORKSPACES}
      content={<WorkspaceList elements={workspaces} />}
    />
  );
}

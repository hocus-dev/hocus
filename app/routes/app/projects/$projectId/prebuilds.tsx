import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { PrebuildList } from "~/components/projects/prebuilds/prebuild-list";
import { ProjectPage } from "~/components/projects/project-page";
import { ProjectPathTabId } from "~/page-paths.shared";
import { Token } from "~/token";
import { formatBranchName } from "~/utils.shared";

export const loader = async ({ context: { db, req, app } }: LoaderArgs) => {
  const projectService = app.resolve(Token.ProjectService);
  const { project, projectPageProps } = await projectService.getProjectFromRequest(db, req);
  const prebuildEvents = await db.prebuildEvent.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      gitObject: true,
      gitBranchLinks: {
        include: { gitBranch: true },
      },
    },
  });
  return json({
    projectPageProps,
    prebuildEvents: prebuildEvents.map((e) => ({
      branches: e.gitBranchLinks
        .map((b) => ({
          name: formatBranchName(b.gitBranch.name),
          externalId: b.gitBranch.externalId,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      commitHash: e.gitObject.hash.substring(0, 8),
      createdAt: e.createdAt.getTime(),
      externalPrebuildEventId: e.externalId,
      status: e.status,
    })),
  });
};

export default function Prebuilds() {
  const { projectPageProps, prebuildEvents } = useLoaderData<typeof loader>();
  return (
    <ProjectPage
      {...projectPageProps}
      activeTab={ProjectPathTabId.PREBUILDS}
      content={<PrebuildList elements={prebuildEvents} />}
    />
  );
}

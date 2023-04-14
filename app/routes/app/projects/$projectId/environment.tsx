import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { EnvironmentTab } from "~/components/environment/environment-tab";
import { ProjectPage } from "~/components/projects/project-page";
import { ProjectPathTabId } from "~/page-paths.shared";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export const loader = async ({ context: { db, req, user, app } }: LoaderArgs) => {
  const projectService = app.resolve(Token.ProjectService);
  const { project, projectPageProps } = await projectService.getProjectFromRequest(db, req);
  const projectVariableSet = await db.environmentVariableSet.findUniqueOrThrow({
    where: { id: project.environmentVariableSetId },
    include: {
      environmentVariables: {
        orderBy: { name: "asc" },
      },
    },
  });
  const userVariableSet = await db.userProjectEnvironmentVariableSet.findUnique({
    // eslint-disable-next-line camelcase
    where: { userId_projectId: { userId: unwrap(user).id, projectId: project.id } },
    include: {
      environmentSet: {
        include: {
          environmentVariables: {
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });
  const userVariables =
    userVariableSet?.environmentSet.environmentVariables.map((v) => ({
      name: v.name,
      value: v.value,
      externalId: v.externalId,
    })) ?? [];
  return json({
    ...projectPageProps,
    userVariables,
    projectVariables: projectVariableSet.environmentVariables.map((v) => ({
      name: v.name,
      value: v.value,
      externalId: v.externalId,
    })),
  });
};

export default function Environment() {
  const { project, gitRepository, userVariables, projectVariables } =
    useLoaderData<typeof loader>();
  return (
    <ProjectPage
      project={project}
      gitRepository={gitRepository}
      activeTab={ProjectPathTabId.ENVIRONMENT}
      content={
        <EnvironmentTab
          projectExternalId={project.externalId}
          projectVariables={projectVariables}
          userVariables={userVariables}
        />
      }
    />
  );
}

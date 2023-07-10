import type { Prisma } from "@prisma/client";
import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card } from "flowbite-react";
import { StatusCodes } from "http-status-codes";
import { match, Pattern } from "ts-pattern";

import { AppPage } from "~/components/app-page";
import { BackToProjectLink } from "~/components/projects/back-to-project-link";
import { NewWorkspaceBranchListElement } from "~/components/workspaces/new-workspace-branch-list-element";
import { HttpError } from "~/http-error.server";
import { ProjectPathTabId } from "~/page-paths.shared";
import type { ProjectService } from "~/project/project.service";
import { NewWorkspaceValidator } from "~/schema/new-workspace.validator.server";
import { Token } from "~/token";
import { formatBranchName } from "~/utils.shared";

const findPrebuild = async (db: Prisma.Client, prebuildId: string) => {
  const prebuildEvent = await db.prebuildEvent.findUnique({
    where: {
      externalId: prebuildId,
    },
    include: {
      gitObject: {
        include: {
          gitObjectToBranch: {
            include: {
              gitBranch: true,
            },
          },
        },
      },
      project: true,
    },
  });
  if (prebuildEvent == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Prebuild not found");
  }
  return [
    prebuildEvent.project,
    prebuildEvent.gitObject.gitObjectToBranch.map((link) => ({
      branch: link.gitBranch,
      ongoingPrebuild: null,
      finishedPrebuild: prebuildEvent,
    })),
  ] as const;
};

const findProject = async (
  db: Prisma.Client,
  projectId: string,
  projectService: ProjectService,
) => {
  const project = await db.project.findUnique({
    where: {
      externalId: projectId,
    },
  });
  if (project == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Project not found");
  }
  const prebuildsByBranch = await projectService.getLatestPrebuildsByBranch(db, {
    projectExternalId: project.externalId,
  });
  return [project, prebuildsByBranch] as const;
};

export const loader = async ({ context: { db, req, app } }: LoaderArgs) => {
  const projectService = app.resolve(Token.ProjectService);
  const { success, value: workspaceInfo } = NewWorkspaceValidator.SafeParse(req.query);
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid query data");
  }
  const nullPattern = Pattern.optional(Pattern.nullish);
  const [project, prebuildsByBranch] = await match(workspaceInfo)
    .with({ projectId: Pattern.string, prebuildId: nullPattern }, ({ projectId }) =>
      findProject(db, projectId, projectService),
    )
    .with({ projectId: nullPattern, prebuildId: Pattern.string }, ({ prebuildId }) => {
      return findPrebuild(db, prebuildId);
    })
    .exhaustive();

  return json({
    prebuildCommitHash:
      workspaceInfo.prebuildId != null
        ? prebuildsByBranch[0].finishedPrebuild?.gitObject.hash.substring(0, 8)
        : void 0,
    project: {
      name: project.name,
      externalId: project.externalId,
    },
    branches: prebuildsByBranch
      .map((r) => ({
        branch: {
          name: formatBranchName(r.branch.name),
          externalId: r.branch.externalId,
        },
        ongoingPrebuild:
          r.ongoingPrebuild != null ? { externalId: r.ongoingPrebuild.externalId } : null,
        finishedPrebuild:
          r.finishedPrebuild != null
            ? {
                externalId: r.finishedPrebuild.externalId,
                commitHash: r.finishedPrebuild.gitObject.hash,
              }
            : null,
      }))
      .sort((a, b) => a.branch.name.localeCompare(b.branch.name)),
  });
};

export default function NewWorkspace(): JSX.Element {
  const { project, branches, prebuildCommitHash } = useLoaderData<typeof loader>();
  const heading = `New Workspace in ${project.name}`;
  const subheading = prebuildCommitHash != null ? `From commit ${prebuildCommitHash}` : void 0;

  return (
    <AppPage>
      <BackToProjectLink project={project} tabId={ProjectPathTabId.WORKSPACES} />
      <div className="h-full flex flex-col justify-center items-center">
        <Card className="min-w-[36rem] min-h-[20rem]">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold">{heading}</h1>
            {subheading && <h2 className="font-bold mb- text-gray-400 mb-4">{subheading}</h2>}
            <h3 className="text-gray-400">Choose a branch</h3>
          </div>

          <div className="grow">
            {branches.length !== 0 && (
              <div className="grid auto-rows-[1fr]">
                {branches.map((args, idx) => (
                  <NewWorkspaceBranchListElement {...args} key={idx} />
                ))}
              </div>
            )}
            {branches.length === 0 && (
              <div className="h-full flex flex-col gap-2 justify-center items-center p-4 text-gray-400 border-t border-gray-700">
                <p>No branches found.</p>
                <p>Please make sure your Git repository is connected properly.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppPage>
  );
}

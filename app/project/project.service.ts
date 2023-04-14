import path from "path";

import { PrebuildEventStatus } from "@prisma/client";
import type { GitBranch, PrebuildEvent, Project, GitObject, GitRepository } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type e from "express";
import { StatusCodes } from "http-status-codes";
import { match } from "ts-pattern";

import { ENV_VAR_NAME_REGEX, UpdateEnvVarsTarget } from "./env-form.shared";

import type { GitService } from "~/git/git.service";
import type { GitRepoConnectionStatus } from "~/git/types.shared";
import { HttpError } from "~/http-error.server";
import { UuidValidator } from "~/schema/uuid.validator.server";
import { Token } from "~/token";
import { groupBy, unwrap, waitForPromises } from "~/utils.shared";

export interface UpdateEnvVarsArgs {
  userId: bigint;
  projectExternalId: string;
  delete: string[];
  create: { name: string; value: string }[];
  update: { name?: string; value?: string; externalId: string }[];
  target: UpdateEnvVarsTarget;
}

export class ProjectService {
  static inject = [Token.GitService] as const;

  constructor(private readonly gitService: GitService) {}

  async createProject(
    db: Prisma.TransactionClient,
    args: {
      gitRepositoryId: bigint;
      rootDirectoryPath: string;
      name: string;
    },
  ): Promise<Project> {
    const environmentVariableSet = await db.environmentVariableSet.create({ data: {} });
    return await db.project.create({
      data: {
        gitRepositoryId: args.gitRepositoryId,
        rootDirectoryPath: args.rootDirectoryPath,
        environmentVariableSetId: environmentVariableSet.id,
        name: args.name,
        maxPrebuildRamMib: 4096,
        maxPrebuildVCPUCount: 4,
        maxWorkspaceRamMib: 8192,
        maxWorkspaceVCPUCount: 8,
        maxWorkspaceProjectDriveSizeMib: 256000,
        maxWorkspaceRootDriveSizeMib: 256000,
        maxPrebuildRootDriveSizeMib: 10000,
      },
    });
  }

  async updateEnvironmentVariables(
    db: Prisma.TransactionClient,
    args: UpdateEnvVarsArgs,
  ): Promise<void> {
    const project = await db.project.findUnique({
      where: { externalId: args.projectExternalId },
      include: {
        environmentVariableSet: {
          include: { environmentVariables: true },
        },
      },
    });
    if (project == null) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Project not found");
    }
    const envVarSet = await match(args.target)
      .with(UpdateEnvVarsTarget.USER, async () => {
        const userSet = await db.userProjectEnvironmentVariableSet.upsert({
          // eslint-disable-next-line camelcase
          where: { userId_projectId: { userId: args.userId, projectId: project.id } },
          create: {
            user: { connect: { id: args.userId } },
            project: { connect: { id: project.id } },
            environmentSet: { create: {} },
          },
          update: {},
          include: {
            environmentSet: {
              include: { environmentVariables: true },
            },
          },
        });
        return userSet.environmentSet;
      })
      .with(UpdateEnvVarsTarget.PROJECT, async () => {
        return project.environmentVariableSet;
      })
      .exhaustive();
    const vars = new Map(envVarSet.environmentVariables.map((v) => [v.externalId, v] as const));
    const getVar = (externalId: string) => {
      const v = vars.get(externalId);
      if (v == null) {
        throw new HttpError(StatusCodes.BAD_REQUEST, `Variable with id "${externalId}" not found`);
      }
      return v;
    };
    const varsToDelete = args.delete.map((externalId) => getVar(externalId).id);
    const varsToUpdateName = args.update
      .map((v) => (v.name != null ? { id: getVar(v.externalId).id, name: v.name } : null))
      .filter((v): v is { id: bigint; name: string } => v != null);
    const varsToUpdateValue = args.update
      .map((v) => (v.value != null ? { id: getVar(v.externalId).id, value: v.value } : null))
      .filter((v): v is { id: bigint; value: string } => v != null);
    const varsToCreate = args.create;

    for (const v of [...varsToUpdateName, ...varsToCreate]) {
      if (!ENV_VAR_NAME_REGEX.test(v.name)) {
        throw new HttpError(
          StatusCodes.BAD_REQUEST,
          `Invalid variable name "${v.name}" (must match "${ENV_VAR_NAME_REGEX}")`,
        );
      }
    }

    await db.environmentVariable.deleteMany({
      where: { id: { in: varsToDelete } },
    });
    const updateNamePromises = varsToUpdateName.map((v) =>
      db.environmentVariable.update({ where: { id: v.id }, data: { name: v.name } }),
    );
    const updateValuePromises = varsToUpdateValue.map((v) =>
      db.environmentVariable.update({ where: { id: v.id }, data: { value: v.value } }),
    );
    const createPromises = varsToCreate.map((v) =>
      db.environmentVariable.create({
        data: {
          name: v.name,
          value: v.value,
          environmentVariableSet: { connect: { id: envVarSet.id } },
        },
      }),
    );
    await waitForPromises([...updateNamePromises, ...updateValuePromises, ...createPromises]);
  }

  async getLatestPrebuildsByBranch(
    db: Prisma.Client,
    args: { projectExternalId: string },
  ): Promise<
    {
      branch: GitBranch;
      finishedPrebuild: (PrebuildEvent & { gitObject: GitObject }) | null;
      ongoingPrebuild: PrebuildEvent | null;
    }[]
  > {
    const project = await db.project.findUnique({
      where: { externalId: args.projectExternalId },
      include: {
        gitRepository: {
          include: {
            gitBranches: true,
          },
        },
      },
    });
    if (project == null) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Project not found");
    }
    const prebuildEventIds = await db.$queryRaw<{ prebuildEventId: bigint; gitBranchId: bigint }[]>`
      SELECT x."prebuildEventId", x."gitBranchId"
      FROM (
        SELECT
          ROW_NUMBER() OVER (PARTITION BY t."gitBranchId", t."status" ORDER BY t."createdAt" DESC) AS r,
          t.*
        FROM (
          SELECT *
          FROM "PrebuildEventToGitBranch" AS p2b
          INNER JOIN "PrebuildEvent" AS p ON p2b."prebuildEventId" = p.id
          WHERE p."projectId" = ${project.id}
          ORDER BY p."createdAt" DESC
        ) AS t
      ) AS x
      WHERE x."r" = 1 AND x."status" IN (
        'PREBUILD_EVENT_STATUS_SUCCESS'::"PrebuildEventStatus",
        'PREBUILD_EVENT_STATUS_RUNNING'::"PrebuildEventStatus",
        'PREBUILD_EVENT_STATUS_PENDING_INIT'::"PrebuildEventStatus",
        'PREBUILD_EVENT_STATUS_PENDING_READY'::"PrebuildEventStatus"
      )
    `;
    const prebuildEvents = await db.prebuildEvent.findMany({
      where: { id: { in: prebuildEventIds.map((v) => v.prebuildEventId) } },
      include: {
        gitObject: true,
      },
    });
    const prebuildsById = new Map(prebuildEvents.map((v) => [v.id, v] as const));
    const gitBranches = await db.gitBranch.findMany({
      where: { id: { in: prebuildEventIds.map((v) => v.gitBranchId) } },
    });
    const prebuildsByBranch = groupBy(
      prebuildEventIds,
      (v) => v.gitBranchId,
      (v) => unwrap(prebuildsById.get(v.prebuildEventId)),
    );
    const prebuildsByBranchAndStatus = new Map(
      Array.from(prebuildsByBranch.entries()).map(([branchId, prebuilds]) => {
        return [
          branchId,
          Object.fromEntries(prebuilds.map((prebuild) => [prebuild.status, prebuild] as const)),
        ] as const;
      }),
    );
    return gitBranches.map((branch) => {
      const prebuilds = unwrap(prebuildsByBranchAndStatus.get(branch.id));
      const finishedPrebuild = prebuilds[PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS] ?? null;
      const ongoingPrebuild =
        prebuilds[PrebuildEventStatus.PREBUILD_EVENT_STATUS_RUNNING] ??
        prebuilds[PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_INIT] ??
        prebuilds[PrebuildEventStatus.PREBUILD_EVENT_STATUS_PENDING_READY] ??
        null;
      return { branch, finishedPrebuild, ongoingPrebuild };
    });
  }

  private parseProjectPath(projectPath: string): { externalId: string } {
    const projectIdCandidate = path.parse(projectPath).dir.split("/").pop()?.trim();
    const { success, value: externalId } = UuidValidator.SafeParse(projectIdCandidate);
    if (!success) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Project id must be a UUID");
    }
    return { externalId };
  }

  async getProjectFromRequest(
    db: Prisma.Client,
    req: e.Request,
  ): Promise<{
    project: Project & {
      gitRepository: GitRepository & {
        sshKeyPair: {
          publicKey: string;
        };
      };
    };
    projectPageProps: {
      project: {
        name: string;
        externalId: string;
        createdAt: number;
      };
      gitRepository: {
        url: string;
        publicKey: string;
        connectionStatus: GitRepoConnectionStatus;
      };
    };
  }> {
    const { externalId } = this.parseProjectPath(req.params[0]);
    const project = await db.project.findUnique({
      where: { externalId },
      include: {
        gitRepository: {
          include: {
            sshKeyPair: true,
          },
        },
      },
    });
    if (project == null) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Project not found");
    }
    const connectionStatus = await this.gitService.getConnectionStatus(
      db,
      project.gitRepository.id,
    );
    const projectPageProps = {
      project: {
        name: project.name,
        externalId: project.externalId,
        createdAt: project.createdAt.getTime(),
      },
      gitRepository: {
        url: project.gitRepository.url,
        publicKey: project.gitRepository.sshKeyPair.publicKey,
        connectionStatus,
      },
    };
    return { project, projectPageProps };
  }
}

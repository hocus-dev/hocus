import path from "path";

import type { PrebuildEvent } from "@prisma/client";
import { LogGroupType, VmTaskStatus } from "@prisma/client";
import { WorkspaceStatus } from "@prisma/client";
import { PrebuildEventStatus } from "@prisma/client";

import { createAgentInjector } from "./agent-injector";
import { BlockRegistryService, EXPOSE_METHOD } from "./block-registry/registry.service";
import { SUCCESSFUL_PREBUILD_STATES } from "./prebuild-constants";

import { createExampleRepositoryAndProject } from "~/test-utils/project";
import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";
import { createTestUser } from "~/user/test-utils";
import { doesFileExist } from "~/utils.server";
import { numericSort, waitForPromises } from "~/utils.shared";

const testEnv = new TestEnvironmentBuilder(createAgentInjector).withTestLogging().withTestDb();

jest.setTimeout(30000);

test.concurrent(
  "getArchivablePrebuildEvents, getRemovablePrebuildEvents",
  testEnv.run(async ({ injector, db }) => {
    const sortedIds = (prebuildEvents: PrebuildEvent[]) =>
      prebuildEvents.map((p) => p.id).sort(numericSort);
    const prebuildService = injector.resolve(Token.PrebuildService);
    const project = await db.$transaction((tdb) =>
      createExampleRepositoryAndProject({ tdb, injector }),
    );
    const repo = project.gitRepository;
    const gitBranchNames = ["a", "b", "c", "d"];
    const statuses = Array.from(Object.values(PrebuildEventStatus)).sort();
    const archivablePrebuildEvents: PrebuildEvent[] = [];
    for (const gitBranchName of gitBranchNames) {
      const gitObject = await db.gitObject.create({
        data: {
          hash: `${gitBranchName}-hash`,
        },
      });
      const gitBranch = await db.gitBranch.create({
        data: {
          name: gitBranchName,
          gitObjectId: gitObject.id,
          gitRepositoryId: repo.id,
        },
      });
      await db.gitObjectToBranch.create({
        data: {
          gitObjectId: gitObject.id,
          gitBranchId: gitBranch.id,
        },
      });
      for (const status of statuses) {
        for (const createdAt of [3, 2, 1]) {
          const prebuildEvent = await db.prebuildEvent.create({
            data: {
              status,
              project: {
                connect: {
                  id: project.id,
                },
              },
              gitObject: {
                create: {
                  hash: `${gitBranchName}-${status}-${createdAt}`,
                  createdAt: new Date(createdAt),
                  gitObjectToBranch: {
                    create: {
                      gitBranchId: gitBranch.id,
                    },
                  },
                },
              },
            },
          });
          if (
            status === PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS &&
            [1, 2].includes(createdAt)
          ) {
            archivablePrebuildEvents.push(prebuildEvent);
          }
        }
      }
    }
    const prebuildEvents = await prebuildService.getArchivablePrebuildEvents(db, project.id);
    expect(sortedIds(prebuildEvents)).toEqual(sortedIds(archivablePrebuildEvents));
    const newGitBranch = await db.gitBranch.create({
      data: {
        name: "newBranch",
        gitObjectId: archivablePrebuildEvents[0].gitObjectId,
        gitRepositoryId: repo.id,
      },
    });
    await db.gitObjectToBranch.create({
      data: {
        gitBranchId: newGitBranch.id,
        gitObjectId: archivablePrebuildEvents[0].gitObjectId,
      },
    });
    const prebuildEvents2 = await prebuildService.getArchivablePrebuildEvents(db, project.id);
    expect(sortedIds(prebuildEvents2)).toEqual(sortedIds(archivablePrebuildEvents.slice(1)));
    await db.prebuildEvent.update({
      where: {
        id: archivablePrebuildEvents[1].id,
      },
      data: {
        archiveAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const prebuildEvents3 = await prebuildService.getArchivablePrebuildEvents(db, project.id);
    expect(sortedIds(prebuildEvents3)).toEqual(sortedIds(archivablePrebuildEvents.slice(2)));

    const now = new Date();
    const aWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const archivedPrebuildEvents = await db.prebuildEvent.findMany({
      where: {
        status: PrebuildEventStatus.PREBUILD_EVENT_STATUS_ARCHIVED,
      },
    });
    expect(archivedPrebuildEvents.length > 1).toBe(true);

    await db.prebuildEvent.updateMany({
      where: {
        id: { in: archivedPrebuildEvents.map((p) => p.id) },
      },
      data: {
        createdAt: aWeekAgo,
      },
    });
    await db.prebuildEvent.update({
      where: {
        id: archivedPrebuildEvents[0].id,
      },
      data: {
        createdAt: now,
      },
    });
    const removablePrebuildEvents = await prebuildService.getRemovablePrebuildEvents(
      db,
      project.id,
      now,
    );
    expect(sortedIds(removablePrebuildEvents)).toEqual(sortedIds(archivedPrebuildEvents.slice(1)));
    const user = await createTestUser(db);
    const agentInstance = await db.agentInstance.create({
      data: {
        externalId: "xd",
      },
    });
    const [projectFile, rootFsFile] = await waitForPromises(
      ["a", "b"].map((path) =>
        db.file.create({
          data: {
            path,
            agentInstanceId: agentInstance.id,
          },
        }),
      ),
    );
    await db.workspace.create({
      data: {
        externalId: "xd",
        userId: user.id,
        name: "xd-name",
        prebuildEventId: archivedPrebuildEvents[1].id,
        status: WorkspaceStatus.WORKSPACE_STATUS_STARTED,
        agentInstanceId: agentInstance.id,
        projectFileId: projectFile.id,
        rootFsFileId: rootFsFile.id,
        gitBranchId: newGitBranch.id,
      },
    });
    const removablePrebuildEvents2 = await prebuildService.getRemovablePrebuildEvents(
      db,
      project.id,
      now,
    );
    expect(sortedIds(removablePrebuildEvents2)).toEqual(sortedIds(archivedPrebuildEvents.slice(2)));
  }),
);

test.concurrent(
  "cleanupDbAfterPrebuildError",
  testEnv.run(async ({ injector, db }) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    const project = await db.$transaction((tdb) =>
      createExampleRepositoryAndProject({ tdb, injector }),
    );
    const repo = project.gitRepository;
    const gitObject = await db.gitObject.create({
      data: {
        hash: "a",
      },
    });
    const gitBranch = await db.gitBranch.create({
      data: {
        name: "main",
        gitObjectId: gitObject.id,
        gitRepositoryId: repo.id,
      },
    });
    await db.gitObjectToBranch.create({
      data: {
        gitObjectId: gitObject.id,
        gitBranchId: gitBranch.id,
      },
    });
    const prebuildEvents: PrebuildEvent[] = [];
    for (const status of Object.values(PrebuildEventStatus)) {
      const prebuildEvent = await db.prebuildEvent.create({
        data: {
          status,
          project: {
            connect: {
              id: project.id,
            },
          },
          gitObject: {
            connect: {
              id: gitObject.id,
            },
          },
        },
      });
      prebuildEvents.push(prebuildEvent);
      for (const [idx, vmTaskStatus] of [
        VmTaskStatus.VM_TASK_STATUS_SUCCESS,
        VmTaskStatus.VM_TASK_STATUS_PENDING,
      ].entries()) {
        await db.prebuildEventTask.create({
          data: {
            prebuildEvent: {
              connect: {
                id: prebuildEvent.id,
              },
            },
            idx,
            originalCommand: "a",
            vmTask: {
              create: {
                cwd: "/",
                status: vmTaskStatus,
                logGroup: {
                  create: {
                    type: LogGroupType.LOG_GROUP_TYPE_VM_TASK,
                  },
                },
              },
            },
          },
        });
      }
    }
    for (const prebuildEvent of prebuildEvents) {
      const errorMessage = `error-${prebuildEvent.status}`;
      await db.$transaction(async (tdb) => {
        await prebuildService.cleanupDbAfterPrebuildError({
          db: tdb,
          prebuildEventId: prebuildEvent.id,
          errorMessage,
          cancelled: false,
        });
      });
      const updatedPrebuildEvent = await db.prebuildEvent.findUniqueOrThrow({
        where: {
          id: prebuildEvent.id,
        },
        include: {
          PrebuildEventSystemError: true,
          tasks: {
            include: {
              vmTask: true,
            },
          },
        },
      });
      if (SUCCESSFUL_PREBUILD_STATES.includes(prebuildEvent.status as any)) {
        expect(updatedPrebuildEvent.status).toBe(prebuildEvent.status);
        expect(updatedPrebuildEvent.PrebuildEventSystemError).toBeNull();
        continue;
      }
      expect(updatedPrebuildEvent.status).toBe(PrebuildEventStatus.PREBUILD_EVENT_STATUS_ERROR);
      expect(updatedPrebuildEvent.PrebuildEventSystemError?.message).toBe(errorMessage);
      expect(
        [VmTaskStatus.VM_TASK_STATUS_SUCCESS, VmTaskStatus.VM_TASK_STATUS_CANCELLED].map(
          (s) => updatedPrebuildEvent.tasks.find((t) => t.vmTask.status === s) !== void 0,
        ),
      ).toEqual([true, true]);
    }
  }),
);

test.concurrent(
  "checkoutAndInspect",
  testEnv
    .withBlockRegistry()
    .withImagePush((timestamp) => [
      {
        tag: `quay.io/hocus/hocus-tests:checkout-and-inspect-${timestamp}`,
        imageId: BlockRegistryService.genContainerId("output"),
      },
    ])
    .run(async ({ injector, runId }) => {
      const prebuildService = injector.resolve(Token.PrebuildService);
      const brService = injector.resolve(Token.BlockRegistryService);

      const repoImageTag = "im1";
      const repoImageId = await brService.loadImageFromRemoteRepo(
        "quay.io/hocus/hocus-tests:fetchrepo-06-10-2023-22-29-27",
        repoImageTag,
      );
      const repoContainerId = await brService.createContainer(repoImageId, "fetchrepo");
      const runtime = injector.resolve(Token.QemuService)(runId);
      const outputId = "output";

      await prebuildService.checkoutAndInspect({
        runtime,
        repoContainerId,
        targetBranch: "main",
        outputId,
        projectConfigPaths: ["/"],
      });

      const ctId = await BlockRegistryService.genContainerId(outputId);
      const { mountPoint } = await brService.expose(ctId, EXPOSE_METHOD.HOST_MOUNT);
      expect(await doesFileExist(path.join(mountPoint, "project", "hocus.yml"))).toBe(true);
    }),
);

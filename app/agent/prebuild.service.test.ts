import type { PrebuildEvent } from "@prisma/client";
import { WorkspaceStatus } from "@prisma/client";
import { PrebuildEventStatus } from "@prisma/client";

import { provideInjectorAndDb } from "./test-utils";

import { createExampleRepositoryAndProject } from "~/test-utils/project";
import { Token } from "~/token";
import { createTestUser } from "~/user/test-utils";
import { numericSort, waitForPromises } from "~/utils.shared";

test.concurrent(
  "getArchivablePrebuildEvents, getRemovablePrebuildEvents",
  provideInjectorAndDb(async ({ injector, db }) => {
    const sortedIds = (prebuildEvents: PrebuildEvent[]) =>
      prebuildEvents.map((p) => p.id).sort(numericSort);
    const prebuildService = injector.resolve(Token.PrebuildService);
    const project = await db.$transaction((tdb) =>
      createExampleRepositoryAndProject({ tdb, injector }),
    );
    const repo = project.gitRepository;
    const gitBranchArgs = ["a", "b", "c", "d"].map((name, idx) => ({
      name,
      gitObjectHash: `hash${idx}`,
    }));
    const statuses = Array.from(Object.values(PrebuildEventStatus)).sort();
    const archivablePrebuildEvents: PrebuildEvent[] = [];
    for (const args of gitBranchArgs) {
      const gitObject = await db.gitObject.create({
        data: {
          hash: args.gitObjectHash,
        },
      });
      const gitBranch = await db.gitBranch.create({
        data: {
          name: args.name,
          gitObjectId: gitObject.id,
          gitRepositoryId: repo.id,
        },
      });
      for (const status of statuses) {
        for (const createdAt of [1, 2, 3]) {
          const prebuildEvent = await db.prebuildEvent.create({
            data: {
              createdAt: new Date(createdAt),
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
              gitBranchLinks: {
                create: {
                  gitBranch: {
                    connect: {
                      id: gitBranch.id,
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
    await db.prebuildEventToGitBranch.create({
      data: {
        gitBranchId: newGitBranch.id,
        prebuildEventId: archivablePrebuildEvents[0].id,
      },
    });
    const prebuildEvents2 = await prebuildService.getArchivablePrebuildEvents(db, project.id);
    expect(sortedIds(prebuildEvents2)).toEqual(sortedIds(archivablePrebuildEvents.slice(1)));

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

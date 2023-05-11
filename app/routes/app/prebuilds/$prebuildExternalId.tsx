import path from "path";

import { VmTaskStatus } from "@prisma/client";
import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { StatusCodes } from "http-status-codes";
import moment from "moment";

import { AppPage } from "~/components/app-page";
import { BackToProjectLink } from "~/components/projects/back-to-project-link";
import { PrebuildArchiveButton } from "~/components/projects/prebuilds/archive-button";
import { PrebuildStatus } from "~/components/projects/prebuilds/prebuild-status";
import { PrebuildRetryButton } from "~/components/projects/prebuilds/retry-button";
import { TaskViewer } from "~/components/projects/prebuilds/task-viewer";
import { VmTaskStatusComponent } from "~/components/projects/prebuilds/vm-task-status";
import { HttpError } from "~/http-error.server";
import { getPrebuildPath, ProjectPathTabId } from "~/page-paths.shared";
import { PrebuildQueryValidator } from "~/schema/prebuild-query.validator.server";
import { UuidValidator } from "~/schema/uuid.validator.server";
import { formatBranchName, numericSort, unwrap } from "~/utils.shared";

export const loader = async ({ context: { db, req } }: LoaderArgs) => {
  const { success, value: prebuildExternalId } = UuidValidator.SafeParse(
    path.parse(req.params[0]).name,
  );
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Prebuild id must be a UUID");
  }
  const { success: success2, value: query } = PrebuildQueryValidator.SafeParse(req.query);
  if (!success2) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid query");
  }
  const activeTaskIdx = parseInt(query.task ?? "0");
  if (activeTaskIdx < 0 || isNaN(activeTaskIdx)) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid task index");
  }
  const prebuildEvent = await db.prebuildEvent.findUnique({
    where: {
      externalId: prebuildExternalId,
    },
    include: {
      buildfsEvent: {
        include: {
          vmTask: true,
        },
      },
      project: true,
      gitObject: {
        include: {
          gitObjectToBranch: {
            include: {
              gitBranch: true,
            },
          },
        },
      },
      tasks: {
        include: {
          vmTask: true,
        },
      },
      PrebuildEventSystemError: true,
    },
  });
  if (prebuildEvent == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Prebuild not found");
  }
  const tasks: {
    vmTaskExternalId?: string;
    status: VmTaskStatus;
    command: string;
    idx: number;
    logGroupId?: bigint;
  }[] = prebuildEvent.tasks.map((task) => ({
    vmTaskExternalId: task.vmTask.externalId,
    status: task.vmTask.status,
    command: task.originalCommand,
    idx: task.idx + 2,
    logGroupId: task.vmTask.logGroupId,
  }));
  const systemErrorCommand = "System Error";
  if (prebuildEvent.PrebuildEventSystemError != null) {
    tasks.push({
      idx: 0,
      status: VmTaskStatus.VM_TASK_STATUS_ERROR,
      command: systemErrorCommand,
    });
  }
  if (prebuildEvent.buildfsEvent != null) {
    const buildfsEvent = prebuildEvent.buildfsEvent;
    tasks.push({
      vmTaskExternalId: buildfsEvent.vmTask.externalId,
      status: buildfsEvent.vmTask.status,
      command: "Build Image",
      idx: 1,
      logGroupId: buildfsEvent.vmTask.logGroupId,
    });
  }
  tasks.sort((a, b) => numericSort(a.idx, b.idx));

  let activeTask: (typeof tasks)[number] | undefined = tasks.find((t) => t.idx === activeTaskIdx);
  if (activeTask == null && tasks.length > 0) {
    activeTask = tasks[tasks.length - 1];
  }
  let activeTaskLogs: string | undefined = void 0;
  if (activeTask != null) {
    if (activeTask.command === systemErrorCommand) {
      activeTaskLogs = unwrap(prebuildEvent.PrebuildEventSystemError).message;
    } else {
      const logs = await db.log.findMany({
        where: { logGroupId: unwrap(activeTask.logGroupId) },
        orderBy: { idx: "desc" },
        take: 150,
      });
      activeTaskLogs = Buffer.concat(logs.map((log) => log.content).reverse()).toString("utf8");
    }
  }

  const displayTasks = tasks.map((task) => ({
    idx: task.idx,
    status: task.status,
    command: task.command,
    externalId: task.vmTaskExternalId,
  }));

  return json({
    project: {
      name: prebuildEvent.project.name,
      externalId: prebuildEvent.project.externalId,
    },
    prebuild: {
      externalId: prebuildEvent.externalId,
      branches: prebuildEvent.gitObject.gitObjectToBranch
        .map((link) => formatBranchName(link.gitBranch.name))
        .sort(),
      gitHash: prebuildEvent.gitObject.hash,
      createdAt: prebuildEvent.createdAt.getTime(),
      status: prebuildEvent.status,
    },
    displayTasks,
    activeTask:
      activeTask != null
        ? {
            idx: activeTask.idx,
            logs: activeTaskLogs ?? "",
          }
        : void 0,
  });
};

export default function PrebuildRoute(): JSX.Element {
  const { project, prebuild, activeTask, displayTasks } = useLoaderData<typeof loader>();
  const branchTitle = prebuild.branches.length > 1 ? "Branches" : "Branch";
  const branchValues = prebuild.branches.join(", ");
  const createdAt = moment(prebuild.createdAt).fromNow();

  return (
    <AppPage>
      <BackToProjectLink project={project} tabId={ProjectPathTabId.PREBUILDS} />

      <div className="flex gap-4 w-full mt-4 items-end justify-between">
        <h1 className="font-bold text-3xl">Prebuild</h1>
        <div className="flex gap-4">
          {prebuild.status === "PREBUILD_EVENT_STATUS_SUCCESS" && (
            <PrebuildArchiveButton prebuildExternalId={prebuild.externalId} />
          )}
          <PrebuildRetryButton
            projectExternalId={project.externalId}
            gitObjectHash={prebuild.gitHash}
          />
        </div>
      </div>
      <h3 className="text-gray-400 mt-2 mb-2">
        This page is <span className="font-bold">not</span> updated automatically. Refresh it to see
        new changes.
      </h3>
      <div className="grid grid-cols-2 gap-16 mt-4 max-w-xl">
        <div className="flex flex-col justify-between gap-4">
          <div className="flex gap-2">
            <h3 className="text-gray-400">{branchTitle}:</h3>
            <p className="font-bold">{branchValues}</p>
          </div>
          <div className="flex gap-2">
            <h3 className="text-gray-400">Commit:</h3>
            <p className="font-bold">{prebuild.gitHash.substring(0, 8)}</p>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4">
          <div className="flex gap-2">
            <h3 className="text-gray-400">Created:</h3>
            <p className="font-bold">{createdAt}</p>
          </div>
          <div className="flex gap-2">
            <h3 className="text-gray-400">Status:</h3>
            <p className="font-bold">
              <PrebuildStatus status={prebuild.status} />
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col grow min-h-[30rem] max-h-[100rem] w-full mt-6 rounded-lg border border-gray-700">
        <div className="grow flex">
          <div className="w-[14rem] flex flex-col grow border-r border-gray-700 shrink-0">
            <h1 className="h-16 font-bold text-lg p-4 border-b border-gray-700 flex flex-col justify-center">
              <span>Tasks</span>
            </h1>
            {displayTasks.map((task) => (
              <a key={task.idx} href={getPrebuildPath(prebuild.externalId, task.idx)}>
                <button
                  className={`${
                    activeTask?.idx === task.idx ? "bg-slate-700 text-white " : ""
                  }transition-all text-left w-full font-mono text-sm text-gray-400 p-4 border-b border-gray-700 hover:bg-slate-600 hover:text-white whitespace-nowrap truncate`}
                >
                  <VmTaskStatusComponent status={task.status} />
                  <span className="ml-2">{task.command}</span>
                </button>
              </a>
            ))}
          </div>
          <TaskViewer
            activeTask={activeTask}
            prebuild={{ externalId: prebuild.externalId }}
            tasks={displayTasks}
          />
        </div>
      </div>
    </AppPage>
  );
}

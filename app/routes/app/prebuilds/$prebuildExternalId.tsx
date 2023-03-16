import path from "path";

import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Button } from "flowbite-react";
import { StatusCodes } from "http-status-codes";
import moment from "moment";
import { AppPage } from "~/components/app-page";
import { BackToProjectLink } from "~/components/projects/back-to-project-link";
import { LogViewer } from "~/components/projects/prebuilds/log-viewer";
import { PrebuildStatus } from "~/components/projects/prebuilds/prebuild-status";
import { VmTaskStatusComponent } from "~/components/projects/prebuilds/vm-task-status";
import { HttpError } from "~/http-error.server";
import { getPrebuildLogsPath, getPrebuildPath, ProjectPathTabId } from "~/page-paths.shared";
import { PrebuildQueryValidator } from "~/schema/prebuild-query.validator.server";
import { UuidValidator } from "~/schema/uuid.validator.server";
import { formatBranchName, numericSort } from "~/utils.shared";

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
      gitBranchLinks: {
        include: {
          gitBranch: true,
        },
      },
      gitObject: true,
      tasks: {
        include: {
          vmTask: true,
        },
      },
    },
  });
  if (prebuildEvent == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Prebuild not found");
  }
  const tasks = prebuildEvent.tasks.map((task) => ({
    vmTaskExternalId: task.vmTask.externalId,
    status: task.vmTask.status,
    command: task.originalCommand,
    idx: task.idx + 1,
    logGroupId: task.vmTask.logGroupId,
  }));
  if (prebuildEvent.buildfsEvent != null) {
    const buildfsEvent = prebuildEvent.buildfsEvent;
    tasks.push({
      vmTaskExternalId: buildfsEvent.vmTask.externalId,
      status: buildfsEvent.vmTask.status,
      command: "Build Image",
      idx: 0,
      logGroupId: buildfsEvent.vmTask.logGroupId,
    });
  }
  tasks.sort((a, b) => numericSort(a.idx, b.idx));

  let activeTask: typeof tasks[number] | undefined = tasks[activeTaskIdx];
  if (activeTask == null && tasks.length > 0) {
    activeTask = tasks[tasks.length - 1];
  }
  let activeTaskLogs: string | undefined = void 0;
  if (activeTask != null) {
    const logs = await db.log.findMany({
      where: { logGroupId: activeTask.logGroupId },
      orderBy: { idx: "desc" },
      take: 150,
    });
    activeTaskLogs = Buffer.concat(logs.map((log) => log.content).reverse()).toString("utf8");
  }

  return json({
    project: {
      name: prebuildEvent.project.name,
      externalId: prebuildEvent.project.externalId,
    },
    prebuild: {
      externalId: prebuildEvent.externalId,
      branches: prebuildEvent.gitBranchLinks
        .map((link) => formatBranchName(link.gitBranch.name))
        .sort(),
      gitHash: prebuildEvent.gitObject.hash,
      createdAt: prebuildEvent.createdAt.getTime(),
      status: prebuildEvent.status,
      tasks: tasks.map((task) => ({ ...task, logGroupId: void 0 })),
    },
    activeTask:
      activeTask != null
        ? {
            task: { ...activeTask, logGroupId: void 0 },
            logs: activeTaskLogs as string,
          }
        : void 0,
  });
};

export default function PrebuildRoute(): JSX.Element {
  const { project, prebuild, activeTask } = useLoaderData<typeof loader>();
  const branchTitle = prebuild.branches.length > 1 ? "Branches" : "Branch";
  const branchValues = prebuild.branches.join(", ");
  const createdAt = moment(prebuild.createdAt).fromNow();

  return (
    <AppPage>
      <BackToProjectLink project={project} tabId={ProjectPathTabId.PREBUILDS} />

      <h1 className="font-bold text-3xl mt-4">Prebuild</h1>
      <h3 className="text-gray-400 mt-2 mb-2">
        This page is <span className="font-bold">not</span> updated automatically. Refresh it to see
        new changes.
      </h3>
      <div className="grid grid-cols-2 gap-16 mt-4 max-w-xl">
        <div className="grid grid-cols-3 gap-4">
          <h3 className="text-gray-400 col-span-1">{branchTitle}:</h3>
          <p className="font-bold col-span-2">{branchValues}</p>
          <h3 className="text-gray-400 col-span-1">Commit:</h3>
          <p className="font-bold col-span-2">{prebuild.gitHash.substring(0, 8)}</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <h3 className="text-gray-400 col-span-1">Created:</h3>
          <p className="font-bold col-span-2">{createdAt}</p>
          <h3 className="text-gray-400 col-span-1">Status:</h3>
          <p className="font-bold col-span-2">
            <PrebuildStatus status={prebuild.status} />
          </p>
        </div>
      </div>
      <div className="grow min-h-[30rem] max-h-[100rem] w-full mt-6 rounded-lg border border-gray-700">
        <div className="h-full flex">
          <div className="w-[14rem] h-full border-r border-gray-700 shrink-0">
            <h1 className="h-16 font-bold text-lg p-4 border-b border-gray-700 flex flex-col justify-center">
              <span>Tasks</span>
            </h1>
            {prebuild.tasks.map((task) => (
              <a key={task.idx} href={getPrebuildPath(prebuild.externalId, task.idx)}>
                <button
                  className={`${
                    activeTask?.task.idx === task.idx ? "bg-slate-700 text-white " : ""
                  }transition-all text-left w-full font-mono text-sm text-gray-400 p-4 border-b border-gray-700 hover:bg-slate-600 hover:text-white whitespace-nowrap truncate`}
                >
                  <VmTaskStatusComponent status={task.status} />
                  <span className="ml-2">{task.command}</span>
                </button>
              </a>
            ))}
          </div>
          <div className="h-full flex flex-col" style={{ width: "calc(100% - 14rem)" }}>
            {activeTask ? (
              <>
                <div className="border-b border-gray-700 flex">
                  <div
                    className="shrink-0 h-16 font-mono text-sm flex flex-col justify-center"
                    style={{ width: "calc(100% - 11rem)" }}
                  >
                    <p className="whitespace-nowrap overflow-y-hidden overflow-x-auto p-6">
                      {activeTask.task.command}
                    </p>
                  </div>
                  <div className="grow flex flex-col justify-center items-center">
                    <Button
                      href={getPrebuildLogsPath(
                        prebuild.externalId,
                        activeTask.task.vmTaskExternalId,
                      )}
                      color="dark"
                      className="transition-all"
                    >
                      <i className="fa-solid fa-download mr-2"></i>
                      <span>Download Log</span>
                    </Button>
                  </div>
                </div>
                <div className="grow bg-gray-900 rounded-br-lg font-mono text-sm overflow-auto">
                  <LogViewer text={activeTask.logs} />
                </div>
              </>
            ) : (
              <div className="flex-grow flex items-center justify-center">
                <div className="text-gray-400 text-center">
                  <h1 className="text-2xl font-bold">No tasks</h1>
                  <p className="mt-4">This prebuild has no tasks associated with it.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppPage>
  );
}

import type { VmTaskStatus } from "@prisma/client";
import { Button } from "flowbite-react";

import { LogViewer } from "./log-viewer";

import { getPrebuildLogsPath } from "~/page-paths.shared";

export interface Task {
  status: VmTaskStatus;
  command: string;
  externalId?: string;
}

export interface ActiveTask {
  logs: string;
  idx: number;
}

export function TaskViewer(props: {
  prebuild: { externalId: string };
  tasks: Task[];
  activeTask?: ActiveTask;
}): JSX.Element {
  const { prebuild, tasks, activeTask } = props;
  const activeTaskExternalId = activeTask != null ? tasks[activeTask.idx].externalId : void 0;
  const downloadLogBtn =
    activeTaskExternalId != null ? (
      <Button
        href={getPrebuildLogsPath(prebuild.externalId, activeTaskExternalId)}
        color="dark"
        className="transition-all"
      >
        <i className="fa-solid fa-download mr-2"></i>
        <span>Download Log</span>
      </Button>
    ) : null;
  return (
    <div className="flex flex-col grow" style={{ width: "calc(100% - 14rem)" }}>
      {activeTask != null ? (
        <>
          <div className="border-b border-gray-700 flex">
            <div
              className="shrink-0 h-16 font-mono text-sm flex flex-col justify-center"
              style={{ width: "calc(100% - 11rem)" }}
            >
              <p className="whitespace-nowrap overflow-y-hidden overflow-x-auto p-6">
                {tasks[activeTask.idx].command}
              </p>
            </div>
            <div className="grow flex flex-col justify-center items-center">{downloadLogBtn}</div>
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
  );
}

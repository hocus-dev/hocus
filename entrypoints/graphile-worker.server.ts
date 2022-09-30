import type { Task } from "graphile-worker";
import { run } from "graphile-worker";
import { config } from "~/config";
import type { AbstractTaskRunnerService } from "~/services/abstract-task-runner.service.server";
import { SendGAEventTaskRunnerService } from "~/services/send-ga-event-task-runner.service.server";
import { TaskId } from "~/tasks/schemas.server";

const taskServices: { [Id in TaskId]: AbstractTaskRunnerService<Id> } = {
  [TaskId.SendGAEvent]: new SendGAEventTaskRunnerService(),
};

const taskList: { [key in TaskId]: Task } = Object.entries(taskServices).reduce(
  (acc, [key, service]) => {
    acc[key] = service.run.bind(service);
    return acc;
  },
  {} as any,
);

async function main() {
  // Run a worker to execute jobs:
  const runner = await run({
    connectionString: config.graphileWorker().connectionString,
    concurrency: 5,
    // Install signal handlers for graceful shutdown on SIGINT, SIGTERM, etc
    noHandleSignals: true,
    pollInterval: 1000,
    taskList,
  });

  // Immediately await (or otherwise handled) the resulting promise, to avoid
  // "unhandled rejection" errors causing a process crash in the event of
  // something going wrong.
  await runner.promise;

  // If the worker exits (whether through fatal error or otherwise), the above
  // promise will resolve/reject.
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

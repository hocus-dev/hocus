import type { PrismaClient } from "@prisma/client";
import type { TaskSpec, Job } from "graphile-worker";
import type { TaskParams } from "~/tasks/types.server";

export class TaskService {
  async scheduleTask(db: PrismaClient, params: TaskParams, spec: TaskSpec = {}): Promise<Job> {
    // copied from https://github.com/graphile/worker/blob/9d484820b97f0f4f677dccdf810905547ee2e74c/src/helpers.ts#L23
    const rows: Job[] = await db.$queryRawUnsafe(
      `SELECT * FROM graphile_worker.add_job(
        identifier => $1::text,
        payload => $2::json,
        queue_name => $3::text,
        run_at => $4::timestamptz,
        max_attempts => $5::int,
        job_key => $6::text,
        priority => $7::int,
        flags => $8::text[],
        job_key_mode => $9::text
      );`,
      params.id,
      JSON.stringify(params.payload),
      spec.queueName ?? null,
      spec.runAt != void 0 ? spec.runAt.toISOString() : null,
      spec.maxAttempts ?? null,
      spec.jobKey ?? null,
      spec.priority ?? null,
      spec.flags ?? null,
      spec.jobKeyMode ?? null,
    );
    const job = rows[0];
    job.task_identifier = params.id;
    return job;
  }
}

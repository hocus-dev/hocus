// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "@prisma/client";
import { TaskService } from "~/tasks/task.service.server";

const db = new PrismaClient();

const taskService = new TaskService();
// eslint-disable-next-line @typescript-eslint/no-floating-promises
taskService.scheduleTask(db, { id: "send-ga-event", payload: { category: "test" } });

import type { VmTaskStatus } from "@prisma/client";
import { Tooltip } from "flowbite-react";
import { match } from "ts-pattern";

export function VmTaskStatusComponent(props: { status: VmTaskStatus }): JSX.Element {
  const [icon, text, color] = match(props.status)
    .with("VM_TASK_STATUS_PENDING", () => ["fa-solid fa-clock", "Pending", "text-yellow-400"])
    .with("VM_TASK_STATUS_RUNNING", () => ["fa-solid fa-circle", "Running", "text-blue-500"])
    .with("VM_TASK_STATUS_SUCCESS", () => ["fa-solid fa-circle-check", "Success", "text-green-500"])
    .with("VM_TASK_STATUS_ERROR", () => ["fa-solid fa-circle-xmark", "Error", "text-red-700"])
    .with("VM_TASK_STATUS_CANCELLED", () => ["fa-solid fa-ban", "Cancelled", "text-gray-400"])
    .exhaustive();

  return (
    <Tooltip theme={{ target: "inline" }} content={text}>
      <i className={`${color} ${icon}`}></i>
    </Tooltip>
  );
}

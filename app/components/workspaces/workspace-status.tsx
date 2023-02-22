import type { WorkspaceStatus } from "@prisma/client";
import { match } from "ts-pattern";

export function WorkspaceStatusComponent(props: { status: WorkspaceStatus }): JSX.Element {
  const [icon, text, color] = match(props.status)
    .with("WORKSPACE_STATUS_PENDING_CREATE", () => [
      "fa-solid fa-clock",
      "Creating...",
      "text-yellow-400",
    ])
    .with("WORKSPACE_STATUS_PENDING_START", () => [
      "fa-solid fa-circle-play",
      "Starting...",
      "text-blue-500",
    ])
    .with("WORKSPACE_STATUS_STARTED", () => [
      "fa-solid fa-circle-play",
      "Running",
      "text-green-500",
    ])
    .with("WORKSPACE_STATUS_PENDING_STOP", () => [
      "fa-solid fa-circle-stop",
      "Stopping...",
      "text-yellow-400",
    ])
    .with("WORKSPACE_STATUS_STOPPED", () => ["fa-solid fa-circle-stop", "Stopped", "text-gray-400"])
    .exhaustive();

  return (
    <span className={color}>
      <i className={`${icon} mr-2`}></i>
      <span className="font-bold">{text}</span>
    </span>
  );
}

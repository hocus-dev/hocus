import type { PrebuildEventStatus } from "@prisma/client";
import { match } from "ts-pattern";

export function PrebuildStatus(props: { status: PrebuildEventStatus }): JSX.Element {
  const [icon, text, color] = match(props.status)
    .with("PREBUILD_EVENT_STATUS_PENDING_INIT", () => [
      "fa-solid fa-clock",
      "Pending",
      "text-yellow-400",
    ])
    .with("PREBUILD_EVENT_STATUS_PENDING_READY", () => [
      "fa-solid fa-clock",
      "Pending",
      "text-yellow-400",
    ])
    .with("PREBUILD_EVENT_STATUS_RUNNING", () => [
      "fa-solid fa-circle-play",
      "Running",
      "text-blue-500",
    ])
    .with("PREBUILD_EVENT_STATUS_SUCCESS", () => [
      "fa-solid fa-circle-check",
      "Success",
      "text-green-500",
    ])
    .with("PREBUILD_EVENT_STATUS_ERROR", () => [
      "fa-solid fa-circle-xmark",
      "Error",
      "text-red-500",
    ])
    .with("PREBUILD_EVENT_STATUS_CANCELLED", () => [
      "fa-solid fa-ban",
      "Cancelled",
      "text-gray-400",
    ])
    .with("PREBUILD_EVENT_STATUS_PENDING_ARCHIVE", () => [
      "fa-solid fa-box-archive",
      "Pending Archive...",
      "text-gray-400",
    ])
    .with("PREBUILD_EVENT_STATUS_ARCHIVED", () => [
      "fa-solid fa-box-archive",
      "Archived",
      "text-gray-400",
    ])
    .exhaustive();

  return (
    <span className={color}>
      <i className={`${icon} mr-2`}></i>
      <span className="font-bold">{text}</span>
    </span>
  );
}

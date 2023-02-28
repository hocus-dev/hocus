import { Button } from "flowbite-react";
import { getWorkspaceStopPath } from "~/page-paths.shared";

import { CsrfInput } from "../csrf-input";

export function StopWorkspaceButton(props: {
  workspaceExternalId: string;
  className?: string;
}): JSX.Element {
  return (
    <form action={getWorkspaceStopPath(props.workspaceExternalId)} method="POST">
      <CsrfInput />
      <Button type="submit" color="dark" className={"transition-all " + (props.className ?? "")}>
        <i className="fa-solid fa-circle-stop mr-2"></i>
        <span>Stop</span>
      </Button>
    </form>
  );
}

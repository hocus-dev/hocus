import { Button } from "flowbite-react";

import { CsrfInput } from "../csrf-input";

import { getWorkspaceStartPath } from "~/page-paths.shared";

export function StartWorkspaceButton(props: {
  workspaceExternalId: string;
  className?: string;
}): JSX.Element {
  return (
    <form action={getWorkspaceStartPath(props.workspaceExternalId)} method="POST">
      <CsrfInput />
      <Button type="submit" color="success" className={"transition-all " + (props.className ?? "")}>
        <i className="fa-solid fa-circle-play mr-2"></i>
        <span>Start</span>
      </Button>
    </form>
  );
}

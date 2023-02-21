import { Button } from "flowbite-react";
import { PagePaths } from "~/page-paths.shared";

import { CsrfInput } from "../csrf-input";

export function NewWorkspaceButton(props: {
  externalGitBranchId: string;
  externalPrebuildEventId: string;
}): JSX.Element {
  return (
    <form action={PagePaths.CreateWorkspace} method="POST">
      <CsrfInput />
      <input type="hidden" name="gitBranchId" value={props.externalGitBranchId} />
      <input type="hidden" name="prebuildEventId" value={props.externalPrebuildEventId} />
      <Button type="submit" color="success" className="transition-all">
        <i className="fa-solid fa-circle-plus mr-2"></i>
        <span>New Workspace</span>
      </Button>
    </form>
  );
}

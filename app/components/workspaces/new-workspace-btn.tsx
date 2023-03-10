import type { ButtonSizes } from "flowbite-react";
import { Button } from "flowbite-react";
import { PagePaths } from "~/page-paths.shared";

import { CsrfInput } from "../csrf-input";

export function NewWorkspaceButton(props: {
  externalGitBranchId: string;
  externalPrebuildEventId: string;
  content?: JSX.Element;
  btnSize?: keyof ButtonSizes;
}): JSX.Element {
  return (
    <form action={PagePaths.CreateWorkspace} method="POST">
      <CsrfInput />
      <input type="hidden" name="gitBranchId" value={props.externalGitBranchId} />
      <input type="hidden" name="prebuildEventId" value={props.externalPrebuildEventId} />
      <Button size={props.btnSize} type="submit" color="success" className="transition-all">
        {props.content ?? (
          <>
            <i className="fa-solid fa-circle-plus mr-2"></i>
            <span>New Workspace</span>
          </>
        )}
      </Button>
    </form>
  );
}

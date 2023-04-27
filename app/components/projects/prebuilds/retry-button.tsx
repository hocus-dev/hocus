import { FormButton } from "~/components/form-button";
import { PagePaths } from "~/page-paths.shared";

export function PrebuildRetryButton(props: {
  projectExternalId: string;
  gitObjectHash: string;
}): JSX.Element {
  return (
    <FormButton
      action={PagePaths.SchedulePrebuild}
      method="POST"
      inputs={{
        projectExternalId: props.projectExternalId,
        gitObjectHash: props.gitObjectHash,
      }}
      buttonProps={{ color: "light", className: "transition-all" }}
      loadingSpinnerProps={{ color: "gray" }}
    >
      <i className="fa-solid fa-rotate-right mr-2"></i>
      <span>Retry</span>
    </FormButton>
  );
}

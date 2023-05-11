import { FormButton } from "~/components/form-button";
import { PagePaths } from "~/page-paths.shared";

export function PrebuildArchiveButton(props: { prebuildExternalId: string }): JSX.Element {
  return (
    <FormButton
      action={PagePaths.ArchivePrebuild}
      method="POST"
      inputs={{
        prebuildExternalId: props.prebuildExternalId,
      }}
      buttonProps={{ color: "light", className: "transition-all" }}
      loadingSpinnerProps={{ color: "gray" }}
    >
      <i className="fa-solid fa-box-archive mr-2"></i>
      <span>Archive</span>
    </FormButton>
  );
}

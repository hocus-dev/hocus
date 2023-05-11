import { FormButtonWithModal } from "~/components/form-button-with-modal";
import { PagePaths } from "~/page-paths.shared";

export function PrebuildArchiveButton(props: { prebuildExternalId: string }): JSX.Element {
  return (
    <FormButtonWithModal
      action={PagePaths.ArchivePrebuild}
      method="POST"
      inputs={{
        prebuildExternalId: props.prebuildExternalId,
      }}
      buttonProps={{ color: "light", className: "transition-all" }}
      loadingSpinnerProps={{ color: "gray" }}
      modal={{
        header: "Archive Prebuild",
        body: "Are you sure you want to archive this prebuild? Its backing files will be deleted and it will no longer be possible to use it to create new workspaces.",
        submitButton: {
          body: "Archive",
        },
      }}
    >
      <i className="fa-solid fa-box-archive mr-2"></i>
      <span>Archive</span>
    </FormButtonWithModal>
  );
}

import { FormButtonWithModal } from "~/components/form-button-with-modal";
import { PagePaths } from "~/page-paths.shared";

export function PrebuildCancelButton(props: { prebuildExternalId: string }): JSX.Element {
  return (
    <FormButtonWithModal
      action={PagePaths.CancelPrebuild}
      method="POST"
      inputs={{
        prebuildExternalId: props.prebuildExternalId,
      }}
      buttonProps={{ color: "red", className: "transition-all" }}
      loadingSpinnerProps={{ color: "failure" }}
      modal={{
        header: "Cancel Prebuild",
        body: "Are you sure you want to cancel this prebuild?",
        submitButton: {
          body: "Cancel",
          props: {
            color: "red",
          },
        },
      }}
    >
      <i className="fa-solid fa-ban mr-2"></i>
      <span>Cancel</span>
    </FormButtonWithModal>
  );
}

import { Button, Modal } from "flowbite-react";
import { useState } from "react";

import { CsrfInput } from "../csrf-input";

import { getWorkspaceDeletePath } from "~/page-paths.shared";

export function DeleteWorkspaceButton(props: {
  workspaceName: string;
  workspaceExternalId: string;
}): JSX.Element {
  const [openModal, setOpenModal] = useState<string | undefined>();
  const renderModal = typeof document !== "undefined";

  return (
    <>
      <Button color="light" onClick={() => setOpenModal("default")}>
        <i className="fa-solid fa-trash mr-2"></i>
        <span>Delete</span>
      </Button>

      {renderModal && (
        <Modal
          dismissible={true}
          show={openModal === "default"}
          onClose={() => setOpenModal(undefined)}
        >
          <Modal.Header>Delete Workspace</Modal.Header>
          <Modal.Body>
            <div className="space-y-6">
              <div className="text-base leading-relaxed text-gray-400">
                <p>
                  Are you sure you want to delete the workspace{" "}
                  <span className="text-white font-bold">{props.workspaceName}</span>?
                </p>
                <p>All files within will be lost. This action is irreversible.</p>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <div className="w-full grid grid-cols-2 gap-4">
              <Button className="w-full" color="gray" onClick={() => setOpenModal(undefined)}>
                <i className="fa-solid fa-xmark mr-2"></i>
                <span>Cancel</span>
              </Button>
              <form method="POST" action={getWorkspaceDeletePath(props.workspaceExternalId)}>
                <CsrfInput />
                <Button type="submit" className="w-full" color="failure">
                  <i className="fa-solid fa-trash mr-2"></i>
                  <span>Delete</span>
                </Button>
              </form>
            </div>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}

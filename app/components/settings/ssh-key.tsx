import { Button, Modal } from "flowbite-react";
import React from "react";
import { useState } from "react";
import { PagePaths } from "~/page-paths.shared";

import { CsrfInput } from "../csrf-input";

export const SshKey = (props: {
  name: string;
  publicKey: string;
  externalId: string;
}): JSX.Element => {
  const [openModal, setOpenModal] = useState<string | undefined>();
  const renderModal = typeof document !== "undefined" && openModal === "default";
  const setModalToOpen = React.useCallback(() => setOpenModal("default"), []);
  const setModalToClosed = React.useCallback(() => setOpenModal(void 0), []);

  return (
    <div>
      {renderModal && (
        <Modal dismissible={true} show={renderModal} onClose={setModalToClosed}>
          <Modal.Header>Delete SSH Key</Modal.Header>
          <Modal.Body>
            <div className="space-y-6">
              <div className="text-base leading-relaxed text-gray-400">
                <p>
                  Are you sure you want to delete the key{" "}
                  <span className="text-white font-bold">{props.name}</span>?
                </p>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <div className="w-full grid grid-cols-2 gap-4">
              <Button className="w-full" color="gray" onClick={setModalToClosed}>
                <i className="fa-solid fa-xmark mr-2"></i>
                <span>Cancel</span>
              </Button>
              <form method="POST" action={PagePaths.UserSettingsSshKeyDelete}>
                <CsrfInput />
                <input type="hidden" name="externalId" value={props.externalId} />
                <Button type="submit" className="w-full" color="failure">
                  <i className="fa-solid fa-trash mr-2"></i>
                  <span>Delete</span>
                </Button>
              </form>
            </div>
          </Modal.Footer>
        </Modal>
      )}
      <div className="mb-2 flex gap-4 justify-between items-center">
        <h3 className="font-bold mr-2">{props.name}</h3>
        <Button size="xs" color="dark" onClick={setModalToOpen}>
          <i className="fa-solid fa-trash mr-2"></i>
          <span>Delete</span>
        </Button>
      </div>
      <p className="font-mono text-sm text-gray-300 p-2 border border-gray-700 bg-gray-700 rounded-lg overflow-auto">
        {props.publicKey}
      </p>
    </div>
  );
};

import type { ButtonProps, SpinnerProps } from "flowbite-react";
import { Modal } from "flowbite-react";
import { Spinner } from "flowbite-react";
import { Button } from "flowbite-react";
import React, { useCallback, useState } from "react";

import { CsrfInput } from "./csrf-input";

export function FormButtonWithModal(props: {
  inputs: Record<string, string>;
  action: string;
  method: string;
  buttonProps?: ButtonProps;
  loadingSpinnerProps?: SpinnerProps;
  modal: {
    header: React.ReactNode;
    body: React.ReactNode;
    submitButton?: {
      body?: React.ReactNode;
      props?: ButtonProps;
    };
    cancelButton?: {
      body?: React.ReactNode;
      props?: ButtonProps;
    };
  };
  children?: React.ReactNode;
}): JSX.Element {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const onSubmit = useCallback(() => {
    setIsSubmitted(true);
  }, []);

  const [openModal, setOpenModal] = useState<string | undefined>();
  const renderModal = typeof document !== "undefined";
  const showModal = openModal === "default" && !isSubmitted;
  const setModalToOpen = React.useCallback(() => setOpenModal("default"), []);
  const setModalToClosed = React.useCallback(() => setOpenModal(void 0), []);

  const inputs = Object.entries(props.inputs)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);
  return (
    <>
      {renderModal && (
        <Modal dismissible={true} show={showModal} onClose={setModalToClosed}>
          <Modal.Header>{props.modal.header}</Modal.Header>
          <Modal.Body>{props.modal.body}</Modal.Body>
          <Modal.Footer>
            <div className="w-full grid grid-cols-2 gap-4">
              <Button
                className="transition-all"
                color="gray"
                onClick={setModalToClosed}
                {...props.modal.cancelButton?.props}
              >
                {props.modal.cancelButton?.body ?? "Cancel"}
              </Button>
              <form action={props.action} method={props.method} onSubmit={onSubmit}>
                <CsrfInput />
                {inputs}
                <Button
                  className="transition-all w-full"
                  type="submit"
                  disabled={isSubmitted}
                  {...props.modal.submitButton?.props}
                >
                  <div className="flex flex-nowrap items-center">
                    {props.modal.submitButton?.body ?? "Submit"}
                  </div>
                </Button>
              </form>
            </div>
          </Modal.Footer>
        </Modal>
      )}
      <Button
        className="transition-all"
        disabled={isSubmitted}
        onClick={setModalToOpen}
        {...props.buttonProps}
      >
        <div className="flex flex-nowrap items-center">
          {isSubmitted && (
            <div>
              <Spinner className="mr-4" aria-label="Loading..." {...props.loadingSpinnerProps} />
            </div>
          )}
          {props.children}
        </div>
      </Button>
    </>
  );
}

import type { ButtonProps, SpinnerProps } from "flowbite-react";
import { Spinner } from "flowbite-react";
import { Button } from "flowbite-react";
import React, { useCallback, useState } from "react";

import { CsrfInput } from "./csrf-input";

export function FormButton(props: {
  inputs: Record<string, string>;
  action: string;
  method: string;
  buttonProps?: ButtonProps;
  loadingSpinnerProps?: SpinnerProps;
  children?: React.ReactNode;
}): JSX.Element {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const onSubmit = useCallback(() => {
    setIsSubmitted(true);
  }, []);

  const inputs = Object.entries(props.inputs)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);
  return (
    <form action={props.action} method={props.method} onSubmit={onSubmit}>
      <CsrfInput />
      {inputs}
      <Button type="submit" disabled={isSubmitted} {...props.buttonProps}>
        <div className="flex flex-nowrap items-center">
          {isSubmitted && (
            <div>
              <Spinner className="mr-4" aria-label="Loading..." {...props.loadingSpinnerProps} />
            </div>
          )}
          {props.children}
        </div>
      </Button>
    </form>
  );
}

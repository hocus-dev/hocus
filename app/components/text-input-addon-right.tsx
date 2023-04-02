import React from "react";

const TextInputAddonRightComponent = (props: {
  inputProps: React.DetailedHTMLProps<
    React.InputHTMLAttributes<HTMLInputElement>,
    HTMLInputElement
  >;
  addon: React.ReactNode;
  helperText?: React.ReactNode;
  inputExtraClassName?: string;
}): JSX.Element => {
  let inputClassName =
    "rounded-none rounded-l-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-sm p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";
  if (props.inputExtraClassName != null) {
    inputClassName += " " + props.inputExtraClassName;
  }
  if (props.inputProps.disabled) {
    inputClassName += " cursor-not-allowed !text-gray-400";
  }
  return (
    <>
      <div className="flex">
        <input type="text" className={inputClassName} {...props.inputProps} />
        <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600">
          {props.addon}
        </span>
      </div>
      {props.helperText != null && (
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{props.helperText}</div>
      )}
    </>
  );
};

export const TextInputAddonRight = React.memo(TextInputAddonRightComponent);

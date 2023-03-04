import { TextInput, Button } from "flowbite-react";
import { useCallback, useState } from "react";

export const EnvVarInput = (props: {
  initialName: string;
  initialValue: string;
  envVarExternalId: string;
}): JSX.Element => {
  const [focused, setFocused] = useState(false);
  const [name, setName] = useState(props.initialName);
  const [value, setValue] = useState(props.initialValue);
  const [deleted, setDeleted] = useState(false);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);
  const onNameInput: React.FormEventHandler<HTMLInputElement> = useCallback(
    (e) => setName(e.currentTarget.value),
    [],
  );
  const onValueInput: React.FormEventHandler<HTMLInputElement> = useCallback(
    (e) => setValue(e.currentTarget.value),
    [],
  );
  const onReset = useCallback(() => {
    setValue(props.initialValue);
    setName(props.initialName);
  }, [props.initialValue, props.initialName]);
  const onDelete = useCallback(() => setDeleted(true), []);
  const nameEdited = name !== props.initialName;
  const valueEdited = value !== props.initialValue;
  const edited = nameEdited || valueEdited;
  const formNameId = `env-var-name-${props.envVarExternalId}`;
  const formValueId = `env-var-value-${props.envVarExternalId}`;
  const formDeletedId = `env-var-deleted-${props.envVarExternalId}`;

  if (deleted) {
    return <input type="hidden" name={formDeletedId} value="yes"></input>;
  }

  return (
    <div className="grid grid-cols-envlist gap-4 mb-4">
      <TextInput
        name={nameEdited ? formNameId : void 0}
        className="font-mono"
        type="text"
        value={name}
        onInput={onNameInput}
      />
      <div className="flex">
        <TextInput
          name={valueEdited ? formValueId : void 0}
          className="font-mono grow"
          type={focused ? "text" : "password"}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onInput={onValueInput}
        />
        {edited && (
          <div className="h-full flex justify-center items-center ml-4">
            <Button
              onClick={onReset}
              aria-label="reset variable"
              color="light"
              className="min-h-full transition-all"
            >
              <i className="fa-solid fa-eraser"></i>
            </Button>
          </div>
        )}
      </div>
      <Button
        onClick={onDelete}
        aria-label="delete variable"
        color="failure"
        className="min-h-full transition-all"
      >
        <i className="fa-solid fa-trash"></i>
      </Button>
    </div>
  );
};

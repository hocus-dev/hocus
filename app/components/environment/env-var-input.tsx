import { TextInput, Button, Tooltip, Flowbite } from "flowbite-react";
import React, { useEffect } from "react";
import { useCallback, useState } from "react";
import {
  createEnvFormDeleteId,
  createEnvFormNameId,
  createEnvFormValueId,
  ENV_VAR_NAME_REGEX,
} from "~/project/env-form.shared";

const EnvVarInputComponent = (props: {
  initialName: string;
  initialValue: string;
  envVarExternalId: string;
  setParentEdited: (isEdited: boolean) => void;
  onDelete: () => void;
}): JSX.Element => {
  const [focused, setFocused] = useState(false);
  const [name, setName] = useState(props.initialName);
  const [value, setValue] = useState(props.initialValue);
  const [deleted, setDeleted] = useState(false);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);
  const onNameInput: React.FormEventHandler<HTMLInputElement> = useCallback((e) => {
    setName(e.currentTarget.value);
    if (!ENV_VAR_NAME_REGEX.test(e.currentTarget.value)) {
      e.currentTarget.setCustomValidity(
        "Name must start with a letter and contain only letters, numbers, and underscores",
      );
    } else {
      e.currentTarget.setCustomValidity("");
    }
  }, []);
  const onValueInput: React.FormEventHandler<HTMLInputElement> = useCallback(
    (e) => setValue(e.currentTarget.value),
    [],
  );
  const onReset = useCallback(() => {
    setValue(props.initialValue);
    setName(props.initialName);
  }, [props.initialValue, props.initialName]);
  const onDelete = useCallback(() => {
    setDeleted(true);
    props.onDelete();
  }, [props]);
  const onRestore = useCallback(() => setDeleted(false), []);
  const nameEdited = name !== props.initialName;
  const valueEdited = value !== props.initialValue;
  const edited = nameEdited || valueEdited || deleted;
  const formNameId = createEnvFormNameId(props.envVarExternalId);
  const formValueId = createEnvFormValueId(props.envVarExternalId);
  const formDeletedId = createEnvFormDeleteId(props.envVarExternalId);

  useEffect(() => {
    props.setParentEdited(edited);
  }, [edited, props]);

  return (
    <div className="grid grid-cols-envlist gap-4 mb-4">
      <TextInput
        name={nameEdited && !deleted ? formNameId : void 0}
        placeholder="Name"
        className="font-mono"
        type="text"
        value={deleted ? props.initialName : name}
        onInput={onNameInput}
        disabled={deleted}
        required={true}
      />
      <div className="flex">
        <TextInput
          name={valueEdited && !deleted ? formValueId : void 0}
          placeholder="Value"
          className="font-mono grow"
          type={focused || deleted ? "text" : "password"}
          value={deleted ? "deleted" : value}
          onFocus={onFocus}
          onBlur={onBlur}
          onInput={onValueInput}
          disabled={deleted}
          required={true}
        />
        {edited && !deleted && (
          <div className="h-full flex justify-center items-center ml-4">
            <Flowbite theme={{ theme: { tooltip: { target: "h-full" } } }}>
              <Tooltip className="drop-shadow" placement="top" content="Reset">
                <Button
                  onClick={onReset}
                  aria-label="reset variable"
                  color="gray"
                  className="min-h-full"
                >
                  <i className="fa-solid fa-eraser"></i>
                </Button>
              </Tooltip>
            </Flowbite>
          </div>
        )}
      </div>
      {deleted ? (
        <Tooltip placement="right" content="Restore">
          <Button
            onClick={onRestore}
            aria-label="restore variable"
            color="success"
            className="min-h-full"
          >
            <i className="fa-solid fa-arrow-rotate-left"></i>
          </Button>
        </Tooltip>
      ) : (
        <Tooltip placement="right" content="Delete">
          <Button
            onClick={onDelete}
            aria-label="delete variable"
            color="dark"
            className="min-h-full"
          >
            <i className="fa-solid fa-trash"></i>
          </Button>
        </Tooltip>
      )}
      {deleted && <input type="hidden" name={formDeletedId} value="yes"></input>}
    </div>
  );
};

export const EnvVarInput = React.memo(EnvVarInputComponent);

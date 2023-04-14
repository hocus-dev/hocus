import { Badge, Button } from "flowbite-react";
import React from "react";
import { useState } from "react";

import { CsrfInput } from "../csrf-input";

import { EnvVarInput } from "./env-var-input";

import { PagePaths } from "~/page-paths.shared";
import type { UpdateEnvVarsTarget } from "~/project/env-form.shared";

export interface EnvVarFormVariable {
  name: string;
  value: string;
  externalId: string;
}

export const EnvVarForm = (props: {
  title: string;
  subtitle: string;
  projectExternalId: string;
  target: UpdateEnvVarsTarget;
  variables: EnvVarFormVariable[];
}): JSX.Element => {
  const [variables, setVariables] = useState(
    props.variables.map((v) => ({ ...v, new: false, edited: false })),
  );
  const [newVariableCounter, setNewVariableCounter] = useState(0);
  const addVariable = React.useCallback(() => {
    setVariables((prev) => [
      ...prev,
      { name: "", value: "", externalId: `new-${newVariableCounter}`, new: true, edited: false },
    ]);
    setNewVariableCounter((prev) => prev + 1);
  }, [newVariableCounter]);

  const setEditedAtIndexFns = React.useMemo(
    () =>
      variables.map((_, idx) => (isEdited: boolean) => {
        setVariables((prev) => {
          if (prev[idx].edited === isEdited) {
            return prev;
          }

          const newVariables = [...prev];
          newVariables[idx] = { ...prev[idx], edited: isEdited };
          return newVariables;
        });
      }),
    [variables],
  );
  const formEdited = variables.some((v) => v.edited);
  const onDeletes = React.useMemo(
    () =>
      variables.map((_, idx) => () => {
        setVariables((prev) => {
          if (!prev[idx].new) {
            return prev;
          }
          const newVariables = [...prev];
          newVariables.splice(idx, 1);
          return newVariables;
        });
      }),
    [variables],
  );

  return (
    <div>
      <h1 className="flex justify-between gap-4 items-end">
        <span className="font-bold text-xl">{props.title}</span>
        {formEdited && <Badge color="gray">Unsaved changes</Badge>}
      </h1>
      <p className="mt-2 text-gray-400">{props.subtitle}</p>
      <div className="mt-4">
        {variables.length > 0 && (
          <div className="grid grid-cols-envlist gap-x-4 mb-2">
            <h3 className="text-gray-400">Name</h3>
            <h3 className="text-gray-400">Value</h3>
            <div></div>
          </div>
        )}
        <form action={PagePaths.EditProjectEnvironment} method="POST">
          <CsrfInput />
          <input type="hidden" name="project-id" value={props.projectExternalId} />
          <input type="hidden" name="target" value={props.target} />
          {variables.map(({ name, value, externalId }, idx) => (
            <EnvVarInput
              key={externalId}
              initialName={name}
              initialValue={value}
              envVarExternalId={externalId}
              setParentEdited={setEditedAtIndexFns[idx]}
              onDelete={onDeletes[idx]}
            />
          ))}
          {variables.length === 0 && (
            <div className="text-sm text-gray-400 mt-8">
              <i className="fa-solid fa-circle-info mr-2"></i>
              <span>No variables yet</span>
            </div>
          )}
          <div className="mt-8 mb-4">
            <Button color="success" onClick={addVariable}>
              <i className="fa-solid fa-circle-plus mr-2"></i>
              <span>New Variable</span>
            </Button>
          </div>
          <hr className="border-gray-700 mb-4" />
          <div className="flex justify-end items-center gap-4">
            <Button type="submit" color="success" disabled={!formEdited}>
              <i className="fa-solid fa-floppy-disk mr-2"></i>
              <span>Save Changes</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

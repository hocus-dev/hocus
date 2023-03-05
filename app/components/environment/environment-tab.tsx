import { Badge, Button } from "flowbite-react";
import React from "react";
import { useState } from "react";

import { CsrfInput } from "../csrf-input";

import { EnvVarInput } from "./env-var-input";

export const EnvironmentTab = (): JSX.Element => {
  const mockValues = React.useMemo(
    () =>
      [
        ["FOO", "bar", "abc-1"],
        ["BAR", "baz", "abc-2"],
        ["BAZ", "foo", "abc-3"],
      ] as const,
    [],
  );
  const [newVariableCounter, setNewVariableCounter] = useState(0);
  const [newVariables, setNewVariables] = useState<{ id: number }[]>([]);
  const addVariable = React.useCallback(() => {
    setNewVariables((prev) => [...prev, { id: newVariableCounter }]);
    setNewVariableCounter((prev) => prev + 1);
  }, [newVariableCounter]);
  const [edited, setEdited] = useState({ edited: mockValues.map((_) => false) });
  const setEditedAtIndexFns = React.useMemo(
    () =>
      mockValues.map((_, idx) => (isEdited: boolean) => {
        setEdited((prev) => {
          prev.edited[idx] = isEdited;
          return { edited: prev.edited };
        });
      }),
    [mockValues],
  );
  const formEdited = edited.edited.some((e) => e);

  return (
    <div>
      <div>
        <h1 className="flex justify-between gap-4 items-end">
          <span className="font-bold text-xl">Project Variables</span>
          {formEdited && <Badge color="gray">Unsaved changes</Badge>}
        </h1>
        <p className="mt-2 text-gray-400">
          Project-level environment variables are available to all project members. They are
          accessible both during prebuilds and in workspaces.
        </p>
        <div className="mt-4">
          <div className="grid grid-cols-envlist gap-x-4 mb-2">
            <h3 className="text-gray-400">Name</h3>
            <h3 className="text-gray-400">Value</h3>
            <div></div>
          </div>
          <form method="POST">
            <CsrfInput />
            {mockValues.map(([name, value, envVarExternalId], idx) => (
              <EnvVarInput
                key={idx}
                initialName={name}
                initialValue={value}
                envVarExternalId={envVarExternalId}
                setParentEdited={setEditedAtIndexFns[idx]}
              />
            ))}
            {newVariables.map(({ id }) => (
              <EnvVarInput
                key={id}
                initialName=""
                initialValue=""
                setParentEdited={() => {}}
                envVarExternalId=""
              />
            ))}
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
    </div>
  );
};

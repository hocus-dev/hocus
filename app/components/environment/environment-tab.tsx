import { Button } from "flowbite-react";

import { CsrfInput } from "../csrf-input";

import { EnvVarInput } from "./env-var-input";

export const EnvironmentTab = (): JSX.Element => {
  const mockValues = [
    ["FOO", "bar", "abc-1"],
    ["BAR", "baz", "abc-2"],
    ["BAZ", "foo", "abc-3"],
  ] as const;
  return (
    <div>
      <div>
        <h1 className="font-bold text-xl">Project Level</h1>
        <p className="mt-2 text-gray-400">
          Project-level environment variables are available to all project members. They are also
          accessible during prebuilds.
        </p>
        <div className="mt-4">
          <div className="grid grid-cols-envlist gap-x-4 mb-2">
            <h3 className="text-gray-400">Name</h3>
            <h3 className="text-gray-400">Value</h3>
            <div></div>
          </div>
          <form>
            <CsrfInput />
            {mockValues.map(([name, value, envVarExternalId], idx) => (
              <EnvVarInput
                key={idx}
                initialName={name}
                initialValue={value}
                envVarExternalId={envVarExternalId}
              />
            ))}
            <hr className="bg-gray-600 border-gray-600 mb-8" />
            <div className="flex justify-end">
              <Button color="success">Save Changes</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

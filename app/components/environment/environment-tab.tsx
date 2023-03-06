import React from "react";

import { EnvVarForm } from "./env-far-form";

export const EnvironmentTab = (): JSX.Element => {
  const variables = React.useMemo(
    () => [
      { name: "FOO", value: "bar", externalId: "abc-1" },
      { name: "BAR", value: "baz", externalId: "abc-2" },
      { name: "BAZ", value: "foo", externalId: "abc-3" },
    ],
    [],
  );

  return (
    <div>
      <EnvVarForm
        title="Project Variables"
        subtitle="Project-level environment variables are available to all project members. They are accessible both during prebuilds and in workspaces."
        variables={variables}
      />
    </div>
  );
};

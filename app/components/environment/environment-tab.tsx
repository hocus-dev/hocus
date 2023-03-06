import { EnvFormTarget } from "~/project/env-form.shared";

import type { EnvVarFormVariable } from "./env-far-form";
import { EnvVarForm } from "./env-far-form";

export const EnvironmentTab = (props: {
  projectExternalId: string;
  projectVariables: EnvVarFormVariable[];
  userVariables: EnvVarFormVariable[];
}): JSX.Element => {
  return (
    <div>
      <EnvVarForm
        title="Project Variables"
        subtitle="Project-level environment variables are available to all project members. They are accessible both during prebuilds and in workspaces."
        projectExternalId={props.projectExternalId}
        target={EnvFormTarget.PROJECT}
        variables={props.projectVariables}
      />
      <div className="mt-16"></div>
      <EnvVarForm
        title="User Variables"
        subtitle="User-level environment variables are available only to you. You can use them to override project variables or to add your own. They are accessible only in workspaces."
        projectExternalId={props.projectExternalId}
        target={EnvFormTarget.USER}
        variables={props.userVariables}
      />
    </div>
  );
};

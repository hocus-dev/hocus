import qs from "qs";

export const createVSCodeURI = (props: {
  agentHostname: string;
  workspaceHostname: string;
}): string => {
  const params = {
    "agent-hostname": props.agentHostname,
    "workspace-hostname": props.workspaceHostname,
  };
  return `vscode://hocus.hocus/?${qs.stringify(params)}`;
};

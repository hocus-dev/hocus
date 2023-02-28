import qs from "qs";

export const createVSCodeURI = (props: {
  agentHostname: string;
  workspaceHostname: string;
  workspaceName: string;
}): string => {
  const params = {
    "agent-hostname": props.agentHostname,
    "workspace-hostname": props.workspaceHostname,
    "workspace-name": props.workspaceName,
  };
  return `vscode://hocus.hocus/connect?${qs.stringify(params)}`;
};

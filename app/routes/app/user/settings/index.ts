import { redirect } from "@remix-run/node";
import { getUserSettingsPath, SettingsPageTab } from "~/page-paths.shared";

export const loader = async () => {
  return redirect(getUserSettingsPath(SettingsPageTab.SshKeys));
};

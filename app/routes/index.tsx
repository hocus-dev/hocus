import { redirect } from "@remix-run/node";
import { PagePaths } from "~/page-paths.shared";

export const loader = async () => {
  return redirect(PagePaths.ProjectList);
};

export default function Index() {
  return null;
}

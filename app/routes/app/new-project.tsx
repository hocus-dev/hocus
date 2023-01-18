import { PUBLIC_SSH_KEY } from "~/agent/test-constants";
import { AppPage } from "~/components/app-page";
import { NewProjectForm } from "~/components/projects/new-project-form";
import { PagePaths } from "~/page-paths.shared";

export default function NewProjectRoute(): JSX.Element {
  return (
    <AppPage>
      <div className="mt-8 mb-4">
        <a
          href={PagePaths.ProjectList}
          className="text-sm text-gray-400 hover:text-gray-300 transition-all"
        >
          <i className="fa-solid fa-arrow-left mr-2"></i>
          <span>Back to Project List</span>
        </a>
      </div>
      <div className="mb-4 flex justify-between items-end">
        <h1 className="text-4xl font-bold">New Project</h1>
      </div>
      <hr className="bg-gray-600 border-gray-600 mb-8" />
      <NewProjectForm publicSshKey={PUBLIC_SSH_KEY} />
    </AppPage>
  );
}

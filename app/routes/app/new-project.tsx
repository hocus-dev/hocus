import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import { runAddProjectAndRepository } from "~/agent/workflows";
import { AppPage } from "~/components/app-page";
import { NewProjectForm } from "~/components/projects/new-project-form";
import { PagePaths } from "~/page-paths.shared";
import { NewProjectFormValidator } from "~/schema/new-project-form.validator.server";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { Token } from "~/token";

export const action = async ({ context: { req, app } }: ActionArgs) => {
  const formData = req.body;
  const projectInfo = NewProjectFormValidator.Parse(formData);
  let projectWorkspaceRoot = projectInfo.workspaceRootPath?.trim() ?? "/";
  if (projectWorkspaceRoot === "") {
    projectWorkspaceRoot = "/";
  }

  const withClient = app.resolve(Token.TemporalClient);
  await withClient(async (client) => {
    return await client.workflow.execute(runAddProjectAndRepository, {
      workflowId: uuidv4(),
      taskQueue: MAIN_TEMPORAL_QUEUE,
      retry: { maximumAttempts: 1 },
      args: [
        {
          gitRepositoryUrl: projectInfo.repositoryUrl.trim(),
          projectName: projectInfo.projectName.trim(),
          projectWorkspaceRoot: projectWorkspaceRoot,
        },
      ],
    });
  });

  return redirect(PagePaths.ProjectList);
};

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
      <NewProjectForm />
    </AppPage>
  );
}

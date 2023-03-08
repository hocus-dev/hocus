import { Button, Label, Spinner, TextInput } from "flowbite-react";
import { useState } from "react";
import { PagePaths } from "~/page-paths.shared";

import { CsrfInput } from "../csrf-input";

import { RepoSshKeyCard } from "./repo-ssh-key-card";

export function NewProjectForm(props: { publicSshKey: string }): JSX.Element {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const onSubmit = () => {
    setIsSubmitted(true);
  };

  return (
    <form action={PagePaths.NewProject} onSubmit={onSubmit} method="POST">
      <div>
        <CsrfInput />
        <div className="mb-2 block">
          <Label htmlFor="projectName" value="Project Name" />
        </div>
        <TextInput
          name="projectName"
          type="text"
          placeholder="Fiery Koala"
          helperText="A descriptive name for the project."
          required={true}
          addon={
            <div className="w-4 text-center">
              <i className="fa-solid fa-pen"></i>
            </div>
          }
        />
        <div className="mt-4 mb-2 block">
          <Label htmlFor="repositoryUrl" value="Repository URL" />
        </div>
        <TextInput
          name="repositoryUrl"
          type="text"
          placeholder="git@github.com:torvalds/linux.git"
          helperText="The URL of the repository to connect to in SSH-compatible format."
          required={true}
          addon={
            <div className="w-4 text-center">
              <i className="fa-solid fa-link"></i>
            </div>
          }
        />
        <div className="mb-4"></div>
        <RepoSshKeyCard publicKey={props.publicSshKey} />
        <div className="mt-4 mb-2 block">
          <Label htmlFor="workspaceRootPath" value="Workspace Root Path (Optional)" />
        </div>
        <TextInput
          name="workspaceRootPath"
          type="text"
          placeholder="/"
          helperText={
            "Path to the workspace root, relative to the root of the repository. Change this if your project is in a subdirectory. This is where the hocus.yml file must be located and where your IDE will open when you enter a workspace. Default: '/'. "
          }
          required={false}
          addon={
            <div className="w-4 text-center">
              <i className="fa-solid fa-folder"></i>
            </div>
          }
        />
        <div className="flex justify-end mt-4 w-full">
          <Button disabled={isSubmitted} type="submit" color="success" className="transition-all">
            <div className="flex flex-nowrap items-center">
              {isSubmitted && (
                <div>
                  <Spinner
                    className="mr-4"
                    color="success"
                    aria-label="Project is being created..."
                  />
                </div>
              )}
              <i className="fa-solid fa-file-circle-plus mr-2"></i>
              <span>Create Project</span>
            </div>
          </Button>
        </div>
      </div>
    </form>
  );
}

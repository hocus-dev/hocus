import { Button, Card, Label, TextInput } from "flowbite-react";
import { useState } from "react";
import { PagePaths } from "~/page-paths.shared";

import { CsrfInput } from "../csrf-input";

export function NewProjectForm(props: { publicSshKey: string }): JSX.Element {
  const [isCopied, setIsCopied] = useState(false);

  const copyPublicKeyToClipboard = async () => {
    await navigator.clipboard.writeText(props.publicSshKey);
    setIsCopied(true);
  };

  return (
    <form action={PagePaths.NewProject} method="POST">
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
        <div className="mt-4 mb-4 text-gray-400 text-sm">
          <Card>
            <h4>
              <span>
                If the repository requires authentication, please give the following public SSH key
                read access. If the repository is public, the key must be made known to the
                provider.{" "}
                <a
                  className="underline hover:text-gray-300"
                  target="_blank noopener noreferrer"
                  href="https://docs.github.com/en/developers/overview/managing-deploy-keys#deploy-keys"
                >
                  On GitHub you can for example add it to another repository's deploy keys.
                </a>
              </span>
            </h4>
            <button
              onClick={copyPublicKeyToClipboard}
              tabIndex={-1}
              type="button"
              className="font-mono select-text text-left hover:text-gray-300 hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              <Card>
                <p className="flex items-center">
                  <i className="fa-regular fa-clipboard w-4 mr-4 text-xl"></i>
                  <span>{props.publicSshKey}</span>
                </p>
              </Card>
            </button>
            {isCopied && (
              <p className="font-sans text-xs text-green-400">
                Copied to clipboard!<i className="fa-solid fa-check ml-2"></i>
              </p>
            )}
          </Card>
        </div>
        <div className="mb-2 block">
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
          <Button type="submit" color="success" className="transition-all">
            <i className="fa-solid fa-file-circle-plus mr-2"></i>
            <span>Create Project</span>
          </Button>
        </div>
      </div>
    </form>
  );
}

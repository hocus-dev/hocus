import { Card, Label, TextInput } from "flowbite-react";
import { useState } from "react";

export function NewProjectForm(props: { publicSshKey: string }): JSX.Element {
  const [isCopied, setIsCopied] = useState(false);

  const copyPublicKeyToClipboard = async () => {
    await navigator.clipboard.writeText(props.publicSshKey);
    setIsCopied(true);
  };

  return (
    <form>
      <div>
        <div className="mb-2 block">
          <Label htmlFor="projectName" value="Project Name" />
        </div>
        <TextInput
          id="projectName"
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
          id="repositoryUrl"
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
        <div className="mt-4 text-gray-400 text-sm">
          <Card>
            <h4>
              If the repository requires authentication, please give the following public SSH key
              read access.
            </h4>
            <button
              onClick={copyPublicKeyToClipboard}
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
      </div>
    </form>
  );
}

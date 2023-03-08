import { Card } from "flowbite-react";
import { useState } from "react";

export const RepoSshKeyCard = (props: { publicKey: string }): JSX.Element => {
  const [isCopied, setIsCopied] = useState(false);

  const copyPublicKeyToClipboard = async () => {
    await navigator.clipboard.writeText(props.publicKey);
    setIsCopied(true);
  };

  return (
    <div className="text-gray-400 text-sm">
      <Card>
        <h4>
          <span>
            If the repository requires authentication, please give the following public SSH key read
            access. If the repository is public, the key must be made known to the provider.{" "}
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
              <span>{props.publicKey}</span>
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
  );
};

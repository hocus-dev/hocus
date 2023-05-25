import { Card } from "flowbite-react";
import { useState } from "react";

export const RepoSshKeyCard = (props: { publicKey: string }): JSX.Element => {
  const [isCopied, setIsCopied] = useState(false);
  const [isCopyError, setIsCopyError] = useState(false);

  const copyPublicKeyToClipboard = async () => {
    try {
      // navigator.clipboard only works via https
      // https://stackoverflow.com/questions/51805395/navigator-clipboard-is-undefined
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(props.publicKey);
      } else {
        // Use the 'out of viewport hidden text area' trick
        const textArea = document.createElement("textarea");
        textArea.value = props.publicKey;

        // Move textarea out of the viewport so it's not visible
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";

        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
        } catch (e) {
          throw e;
        } finally {
          textArea.remove();
        }
      }
      setIsCopied(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setIsCopyError(true);
    }
  };

  return (
    <div className="text-gray-400 text-sm">
      <Card>
        <h2 className="text-white text-lg font-bold leading-5">Connect Git Repository</h2>
        <div>
          <p className="mb-2">
            Please give the following SSH public key read access to the repository. Either:
          </p>
          <ul className="list-disc pl-4">
            <li>add it to the repository's deploy keys, or;</li>
            <li>add it to your account, or;</li>
            <li>if the repository is public, add it to another repository's deploy keys.</li>
          </ul>
        </div>
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
        {isCopyError && (
          <p className="font-sans text-xs text-red-400">
            Failed to copy to clipboard!<i className="fa-solid fa-exclamation-triangle ml-2"></i>
          </p>
        )}
      </Card>
    </div>
  );
};

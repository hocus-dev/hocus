import React, { useEffect } from "react";
import { sleep } from "~/utils.shared";

export const LogViewer = (props: { initialText: string }) => {
  const [isRunning, setIsRunning] = React.useState(false);
  const [text, setText] = React.useState({ inner: { ref: props.initialText } });
  const [userScrolled, setUserScrolled] = React.useState(false);
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const inner = async () => {
      const intervalMs = 1000000;
      let lastUpdateAt = Date.now();
      while (true) {
        lastUpdateAt = Date.now();

        text.inner.ref += props.initialText;
        setText({ inner: text.inner });

        const now = Date.now();
        const elapsedMs = now - lastUpdateAt;
        const msTillNextUpdate = intervalMs - elapsedMs;
        if (msTillNextUpdate > 0) {
          await sleep(msTillNextUpdate);
        }
      }
    };
    if (!isRunning) {
      setIsRunning(true);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      inner();
    }
  }, [text, props.initialText, isRunning]);
  useEffect(() => {
    if (textAreaRef.current == null || userScrolled) {
      return;
    }
    textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
  }, [text, userScrolled]);

  return (
    <textarea
      ref={textAreaRef}
      value={text.inner.ref}
      onWheel={(_) => {
        if (!userScrolled) {
          setUserScrolled(true);
        }
        if (
          textAreaRef.current != null &&
          textAreaRef.current.scrollTop + textAreaRef.current.offsetHeight ===
            textAreaRef.current.scrollHeight
        ) {
          // if scrolled to bottom, reset userScrolled
          setUserScrolled(false);
        }
      }}
      readOnly={true}
      className="p-6 w-full h-full bg-gray-900 border-none resize-none text-sm"
    ></textarea>
  );
};

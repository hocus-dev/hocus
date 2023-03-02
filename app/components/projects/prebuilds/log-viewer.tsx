import React, { useEffect } from "react";

export const LogViewer = (props: { text: string }) => {
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textAreaRef.current == null) {
      return;
    }
    textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
  }, []);

  return (
    <textarea
      ref={textAreaRef}
      value={props.text}
      readOnly={true}
      className="p-6 w-full h-full bg-gray-900 border-none resize-none text-sm"
    ></textarea>
  );
};

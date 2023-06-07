/* eslint-disable no-console */
export const install = () => {
  let caller = "[UNKNOWN]";
  // Play some 4D chess
  const o = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_err, stackTraces) => {
      const c = stackTraces[1];
      if (c) caller = `${c.getFileName()}:${c.getLineNumber()}:${c.getColumnNumber()}`;
    };
    const a = new Error();
    void a.stack;
  } finally {
    Error.prepareStackTrace = o;
    console.error(
      `Warning! Someone tried to install source map support in a jest test. This will cause all stack traces to be malformed! The offender:\n${caller}`,
    );
  }
};

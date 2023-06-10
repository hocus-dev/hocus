import { discoverCaller } from "~/test-utils/test-environment-builder";

/* eslint-disable no-console */
export const install = () => {
  console.error(
    `Warning! Someone tried to install source map support in a jest test. This will cause all stack traces to be malformed! The offender:\n${discoverCaller()}`,
  );
};

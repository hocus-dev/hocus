// https://docs.temporal.io/application-development/foundations?lang=typescript#register-types
import { writeFile } from "fs/promises";
import path from "path";

import { generateTemporalCodeBundle } from "~/temporal/bundle";

async function bundle() {
  const { code } = await generateTemporalCodeBundle();
  const codePath = path.join(__dirname, "../agent-build/workflow-bundle.js");

  await writeFile(codePath, code);
  // eslint-disable-next-line no-console
  console.log(`Bundle written to ${codePath}`);
  process.exit(0);
}

void bundle();

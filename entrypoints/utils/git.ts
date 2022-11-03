/* eslint-disable no-console */

import { GitService } from "~/agent/git/git.service";

async function run() {
  const gitService = new GitService(console);
  const remotes = await gitService.getRemotes("https://github.com/sinclairzx81/typebox");
  console.log(remotes.length);
  console.log(remotes.splice(0, 10));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

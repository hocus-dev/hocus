import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import { createAgentInjector } from "../../agent-injector";
import { execCmd, execSshCmd, sleep } from "../../utils";

import { Scope } from "~/di/injector.server";
import { printErrors } from "~/test-utils";
import { Token } from "~/token";
import { provideBlockRegistry } from "~/agent/block-registry/test-utils";
import testImages from "../../block-registry/test-data/test_images.json";
import { EXPOSE_METHOD } from "~/agent/block-registry/registry.service";

for (const [osName, remoteTag] of [
  ["Alpine 3.14", testImages.testAlpine3_14],
  ["Debian Bookworm", testImages.testDebianBookworm],
  ["Debian Buster", testImages.testDebianBuster],
  ["Ubuntu Focal", testImages.testUbuntuFocal],
  ["Ubuntu Jammy", testImages.testUbuntuJammy],
]) {
  test.concurrent(
    `Run an ${osName} Qemu VM`,
    provideBlockRegistry(async ({ injector, runId, brService }) => {
      const im1 = await brService.loadImageFromRemoteRepo(remoteTag, "im1");
      const c1 = await brService.createContainer(im1, "c1");
      const b1 = await brService.expose(c1, EXPOSE_METHOD.BLOCK_DEV);
      const qemuService = injector.resolve(Token.QemuService)(runId);
      await qemuService.withRuntime(
        {
          ssh: {
            username: "root",
            password: "root",
          },
          vcpuCount: 1,
          memSizeMib: 512,
          fs: { "/": b1 },
        },
        async ({ ssh }) => {
          console.log(await execSshCmd({ ssh }, ["ls"]));
          console.log(await execSshCmd({ ssh }, ["mount"]));
          //console.log(await execSshCmd({ ssh }, ["reboot"]));
          //console.log(runId);
          //console.log(await execSshCmd({ ssh }, ["poweroff", "-f"]));
        },
      );
    }),
  );
}

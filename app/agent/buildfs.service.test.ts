import { createAgentInjector } from "./agent-injector";
import { execSshCmd, sha256 } from "./utils";

import { TestEnvironmentBuilder } from "~/test-utils/test-environment-builder";
import { Token } from "~/token";
import { waitForPromises } from "~/utils.shared";

const DOCKERFILE_1 = `FROM ubuntu:latest
COPY ./foo /foo`;
const DOCKERFILE_2 = `FROM ubuntu:latest
COPY ./foo /foo
COPY ./foo /hey ho ../john/johnny ./so/many/levels/`;
const DOCKERFILE_3 = `FROM ubuntu:latest
COPY --from=builder --chown=1 ./foo ./hey/ho /foo`;
const DOCKERFILE_4 = `FROM ubuntu:latest
ADD ./foo /ho /foo`;
const DOCKERFILE_5 = `FROM ubuntu:latest
ADD git@git.example.com:foo/bar.git /bar`;
const DOCKERFILE_6 = `FROM ubuntu:latest
COPY ./foo /hey ho ../john/johnny ./so/many/levels/ /dest
ADD git@git.example.com:foo/bar.git /bar
ADD --chown=1 https://github.com/hocus-dev/hocus.git heyo /hocus
RUN git clone xd`;

const testEnv = new TestEnvironmentBuilder(createAgentInjector).withTestLogging();

test.concurrent(
  "isUrl",
  testEnv.run(async ({ injector }) => {
    const buildfsService = injector.resolve(Token.BuildfsService);
    const cases: [string, boolean][] = [
      ["https://github.com", true],
      ["http://github.com", true],
      ["github.com", false],
      ["git@github.com", true],
      ["git://github.com", true],
      ["ssh://github.com", true],
      ["httphey", false],
      ["https://hey", true],
    ];
    for (const [url, expected] of cases) {
      const r: boolean = buildfsService["isUrl"](url);
      if (r !== expected) {
        // eslint-disable-next-line no-console
        console.error(`Regex did not match ${url} as expected. Expected: ${expected}, Got: ${r}`);
      }
      expect(r).toBe(expected);
    }
  }),
);

test.concurrent(
  "getExternalFilePathsFromDockerfile",
  testEnv.run(async ({ injector }) => {
    const buildfsService = injector.resolve(Token.BuildfsService);
    const parse = (dockerfile: string) =>
      buildfsService.getExternalFilePathsFromDockerfile(dockerfile).sort();

    expect(parse(DOCKERFILE_1)).toEqual(["./foo"]);
    expect(parse(DOCKERFILE_2)).toEqual(["./foo", "./foo", "/hey", "ho", "../john/johnny"].sort());
    expect(parse(DOCKERFILE_3)).toEqual(["./foo", "./hey/ho"].sort());
    expect(parse(DOCKERFILE_4)).toEqual(["./foo", "/ho"].sort());
    expect(parse(DOCKERFILE_5)).toEqual([]);
    expect(parse(DOCKERFILE_6)).toEqual(
      ["./foo", "/hey", "ho", "../john/johnny", "./so/many/levels/", "heyo"].sort(),
    );
  }),
);

test.concurrent(
  "getSha256FromFiles",
  testEnv.run(async ({ injector, runId }) => {
    const buildfsService = injector.resolve(Token.BuildfsService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const agentConfig = injector.resolve(Token.Config).agent();
    const fcService = injector.resolve(Token.FirecrackerService)(runId);

    const files = [
      { path: "/tmp/foo/foo", content: "foo" },
      { path: "/tmp/foo/bar", content: "foobar" },
      { path: "/tmp/bar/hugo", content: "this is the\nauthor" },
      { path: "/tmp/bar/author", content: "hugo" },
    ] as const;

    const expectedHash = sha256(
      [0, 1, 2]
        .map((i) => sha256(files[i].content))
        .sort()
        .join("\n") + "\n",
    );

    await fcService.withVM(
      {
        ssh: {
          username: "hocus",
          privateKey: agentConfig.prebuildSshPrivateKey,
        },
        kernelPath: agentConfig.defaultKernel,
        rootFsPath: agentConfig.checkoutAndInspectRootFs,
        copyRootFs: true,
        memSizeMib: 1024,
        vcpuCount: 1,
      },
      async ({ ssh }) => {
        await execSshCmd({ ssh }, ["mkdir", "-p", "/tmp/foo"]);
        await execSshCmd({ ssh }, ["mkdir", "-p", "/tmp/bar"]);
        await waitForPromises(
          files.map(({ path, content }) => agentUtilService.writeFile(ssh, path, content)),
        );
        const hash = await buildfsService.getSha256FromFiles(ssh, "/tmp", ["foo", "bar/hugo"]);
        expect(hash).toBe(expectedHash);
      },
    );
  }),
);

import { provideInjector } from "~/agent/test-utils";
import { Token } from "~/token";

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

test.concurrent(
  "isUrl",
  provideInjector(async ({ injector }) => {
    const buildfsService = injector.resolve(Token.BuildfsService);
    const cases: [string, boolean][] = [
      ["https://github.com", true],
      ["http://github.com", true],
      ["github.com", false],
      ["git@github.com", true],
      ["git://github.com", true],
      ["ssh://github.com", true],
      ["httphey", false],
      ["https://hey", false],
    ];
    for (const [url, expected] of cases) {
      expect(buildfsService["isUrl"](url)).toBe(expected);
    }
  }),
);

test.concurrent(
  "getExternalFilePathsFromDockerfile",
  provideInjector(async ({ injector }) => {
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

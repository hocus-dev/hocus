import { Type as t } from "@sinclair/typebox";

export const TaskSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255, description: "Name of the task" }),
  init: t.String({
    minLength: 1,
    description: "Shell command to run during the prebuild phase. For now always runs in bash",
  }),
  commandShell: t.Optional(
    t.Union([t.Literal("bash"), t.Literal("zsh"), t.Literal("ash"), t.Literal("fish")], {
      default: "bash",
      description: "The shell the workspace command will be executed in",
    }),
  ),
  command: t.String({
    minLength: 1,
    description: "Shell command to run after the workspace is started",
  }),
});

export const ProjectConfigSchema = t.Object({
  image: t.Object({
    file: t.String({
      minLength: 1,
      description:
        "Path to a Dockerfile which will be used to build the filesystem for the project",
    }),
    buildContext: t.String({
      minLength: 1,
      description:
        "Path to the directory used as Docker build context, relative to repository root",
    }),
  }),
  tasks: t.Array(TaskSchema),
  vscode: t.Optional(
    t.Object({
      extensions: t.Array(
        t.String({
          minLength: 1,
          description:
            "<publisher>.<name> of the extensions which will be installed in the workspace",
        }),
      ),
    }),
  ),
});

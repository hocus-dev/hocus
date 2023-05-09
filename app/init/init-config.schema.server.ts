import { Type as t } from "@sinclair/typebox";

const String = t.String({ minLength: 1, maxLength: 20000 });

export const InitConfigSchema = t.Object({
  repos: t.Array(
    t.Object({
      url: String,
      publicKey: String,
      privateKey: String,
    }),
  ),
  users: t.Array(
    t.Object({
      externalId: String,
      git: t.Object({
        username: String,
        email: String,
      }),
      publicKeys: t.Array(t.Object({ publicKey: String, name: String })),
    }),
  ),
  projects: t.Array(
    t.Object({
      name: String,
      externalId: String,
      repoUrl: String,
      rootDirectoryPath: String,
      env: t.Object({
        project: t.Record(String, String),
        user: t.Record(String, t.Record(String, String)),
      }),
      config: t.Object({
        maxPrebuildRamMib: t.Integer({ minimum: 1 }),
        maxPrebuildVCPUCount: t.Integer({ minimum: 1 }),
        maxWorkspaceRamMib: t.Integer({ minimum: 1 }),
        maxWorkspaceVCPUCount: t.Integer({ minimum: 1 }),
        maxWorkspaceProjectDriveSizeMib: t.Integer({ minimum: 1 }),
        maxWorkspaceRootDriveSizeMib: t.Integer({ minimum: 1 }),
        maxPrebuildRootDriveSizeMib: t.Integer({ minimum: 1 }),
      }),
    }),
  ),
});

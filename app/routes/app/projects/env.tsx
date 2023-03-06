import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";
import { match } from "ts-pattern";
import { HttpError } from "~/http-error.server";
import { getProjectPath, ProjectPathTabId } from "~/page-paths.shared";
import { EnvFormTarget, ENV_VAR_NAME_REGEX, parseEnvForm } from "~/project/env-form.shared";
import { unwrap, waitForPromises } from "~/utils.shared";

export const action = async ({ context: { db, req, user } }: ActionArgs) => {
  const formData = req.body;
  const { ok, error, data } = parseEnvForm(formData);
  if (!ok) {
    throw new HttpError(StatusCodes.BAD_REQUEST, error);
  }
  await db.$transaction(async () => {
    const project = await db.project.findUnique({
      where: { externalId: data.projectId },
      include: {
        environmentVariableSet: {
          include: { environmentVariables: true },
        },
      },
    });
    if (project == null) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Project not found");
    }
    const envVarSet = await match(data.target)
      .with(EnvFormTarget.USER, async () => {
        const userSet = await db.userProjectEnvironmentVariableSet.upsert({
          // eslint-disable-next-line camelcase
          where: { userId_projectId: { userId: unwrap(user).id, projectId: project.id } },
          create: {
            user: { connect: { id: unwrap(user).id } },
            project: { connect: { id: project.id } },
            environmentSet: { create: {} },
          },
          update: {},
          include: {
            environmentSet: {
              include: { environmentVariables: true },
            },
          },
        });
        return userSet.environmentSet;
      })
      .with(EnvFormTarget.PROJECT, async () => {
        return project.environmentVariableSet;
      })
      .exhaustive();
    const vars = new Map(envVarSet.environmentVariables.map((v) => [v.externalId, v] as const));
    const getVar = (externalId: string) => {
      const v = vars.get(externalId);
      if (v == null) {
        throw new HttpError(StatusCodes.BAD_REQUEST, `Variable with id "${externalId}" not found`);
      }
      return v;
    };
    const varsToDelete = data.delete.map((externalId) => getVar(externalId).id);
    const varsToUpdateName = data.update
      .map((v) => (v.name != null ? { id: getVar(v.externalId).id, name: v.name } : null))
      .filter((v): v is { id: bigint; name: string } => v != null);
    const varsToUpdateValue = data.update
      .map((v) => (v.value != null ? { id: getVar(v.externalId).id, value: v.value } : null))
      .filter((v): v is { id: bigint; value: string } => v != null);
    const varsToCreate = data.create;

    for (const v of [...varsToUpdateName, ...varsToCreate]) {
      if (!ENV_VAR_NAME_REGEX.test(v.name)) {
        throw new HttpError(
          StatusCodes.BAD_REQUEST,
          `Invalid variable name "${v.name}" (must match "${ENV_VAR_NAME_REGEX}")`,
        );
      }
    }

    await db.environmentVariable.deleteMany({
      where: { id: { in: varsToDelete } },
    });
    const updateNamePromises = varsToUpdateName.map((v) =>
      db.environmentVariable.update({ where: { id: v.id }, data: { name: v.name } }),
    );
    const updateValuePromises = varsToUpdateValue.map((v) =>
      db.environmentVariable.update({ where: { id: v.id }, data: { value: v.value } }),
    );
    const createPromises = varsToCreate.map((v) =>
      db.environmentVariable.create({
        data: {
          name: v.name,
          value: v.value,
          environmentVariableSet: { connect: { id: envVarSet.id } },
        },
      }),
    );
    await waitForPromises([...updateNamePromises, ...updateValuePromises, ...createPromises]);
  });
  return redirect(getProjectPath(data.projectId, ProjectPathTabId.ENVIRONMENT));
};

export default function EditEnv() {
  // this function exists because otherwise an error page
  // would not be rendered if the action threw
  return null;
}

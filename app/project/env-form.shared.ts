import type { valueof } from "~/types/utils";

export const NEW_ENV_VAR_NAME_PREFIX = "new-";
export const UPDATE_ENV_VAR_NAME_PREFIX = "update-env-name-";
export const UPDATE_ENV_VAR_VALUE_PREFIX = "update-env-value-";
export const DELETE_ENV_VAR_PREFIX = "delete-env-";

export const createEnvFormNameId = (envVarExternalId: string) =>
  `${UPDATE_ENV_VAR_NAME_PREFIX}${envVarExternalId}` as const;
export const createEnvFormValueId = (envVarExternalId: string) =>
  `${UPDATE_ENV_VAR_VALUE_PREFIX}${envVarExternalId}` as const;
export const createEnvFormDeleteId = (envVarExternalId: string) =>
  `${DELETE_ENV_VAR_PREFIX}${envVarExternalId}` as const;

type ExternalIdPart = { new: boolean; envVarExternalId: string };

export type EnvFormTarget = valueof<typeof EnvFormTarget>;
export const EnvFormTarget = {
  USER: "user",
  PROJECT: "project",
} as const;

export type EnvFormField =
  | ({
      type: "name";
      name: string;
    } & ExternalIdPart)
  | ({
      type: "value";
      value: string;
    } & ExternalIdPart)
  | {
      type: "delete";
      envVarExternalId: string;
    }
  | {
      type: "project-id";
      projectExternalId: string;
    }
  | { type: "target"; target: EnvFormTarget };

export const parseEnvFormField = (name: string, value: string): EnvFormField | null => {
  if (name.startsWith(UPDATE_ENV_VAR_NAME_PREFIX)) {
    const externalId = name.slice(UPDATE_ENV_VAR_NAME_PREFIX.length);
    const isNew = externalId.startsWith(NEW_ENV_VAR_NAME_PREFIX);
    return {
      type: "name",
      name: value,
      new: isNew,
      envVarExternalId: externalId,
    };
  } else if (name.startsWith(UPDATE_ENV_VAR_VALUE_PREFIX)) {
    const externalId = name.slice(UPDATE_ENV_VAR_VALUE_PREFIX.length);
    const isNew = externalId.startsWith(NEW_ENV_VAR_NAME_PREFIX);
    return {
      type: "value",
      value,
      new: isNew,
      envVarExternalId: externalId,
    };
  } else if (name.startsWith(DELETE_ENV_VAR_PREFIX)) {
    const externalId = name.slice(DELETE_ENV_VAR_PREFIX.length);
    return { type: "delete", envVarExternalId: externalId };
  } else if (name === "project-id") {
    return { type: "project-id", projectExternalId: value };
  } else if (name === "target") {
    if (value !== "user" && value !== "project") {
      return null;
    }
    return { type: "target", target: value };
  }
  return null;
};

interface EnvFormData {
  delete: string[];
  create: { name: string; value: string }[];
  update: { name?: string; value?: string; externalId: string }[];
  projectId: string;
  target: EnvFormTarget;
}

export const parseEnvForm = (
  form: Record<string, string>,
):
  | { ok: true; data: EnvFormData; error?: undefined }
  | { ok: false; data?: undefined; error: string } => {
  const fields = Object.entries(form)
    .map(([name, value]) => parseEnvFormField(name, value))
    .filter((field): field is EnvFormField => field !== null);
  let projectId: string | null = null;
  let target: EnvFormTarget | null = null;
  const idsToDelete: string[] = [];
  const idsToUpdate = new Map<string, { name?: string; value?: string }>();
  const idsToCreate = new Map<string, { name?: string; value?: string }>();

  for (const field of fields) {
    if (field.type === "delete") {
      idsToDelete.push(field.envVarExternalId);
    } else if (field.type === "name") {
      const map = field.new ? idsToCreate : idsToUpdate;
      const value = map.get(field.envVarExternalId) ?? {};
      value.name = field.name;
      map.set(field.envVarExternalId, value);
    } else if (field.type === "value") {
      const map = field.new ? idsToCreate : idsToUpdate;
      const value = map.get(field.envVarExternalId) ?? {};
      value.value = field.value;
      map.set(field.envVarExternalId, value);
    } else if (field.type === "project-id") {
      projectId = field.projectExternalId;
    } else if (field.type === "target") {
      target = field.target;
    }
  }
  if (projectId === null) {
    return { ok: false, error: "Missing project id" };
  }
  if (target === null) {
    return { ok: false, error: "Missing target" };
  }
  for (const [_, { name, value }] of idsToCreate) {
    if (name === void 0 || value === void 0) {
      return { ok: false, error: "Missing name or value for new env var" };
    }
  }

  return {
    ok: true,
    data: {
      projectId,
      target,
      delete: idsToDelete,
      create: Array.from(idsToCreate.values()) as any,
      update: Array.from(idsToUpdate.entries()).map(([externalId, { name, value }]) => ({
        externalId,
        name,
        value,
      })) as any,
    },
  };
};

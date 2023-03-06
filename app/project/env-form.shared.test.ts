import type { EnvFormField } from "./env-form.shared";
import { parseEnvForm } from "./env-form.shared";
import {
  createEnvFormDeleteId,
  createEnvFormNameId,
  createEnvFormValueId,
  NEW_ENV_VAR_NAME_PREFIX,
  parseEnvFormField,
} from "./env-form.shared";

const cases: { key: string; value: string; expected: EnvFormField | null }[] = [
  {
    key: createEnvFormNameId("1"),
    value: "name1",
    expected: {
      type: "name",
      name: "name1",
      new: false,
      envVarExternalId: "1",
    },
  },
  {
    key: createEnvFormValueId("1"),
    value: "value1",
    expected: {
      type: "value",
      value: "value1",
      new: false,
      envVarExternalId: "1",
    },
  },
  {
    key: createEnvFormNameId(`${NEW_ENV_VAR_NAME_PREFIX}1`),
    value: "new-name-1",
    expected: {
      type: "name",
      name: "new-name-1",
      new: true,
      envVarExternalId: `${NEW_ENV_VAR_NAME_PREFIX}1`,
    },
  },
  {
    key: createEnvFormValueId(`${NEW_ENV_VAR_NAME_PREFIX}1`),
    value: "new-value-1",
    expected: {
      type: "value",
      value: "new-value-1",
      new: true,
      envVarExternalId: `${NEW_ENV_VAR_NAME_PREFIX}1`,
    },
  },
  {
    key: createEnvFormDeleteId("1"),
    value: "yes",
    expected: {
      type: "delete",
      envVarExternalId: "1",
    },
  },
  {
    key: "project-id",
    value: "project-1",
    expected: {
      type: "project-id",
      projectExternalId: "project-1",
    },
  },
  {
    key: "target",
    value: "user",
    expected: {
      type: "target",
      target: "user",
    },
  },
  {
    key: "xd",
    value: "yo",
    expected: null,
  },
];

test("parseEnvFormField", () => {
  for (const { key, value, expected } of cases) {
    expect(parseEnvFormField(key, value)).toEqual(expected);
  }
});

test("parseEnvForm", () => {
  const form: Record<string, string> = {};
  for (const { key, value } of cases) {
    form[key] = value;
  }
  const result = parseEnvForm(form);
  expect(result).toEqual({
    ok: true,
    data: {
      delete: ["1"],
      create: [
        {
          name: "new-name-1",
          value: "new-value-1",
        },
      ],
      update: [
        {
          name: "name1",
          value: "value1",
          externalId: "1",
        },
      ],
      projectId: "project-1",
      target: "user",
    },
  });
  delete form["project-id"];
  expect(parseEnvForm(form)).toEqual({
    ok: false,
    error: "Missing project id",
  });
  form["project-id"] = "project-1";
  delete form["target"];
  expect(parseEnvForm(form)).toEqual({
    ok: false,
    error: "Missing target",
  });
  form["target"] = "xd";
  expect(parseEnvForm(form)).toEqual({
    ok: false,
    error: "Missing target",
  });
});

import type { Static, TSchema } from "@sinclair/typebox";
import { Type as t } from "@sinclair/typebox";
import type { Any } from "ts-toolbelt";

import { compileSchema } from "~/schema/utils.server";
import { UuidSchema } from "~/schema/uuid.schema.server";
import type { valueof } from "~/types/utils";

export const TEST_STATE_MANAGER_REQUEST_TAG = {
  TEST_START: "TEST_STATE_MANAGER_REQUEST_TAG_TEST_START",
  TEST_END: "TEST_STATE_MANAGER_REQUEST_TAG_TEST_END",
  REQUEST_LOGS_FILE: "TEST_STATE_MANAGER_REQUEST_LOGS_FILE",
} as const;
export type TEST_STATE_MANAGER_REQUEST_TAG = valueof<typeof TEST_STATE_MANAGER_REQUEST_TAG>;

const mkResponseSchema = <
  ResponseSchemaT extends TSchema,
  RequestTagT extends TEST_STATE_MANAGER_REQUEST_TAG,
>(
  requestTag: RequestTagT,
  responseSchema: ResponseSchemaT,
) =>
  t.Object({
    requestTag: t.Literal(requestTag),
    requestId: UuidSchema,
    response: responseSchema,
  });

const mkRequestSchema = <
  RequestSchemaT extends TSchema,
  RequestTagT extends TEST_STATE_MANAGER_REQUEST_TAG,
>(
  requestTag: RequestTagT,
  requestSchema: RequestSchemaT,
) => t.Object({ requestTag: t.Literal(requestTag), requestId: UuidSchema, request: requestSchema });

const RequestSchema = t.Union([
  mkRequestSchema(
    TEST_STATE_MANAGER_REQUEST_TAG.TEST_START,
    t.Object({
      runId: UuidSchema,
    }),
  ),
  mkRequestSchema(
    TEST_STATE_MANAGER_REQUEST_TAG.TEST_END,
    t.Object({
      runId: UuidSchema,
      testFailed: t.Boolean(),
    }),
  ),
  mkRequestSchema(
    TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_LOGS_FILE,
    t.Object({
      runId: UuidSchema,
    }),
  ),
]);

const OkResponseSchema = t.Union([
  mkResponseSchema(TEST_STATE_MANAGER_REQUEST_TAG.TEST_START, t.Object({})),
  mkResponseSchema(TEST_STATE_MANAGER_REQUEST_TAG.TEST_END, t.Object({})),
  mkResponseSchema(
    TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_LOGS_FILE,
    t.Object({ path: t.String() }),
  ),
]);

const ErrorResponseSchema = t.Object({
  requestId: t.Optional(UuidSchema),
  error: t.Any(),
});

const ResponseSchema = t.Union([OkResponseSchema, ErrorResponseSchema]);

export type TestStateManagerRequest = Any.Compute<Static<typeof RequestSchema>>;
export const TestStateManagerRequestValidator = compileSchema(RequestSchema);

export type TestStateManagerResponse = Any.Compute<Static<typeof ResponseSchema>>;
export const TestStateManagerResponseValidator = compileSchema(ResponseSchema);

// If this typecheck fails then you're missing some schemas in the request
const _typeCheckRequest: Any.Equals<
  TestStateManagerRequest["requestTag"],
  TEST_STATE_MANAGER_REQUEST_TAG
> = 1;

// If this typecheck fails then you're missing some schemas in the response
type TestStateManagerOkResponse = Any.Compute<Static<typeof OkResponseSchema>>;
const _typeCheckResponse: Any.Equals<
  TestStateManagerOkResponse["requestTag"],
  TEST_STATE_MANAGER_REQUEST_TAG
> = 1;

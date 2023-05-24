import type { TSchema, Static } from "@sinclair/typebox";
import type { TypeCheck, ValueError } from "@sinclair/typebox/compiler";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import type { Any } from "ts-toolbelt";

import { AdditionalFormats } from "./additional-formats.server";

AdditionalFormats.Configure();

type SchemaValueType<T extends TSchema> = Any.Compute<Static<T>>;
export type Validator<T extends TSchema> = TypeCheck<T> & {
  Parse: typeof parse<T>;
  SafeParse: typeof safeParse<T>;
};

export class ValidationError extends Error {
  public readonly errors: ValueError[];

  constructor(errors: IterableIterator<ValueError>) {
    const errorsArray = Array.from(errors);
    const message = errorsArray.map((error) => `${error.path}: ${error.message}`).join("\n");
    super(message);
    this.name = this.constructor.name;
    this.errors = errorsArray;
  }
}

/**
 * Checks the given value against the given schema and returns the parsed value.
 * Throws an error if the value does not match the schema.
 */
function parse<T extends TSchema>(this: TypeCheck<T>, value: unknown): SchemaValueType<T> {
  if (this.Check(value)) {
    return value as SchemaValueType<T>;
  }
  throw new ValidationError(this.Errors(value)[Symbol.iterator]());
}

/**
 * Checks the given value against the given schema and returns the parsed value.
 * Returns an error if the value does not match the schema.
 */
function safeParse<T extends TSchema>(
  this: TypeCheck<T>,
  value: unknown,
):
  | { success: true; value: SchemaValueType<T>; error?: undefined }
  | { success: false; value?: undefined; error: ValidationError } {
  if (this.Check(value)) {
    return { success: true, value: value as SchemaValueType<T> };
  }
  return { success: false, error: new ValidationError(this.Errors(value)[Symbol.iterator]()) };
}

export const compileSchema = <T extends TSchema>(schema: T): Validator<T> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typeCheck = TypeCompiler.Compile(schema) as any;
  typeCheck.Parse = parse.bind(typeCheck);
  typeCheck.SafeParse = safeParse.bind(typeCheck);
  return typeCheck as Validator<T>;
};

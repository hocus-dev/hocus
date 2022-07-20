// adapted from https://github.com/cjenaro/superjson-remix/blob/ea13038f814fc1e5aa0713391ad2ec1a6724c715/src/index.tsx
import type { HtmlMetaDescriptor } from "@remix-run/react";
import {
  useLoaderData as useRemixLoaderData,
  useActionData as useRemixActionData,
} from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { json as remixJson } from "@remix-run/node";
import { serialize, deserialize } from "superjson";
import type { SuperJSONResult } from "superjson/dist/types";

declare type TypedResponse<T> = Response & {
  json(): Promise<T>;
};
declare type AppData = any;
declare type DataFunction = (...args: any[]) => unknown;
declare type DataOrFunction = AppData | DataFunction;
declare type JsonPrimitives =
  | string
  | number
  | boolean
  | String
  | Number
  | Boolean
  | null
  | bigint
  | Date;
declare type NonJsonPrimitives = undefined | Function | symbol;
declare type SerializeType<T> = T extends JsonPrimitives
  ? T
  : T extends NonJsonPrimitives
  ? never
  : T extends {
      toJSON(): infer U;
    }
  ? U
  : T extends []
  ? []
  : T extends [unknown, ...unknown[]]
  ? {
      [k in keyof T]: T[k] extends NonJsonPrimitives ? null : SerializeType<T[k]>;
    }
  : T extends (infer U)[]
  ? (U extends NonJsonPrimitives ? null : SerializeType<U>)[]
  : T extends object
  ? {
      [k in keyof T as T[k] extends NonJsonPrimitives ? never : k]: SerializeType<T[k]>;
    }
  : never;
declare type UseDataFunctionReturn<T extends DataOrFunction> = T extends (
  ...args: any[]
) => infer Output
  ? Awaited<Output> extends TypedResponse<infer U>
    ? SerializeType<U>
    : SerializeType<Awaited<ReturnType<T>>>
  : SerializeType<Awaited<T>>;
declare function useLoaderDataType<T = AppData>(): UseDataFunctionReturn<T>;
declare function useActionDataType<T = AppData>(): UseDataFunctionReturn<T> | undefined;

type JsonResponse = ReturnType<typeof remixJson>;
type MetaArgs = Parameters<MetaFunction>[0];
type MetaArgsSansData = Omit<MetaArgs, "data">;

type SuperJSONMetaFunction<Data> = {
  (args: MetaArgsSansData & { data: Data }): HtmlMetaDescriptor;
};

export const json: typeof remixJson = <Data>(
  obj: Data,
  init?: number | ResponseInit,
): JsonResponse => {
  const superJsonResult = serialize(obj);
  return remixJson(superJsonResult, init);
};

export const parse = <Data>(superJsonResult: SuperJSONResult) =>
  deserialize(superJsonResult) as Data;

export const withSuperJSON =
  <Data>(metaFn: MetaFunction): SuperJSONMetaFunction<Data> =>
  ({ data, ...rest }: MetaArgs): HtmlMetaDescriptor =>
    metaFn({ ...rest, data: parse<Data>(data) });

export const useLoaderData: typeof useLoaderDataType = <Data>() => {
  const loaderData = useRemixLoaderData<SuperJSONResult>();
  return parse<Data>(loaderData);
};

export const useActionData: typeof useActionDataType = <Data>() => {
  const actionData = useRemixActionData<SuperJSONResult>();
  if (actionData) {
    return parse<Data>(actionData);
  }
  return;
};

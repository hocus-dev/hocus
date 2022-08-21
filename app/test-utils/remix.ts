/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LoaderArgs, ActionArgs, TypedResponse } from "@remix-run/node";
import { parse } from "superjson";

import { provideDb } from "./db";

const provideArgs = (
  testFn: (args: LoaderArgs | ActionArgs) => Promise<void>,
): (() => Promise<void>) => {
  return provideDb(async (db) => {
    const args: LoaderArgs | ActionArgs = {
      request: null as any,
      context: { db },
      params: null as any,
    };
    await testFn(args);
  });
};

export const provideLoaderArgs: (
  testFn: (args: LoaderArgs) => Promise<void>,
) => () => Promise<void> = provideArgs;
export const provideActionArgs: (
  testFn: (args: ActionArgs) => Promise<void>,
) => () => Promise<void> = provideArgs;

export const parseRemixData = async <T>(response: Promise<TypedResponse<T>>): Promise<T> => {
  return parse(await (await response).text());
};

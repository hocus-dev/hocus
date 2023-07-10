import type { List, Function, Object } from "ts-toolbelt";

import { BlockRegistryService } from "./registry.service";
import type { EXPOSE_METHOD, ContainerId, ImageId } from "./registry.service";

import { waitForPromises } from "~/utils.shared";

const _expose: BlockRegistryService["expose"] = null as any;
type ExposeResult<M extends EXPOSE_METHOD> = Awaited<ReturnType<typeof _expose<M>>>;

export const withExposedImage = async <M extends EXPOSE_METHOD, T>(
  service: BlockRegistryService,
  id: ImageId | ContainerId,
  method: M,
  innerFn: (exposed: ExposeResult<M>) => Promise<T>,
  opts: { shouldHide: boolean } = { shouldHide: true },
): Promise<T> => {
  const exposed = await service.expose(id, method);
  try {
    return await innerFn(exposed as any);
  } finally {
    if (opts.shouldHide) {
      await service.hide(id);
    }
  }
};

type MapExposeArgsToResults<T> = T extends readonly [...infer _Rest]
  ? Object.ListOf<{
      [K in List.CompulsoryKeys<T>]: T[K] extends readonly [infer _1, infer M]
        ? M extends EXPOSE_METHOD
          ? ExposeResult<M>
          : never
        : never;
    }>
  : never;
type ExposeParams = Parameters<typeof _expose>;

const withExposedImagesInner = async <T>(
  service: BlockRegistryService,
  idx: number,
  exposeArgs: ExposeParams[],
  results: unknown[],
  innerFn: (exposed: unknown[]) => Promise<T>,
  opts: { shouldHide: boolean } = { shouldHide: true },
): Promise<T> => {
  if (idx >= exposeArgs.length) {
    return await innerFn(results);
  }
  return withExposedImage(
    service,
    ...exposeArgs[idx],
    async (exposed) => {
      results.push(exposed);
      return withExposedImagesInner(service, idx + 1, exposeArgs, results, innerFn, opts);
    },
    opts,
  );
};

export const withExposedImages = async <
  R,
  T extends Readonly<Readonly<ExposeParams>[]>,
  Args = Function.Narrow<T>,
>(
  service: BlockRegistryService,
  exposeArgs: T,
  innerFn: (exposed: MapExposeArgsToResults<Args>) => Promise<R>,
  opts: { shouldHide: boolean } = { shouldHide: true },
): Promise<R> => {
  return withExposedImagesInner(service, 0, exposeArgs as any, [], innerFn as any, opts);
};

export const getTagLockFile = (id: string) => `/tmp/tag-${id}.lock`;

export const removeContentWithPrefix = async (brService: BlockRegistryService, prefix: string) => {
  const content = await brService.listContent();
  const toRemove = content.filter((c) =>
    BlockRegistryService.extractOutputId(c).startsWith(prefix),
  );
  await waitForPromises(toRemove.map((c) => brService.removeContent(c)));
};

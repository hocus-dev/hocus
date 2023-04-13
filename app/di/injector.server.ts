// We have a custom injector because we used to use https://github.com/nicojs/typed-inject
// and ran into insurmountable performance issues - https://github.com/nicojs/typed-inject/issues/50.
// This injector is less type-safe, but much faster. It also has a similar API.

import { match } from "ts-pattern";
import type { Any } from "ts-toolbelt";

import { InjectValidator } from "./inject.validator.server";

import type { valueof } from "~/types/utils";

export type Scope = valueof<typeof Scope>;
export const Scope = {
  Transient: "transient",
  Singleton: "singleton",
} as const;

export type Provide<V> =
  | { value: V; class?: undefined; factory?: undefined }
  | { class: new (...args: any[]) => V; value?: undefined; factory?: undefined }
  | { factory: (...args: any[]) => V; value?: undefined; class?: undefined };

export type ProviderValue<P> = P extends Provider<infer _, infer V> ? V : never;

export type Provider<T extends string, V> = {
  token: T;
  scope?: Scope;
  provide: Provide<V>;
};

export type GenericProviderMap<T> = T extends {
  [key in keyof T]: Provider<infer _1, infer _2>;
}
  ? {
      [K in keyof T & string as T[K]["token"]]: T[K]["provide"] extends Provide<infer V>
        ? V
        : never;
    }
  : never;

export type ProvidersFns<T> = T extends { [_1 in keyof T]: infer _2 }
  ? { [K in keyof T]: () => T[K] }
  : never;

export type ProvidersOverrides<T> = T extends { [_1 in keyof T]: Provider<infer _2, infer _3> }
  ? { [K in keyof T & string as T[K]["token"]]?: Omit<Provider<"", ProviderValue<T[K]>>, "token"> }
  : never;

type ResolveResult<T, K extends keyof T> = T extends { [_1 in keyof T]: infer _2 }
  ? Any.Equals<T[K], unknown> extends 0
    ? T[K]
    : never
  : never;

export class Injector<T, M extends GenericProviderMap<T>, P extends ProvidersFns<M>> {
  private providers: P;

  private getInject<Tn extends string, Val>(provider: Provider<Tn, Val>): string[] | undefined {
    const provide = provider.provide;
    let inject: unknown = void 0;
    if (provide.class != null) {
      inject = (provide.class as any).inject;
    } else if (provide.factory != null) {
      inject = (provide.factory as any).inject;
    } else if (provide.value != null) {
      inject = void 0;
    }
    const { success, value } = InjectValidator.SafeParse(inject);
    if (!success) {
      throw new Error(`Invalid inject value for provider ${provider.token}`);
    }
    return value;
  }

  constructor(providersArg: T) {
    const providers = providersArg as any as Provider<string, null>[];
    const local = {} as Record<string, () => any>;

    for (const provider of providers) {
      const inject = this.getInject(provider);
      const paramFns: (() => any)[] = [];
      if (inject != null) {
        for (const token of inject) {
          const dependencyProvider = local[token];
          if (dependencyProvider == null) {
            throw new Error(`Missing dependency ${token} for provider ${provider.token}`);
          }
          paramFns.push(dependencyProvider);
        }
      }

      const getValue = (p: Provider<string, null>) => {
        const provide = p.provide as any;
        if (provide.class != null) {
          return new provide.class(...paramFns.map((fn) => fn()));
        } else if (provide.factory != null) {
          return provide.factory(...paramFns.map((fn) => fn()));
        } else if (provide.value != null) {
          return provide.value;
        }
        throw new Error(`Invalid provide value for provider ${p.token}`);
      };

      match((provider.scope ?? Scope.Singleton) as Scope)
        .with(Scope.Transient, () => {
          local[provider.token] = () => getValue(provider);
        })
        .with(Scope.Singleton, () => {
          const value = getValue(provider);
          local[provider.token] = () => value;
        })
        .exhaustive();
    }
    this.providers = local as any;
  }

  resolve<K extends keyof M & string>(token: K): ResolveResult<M, K> {
    const provider = this.providers[token];
    if (provider == null) {
      throw new Error(`Missing provider for token ${String(token)}`);
    }
    return provider() as any;
  }

  dispose() {
    // currently does nothing
  }
}

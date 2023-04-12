import { match } from "ts-pattern";
import type { Union } from "ts-toolbelt";

import { InjectValidator } from "./inject.validator.server";

import type { valueof } from "~/types/utils";

export type Scope = valueof<typeof Scope>;
export const Scope = {
  Transient: "transient",
  Singleton: "singleton",
} as const;

export type Provider<T extends string, V> = {
  token: T;
  scope?: Scope;
  provide: { value: V } | { class: new (...args: any[]) => V } | { factory: () => V };
};

type ProvidersArray<T> = T extends { [_1 in keyof T & string]: infer _2 }
  ? Union.ListOf<valueof<{ [K in keyof T & string]: Provider<K, T[K]> }>>
  : never;

type Providers<T> = T extends { [_1 in keyof T]: infer _2 }
  ? { [K in keyof T]: () => T[K] }
  : never;

type ResolveResult<T, K extends keyof T> = T extends { [_1 in keyof T & string]: infer _2 }
  ? T[K]
  : never;

export class Injector<T> {
  private providers: Providers<T>;

  constructor(providersArg: ProvidersArray<T>) {
    const providers = providersArg as any as Provider<string, null>[];
    const local = {} as Record<string, () => any>;

    for (const provider of providers) {
      const { success, value: inject } = InjectValidator.SafeParse(
        (provider.provide as any)?.inject,
      );
      if (!success) {
        throw new Error(`Invalid inject value for provider ${provider.token}`);
      }

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

  resolve<K extends keyof T>(token: K): ResolveResult<T, K> {
    const provider = this.providers[token];
    if (provider == null) {
      throw new Error(`Missing provider for token ${String(token)}`);
    }
    return provider() as any;
  }
}

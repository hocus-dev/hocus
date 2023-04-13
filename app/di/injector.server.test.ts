/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-useless-constructor */

import { randomUUID } from "crypto";

import { Injector, Scope } from "./injector.server";

const token = {
  a: "a",
  b: "b",
  c: "c",
  d: "d",
  e: "e",
  f: "f",
} as const;

class Test1 {
  static inject = [token.a, token.b] as const;
  constructor(public a: number, public b: number) {}
}

const testFactory = (d: string, e: string): string => `${e} ${d}`;
testFactory.inject = [token.d, token.e] as const;

test("injector", () => {
  const providers = [
    { token: token.a, provide: { value: 1 } },
    { token: token.b, provide: { factory: () => 2 as const } },
    { token: token.c, provide: { class: Test1 } },
    { token: token.d, provide: { factory: () => randomUUID() }, scope: Scope.Transient },
    { token: token.e, provide: { factory: () => randomUUID() } },
    { token: token.f, provide: { factory: testFactory }, scope: Scope.Transient },
  ] as const;
  const injector = new Injector(providers);
  expect(injector.resolve("a")).toBe(1);
  expect(injector.resolve("b")).toBe(2);
  const c = injector.resolve("c");
  expect(c instanceof Test1).toBe(true);
  expect(c.a).toBe(1);
  expect(c.b).toBe(2);
  expect(() => injector.resolve("invalid")).toThrow();
  const d1 = injector.resolve("d");
  const d2 = injector.resolve("d");
  expect(d1).not.toBe(d2);
  const e1 = injector.resolve("e");
  const e2 = injector.resolve("e");
  expect(e1).toBe(e2);
  const f1 = injector.resolve("f");
  const f2 = injector.resolve("f");
  expect(f1).not.toBe(f2);
  expect(f1.startsWith(e1)).toBe(true);
  expect(f2.startsWith(e1)).toBe(true);
});

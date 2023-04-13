/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-useless-constructor */

import { Injector } from "./injector.server";

const token = {
  a: "a",
  b: "b",
  c: "c",
} as const;

class Test1 {
  static inject = [token.a, token.b] as const;
  constructor(public a: number, public b: number) {}
}

test("injector", () => {
  const providers = [
    { token: token.a, provide: { value: 1 } },
    { token: token.b, provide: { factory: () => 2 as const } },
    { token: token.c, provide: { class: Test1 } },
  ] as const;
  const injector = new Injector(providers);
  expect(injector.resolve("a")).toBe(1);
  expect(injector.resolve("b")).toBe(2);
  const c = injector.resolve("c");
  expect(c instanceof Test1).toBe(true);
  expect(c.a).toBe(1);
  expect(c.b).toBe(2);
  expect(() => injector.resolve("invalid")).toThrow();
});

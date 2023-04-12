import { Injector } from "./injector.server";

class Test1 {}

test("injector", () => {
  const injector = new Injector<{ a: 1; b: 2; c: 3 }>([
    { token: "a", provide: { value: 1 } },
    { token: "b", provide: { factory: () => 2 } },
    { token: "c", provide: { value: 3 } },
  ]);
  expect(injector.resolve("a")).toBe(1);
  expect(injector.resolve("b")).toBe(2);
  expect(injector.resolve("c")).toBe(3);
});

import * as sinon from "ts-sinon";
import type { Class } from "ts-toolbelt";

export const constructorStub = <T extends Class.Class>(ctor: T) =>
  function () {
    return sinon.stubConstructor(ctor);
  } as unknown as T;

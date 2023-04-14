import { ArbitraryKeyMap } from "./arbitrary-key-map.server";

import { numericSort } from "~/utils.shared";

test("ArbitraryKeyMap", () => {
  const big = (n: number) => BigInt(n);
  const map = new ArbitraryKeyMap<[bigint, { a: bigint }], number>(
    ([k1, { a: k2 }]) => `${k1}-${k2}`,
  );
  map
    .set([big(1), { a: big(2) }], 3)
    .set([big(4), { a: big(5) }], 6)
    .set([big(7), { a: big(8) }], 9);

  expect(map.get([big(1), { a: big(2) }])).toBe(3);
  expect(map.get([big(4), { a: big(5) }])).toBe(6);
  expect(map.get([big(7), { a: big(8) }])).toBe(9);
  expect(map.get([big(1), { a: big(14) }])).toBeUndefined();

  map.set([big(1), { a: big(2) }], 15);
  expect(map.get([big(1), { a: big(2) }])).toBe(15);

  expect(map.size).toBe(3);
  expect(map.keys().sort(([a, _a], [b, _b]) => numericSort(a, b))).toEqual([
    [big(1), { a: big(2) }],
    [big(4), { a: big(5) }],
    [big(7), { a: big(8) }],
  ]);
  expect(map.values().sort(numericSort)).toEqual([6, 9, 15]);

  expect(map.has([big(1), { a: big(2) }])).toBe(true);
  expect(map.has([big(1), { a: big(3) }])).toBe(false);
  expect(map.delete([big(1), { a: big(2) }])).toBe(true);
  expect(map.delete([big(1), { a: big(2) }])).toBe(false);

  map.clear();
  expect(map.size).toBe(0);
});

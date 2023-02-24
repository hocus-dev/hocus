import { encode } from "cbor-x";

class CompositeKeyMap<K, V> {
  private map = new Map<Buffer, V>();

  private keyToString(key: K): string {}

  set(key: K, value: V): this {
    this.map.set(JSON.stringify(key), value);
    return this;
  }

  get(key: K): number | undefined {
    return this.map.get(JSON.stringify(key));
  }

  clear() {
    this.map.clear();
  }

  delete(key: K): boolean {
    return this.map.delete(JSON.stringify(key));
  }

  has(key: K): boolean {
    return this.map.has(JSON.stringify(key));
  }

  get size() {
    return this.map.size;
  }

  forEach(callbackfn: (value: number, key: K, map: Map<K, number>) => void, thisArg?: any): void {
    this.map.forEach((value, key) => {
      callbackfn.call(thisArg, value, JSON.parse(key), this);
    });
  }
}

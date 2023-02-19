/**
 * Works like a Map, but allows any object to be used as a key.
 */
export class ArbitraryKeyMap<K, V> {
  private map = new Map<string, [K, V]>();

  constructor(private readonly keyToString: (key: K) => string) {}

  set(key: K, value: V): this {
    this.map.set(this.keyToString(key), [key, value]);
    return this;
  }

  get(key: K): V | undefined {
    return this.map.get(this.keyToString(key))?.[1];
  }

  clear() {
    this.map.clear();
  }

  delete(key: K): boolean {
    return this.map.delete(this.keyToString(key));
  }

  has(key: K): boolean {
    return this.map.has(this.keyToString(key));
  }

  get size() {
    return this.map.size;
  }

  keys(): K[] {
    return Array.from(this.map.values()).map(([key, _]) => key);
  }

  values(): V[] {
    return Array.from(this.map.values()).map(([_, value]) => value);
  }

  /**
   * @returns an array of value pairs sorted by their keys
   */
  sortedValues(): V[] {
    return Array.from(this.map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_1, [_2, value]]) => value);
  }
}

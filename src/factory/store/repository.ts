export type Indexable = { id: string; tenantId?: string };

export class Repository<T extends Indexable> {
  private items = new Map<string, T>();

  create(item: T): T {
    if (this.items.has(item.id)) {
      throw new Error(`duplicate id: ${item.id}`);
    }
    this.items.set(item.id, structuredClone(item));
    return structuredClone(item);
  }

  upsert(item: T): T {
    this.items.set(item.id, structuredClone(item));
    return structuredClone(item);
  }

  get(id: string): T | undefined {
    const found = this.items.get(id);
    return found ? structuredClone(found) : undefined;
  }

  require(id: string): T {
    const found = this.get(id);
    if (!found) throw new Error(`not found: ${id}`);
    return found;
  }

  update(id: string, updater: (cur: T) => T): T {
    const current = this.items.get(id);
    if (!current) throw new Error(`not found: ${id}`);
    const next = updater(structuredClone(current));
    if (next.id !== id) throw new Error('id mismatch on update');
    this.items.set(id, structuredClone(next));
    return structuredClone(next);
  }

  delete(id: string): void {
    this.items.delete(id);
  }

  all(filter?: Partial<T>): T[] {
    const items = Array.from(this.items.values());
    const filtered = filter
      ? items.filter((it) =>
          Object.entries(filter).every(([k, v]) => (it as Record<string, unknown>)[k] === v),
        )
      : items;
    return filtered.map((it) => structuredClone(it));
  }

  find(predicate: (it: T) => boolean): T[] {
    return this.all().filter(predicate);
  }

  size(): number {
    return this.items.size;
  }

  reset(): void {
    this.items.clear();
  }
}

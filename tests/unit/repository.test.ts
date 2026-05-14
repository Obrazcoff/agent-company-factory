import { describe, it, expect } from 'vitest';
import { Repository } from '@/factory/store/repository';

type Item = { id: string; tenantId?: string; name: string; n: number };

describe('Repository', () => {
  it('create / get / require / update / delete', () => {
    const repo = new Repository<Item>();
    repo.create({ id: 'a', name: 'A', n: 1 });
    expect(repo.get('a')?.name).toBe('A');
    expect(repo.require('a').n).toBe(1);

    repo.update('a', (cur) => ({ ...cur, n: 2 }));
    expect(repo.get('a')?.n).toBe(2);

    repo.delete('a');
    expect(repo.get('a')).toBeUndefined();
  });

  it('rejects duplicate id on create', () => {
    const repo = new Repository<Item>();
    repo.create({ id: 'a', name: 'A', n: 1 });
    expect(() => repo.create({ id: 'a', name: 'B', n: 9 })).toThrow(/duplicate/);
  });

  it('upsert overwrites without throwing', () => {
    const repo = new Repository<Item>();
    repo.upsert({ id: 'a', name: 'A', n: 1 });
    repo.upsert({ id: 'a', name: 'A2', n: 9 });
    expect(repo.get('a')?.name).toBe('A2');
  });

  it('all() filter by tenantId', () => {
    const repo = new Repository<Item>();
    repo.create({ id: '1', tenantId: 't1', name: 'x', n: 1 });
    repo.create({ id: '2', tenantId: 't2', name: 'y', n: 2 });
    repo.create({ id: '3', tenantId: 't1', name: 'z', n: 3 });
    expect(
      repo
        .all({ tenantId: 't1' })
        .map((i) => i.id)
        .sort(),
    ).toEqual(['1', '3']);
  });

  it('returns deep clones (no external mutation)', () => {
    const repo = new Repository<Item>();
    repo.create({ id: 'a', name: 'A', n: 1 });
    const got = repo.require('a');
    got.n = 999;
    expect(repo.require('a').n).toBe(1);
  });
});

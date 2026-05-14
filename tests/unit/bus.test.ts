import { describe, it, expect, beforeEach } from 'vitest';
import { bus, resetBus } from '@/factory/events/bus';
import type { FactoryEvent } from '@/factory/events/types';

describe('EventBus', () => {
  beforeEach(() => resetBus());

  it('subscribe by kind, publish triggers handler', () => {
    const got: FactoryEvent[] = [];
    bus().on('task.enqueued', (e) => got.push(e));
    bus().publish({ kind: 'task.enqueued', companyId: 'co1', ts: '2026', payload: {} });
    bus().publish({ kind: 'task.done', companyId: 'co1', ts: '2026', payload: {} });
    expect(got).toHaveLength(1);
  });

  it('onAny receives all events', () => {
    const got: FactoryEvent[] = [];
    bus().onAny((e) => got.push(e));
    bus().publish({ kind: 'task.enqueued', companyId: 'co1', ts: '2026', payload: {} });
    bus().publish({ kind: 'task.done', companyId: 'co1', ts: '2026', payload: {} });
    expect(got).toHaveLength(2);
  });

  it('unsubscribe via returned function', () => {
    const got: FactoryEvent[] = [];
    const off = bus().on('task.done', (e) => got.push(e));
    bus().publish({ kind: 'task.done', companyId: 'co1', ts: '2026', payload: {} });
    off();
    bus().publish({ kind: 'task.done', companyId: 'co1', ts: '2026', payload: {} });
    expect(got).toHaveLength(1);
  });

  it('handler errors do not crash publish', () => {
    bus().on('task.done', () => {
      throw new Error('boom');
    });
    let got = 0;
    bus().on('task.done', () => {
      got += 1;
    });
    bus().publish({ kind: 'task.done', companyId: 'co1', ts: '2026', payload: {} });
    expect(got).toBe(1);
  });
});

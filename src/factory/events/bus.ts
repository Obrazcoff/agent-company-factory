import type { FactoryEvent, FactoryEventKind } from './types';

type Handler = (event: FactoryEvent) => void;

class EventBus {
  private byKind = new Map<FactoryEventKind, Set<Handler>>();
  private wildcards = new Set<Handler>();

  on(kind: FactoryEventKind, handler: Handler): () => void {
    let set = this.byKind.get(kind);
    if (!set) {
      set = new Set();
      this.byKind.set(kind, set);
    }
    set.add(handler);
    return () => set?.delete(handler);
  }

  onAny(handler: Handler): () => void {
    this.wildcards.add(handler);
    return () => this.wildcards.delete(handler);
  }

  publish(event: FactoryEvent): void {
    this.byKind.get(event.kind)?.forEach((h) => {
      try {
        h(event);
      } catch {}
    });
    this.wildcards.forEach((h) => {
      try {
        h(event);
      } catch {}
    });
  }

  reset(): void {
    this.byKind.clear();
    this.wildcards.clear();
  }
}

let instance: EventBus | null = null;

export function bus(): EventBus {
  if (!instance) instance = new EventBus();
  return instance;
}

export function resetBus(): void {
  instance = null;
}

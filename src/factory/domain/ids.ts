let counter = 0;

export function newId(prefix: string): string {
  counter += 1;
  const ts = Date.now().toString(36);
  const seq = counter.toString(36).padStart(3, '0');
  const rnd = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .padStart(3, '0');
  return `${prefix}_${ts}${seq}${rnd}`;
}

let lastMs = 0;
let subSeq = 0;

export function nowIso(): string {
  const ms = Date.now();
  if (ms === lastMs) {
    subSeq = (subSeq + 1) % 1000;
  } else {
    lastMs = ms;
    subSeq = 0;
  }
  const sub = subSeq.toString().padStart(3, '0');
  return new Date(ms).toISOString().replace('Z', `${sub}Z`);
}

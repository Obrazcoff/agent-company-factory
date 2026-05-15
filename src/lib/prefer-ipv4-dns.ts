import dns from 'dns';

let applied = false;

/** Prefer A over AAAA for outbound HTTP (fixes many VPS where IPv6 egress is broken → fetch failed). */
export function preferIpv4DnsOnce(): void {
  if (applied) return;
  applied = true;
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    /* Node < 17 */
  }
}

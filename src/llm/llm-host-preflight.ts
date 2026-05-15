import { Agent, fetch as undiciFetch } from 'undici';

let preflightAgent: Agent | undefined;

function getPreflightAgent(): Agent {
  if (!preflightAgent) {
    const connect = Math.min(30_000, Math.max(2_000, Number(process.env.LLM_PREFLIGHT_CONNECT_TIMEOUT_MS || 8_000)));
    const short = Math.min(30_000, Math.max(3_000, connect + 2_000));
    preflightAgent = new Agent({
      connectTimeout: connect,
      headersTimeout: short,
      bodyTimeout: short,
    });
  }
  return preflightAgent;
}

/**
 * Cheap reachability check: TLS + HTTP to origin before a large chat/completions body.
 * Fails fast when the host is unroutable (same symptom as ConnectTimeout on the main call).
 */
export async function preflightLlmOriginReachable(completionsUrl: string, apiKey: string): Promise<{ ms: number }> {
  const u = new URL(completionsUrl);
  const probe = `${u.origin}/`;
  const t0 = Date.now();
  try {
    const res = await undiciFetch(probe, {
      dispatcher: getPreflightAgent(),
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: '*/*',
      },
    });
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    return { ms: Date.now() - t0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause !== undefined ? ` cause=${String(err.cause)}` : '';
    throw new Error(
      `LLM preflight failed for ${probe} (${msg}${cause}). This is TCP/TLS to the LLM host, not “model thinking time”. Check DNS, firewall, and routing from this server to ${u.host}.`,
    );
  }
}

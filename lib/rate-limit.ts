/**
 * Rate limiting em memória (Fase 7 — Escala). Cobre os dois pontos de
 * entrada realmente públicos/não-autenticados do app: login (força
 * bruta de senha, apontado como pendência pela auditoria da Fase 1) e
 * o formulário público de captura de ideias (`/public/idea/[token]`).
 *
 * Deliberadamente simples: um `Map` por processo, sem dependência
 * externa. **Limitação conhecida**: não é compartilhado entre
 * instâncias/processos — hoje o Trilheo roda como um único processo
 * `next dev`/`next start`, então isso já barra o abuso real. Se o
 * deploy virar múltiplas instâncias (serverless, vários containers),
 * isso precisa virar um limiter compartilhado (ex.: Upstash Redis,
 * `@upstash/ratelimit`) — registrado como pendência em CONTEXTO.MD,
 * não implementado agora por ser uma decisão de infraestrutura de
 * produção que ainda não foi tomada.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Só para os testes: zera o estado entre casos. */
export function __resetRateLimitsForTests() {
  buckets.clear();
}

export function getClientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const v = headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  const forwarded = get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return get("x-real-ip") ?? "unknown";
}

/**
 * Log estruturado mínimo para eventos de segurança (tentativa de
 * login barrada por rate limit, envio público barrado por rate
 * limit). Não é um sistema de audit log completo (isso continua
 * fora de escopo, ver CONTEXTO.MD) — só o suficiente para um
 * operador olhar os logs do processo e ver tentativas de abuso.
 */
export function logSecurityEvent(event: string, meta: Record<string, unknown>) {
  console.warn(JSON.stringify({ level: "security", event, ...meta, at: new Date().toISOString() }));
}

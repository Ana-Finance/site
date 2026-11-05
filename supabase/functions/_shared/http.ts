// Utilitaires HTTP communs aux Edge Functions (Deno).
const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim()).filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allow = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0] ?? '';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-cms-build-token',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    vary: 'origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export function fail(req: Request, status: number, code: string, message: string, extra: Record<string, unknown> = {}): Response {
  return json(req, { error: { code, message, ...extra } }, status);
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new ConfigError(name);
  return v;
}

export class ConfigError extends Error {
  constructor(public variable: string) { super(`Variable d'environnement manquante : ${variable}`); }
}

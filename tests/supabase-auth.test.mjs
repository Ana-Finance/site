import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

test.each(['https://app.ana-finance.com/', ''])('auth preserves shared ANA settings (site_url=%s)', async (siteUrl) => {
  vi.stubEnv('SUPABASE_ACCESS_TOKEN', 'test-token');
  vi.stubEnv('SUPABASE_PROJECT_REF', 'test-project');
  vi.stubEnv('SITE_URL', 'https://ana-finance.com/');
  const appRedirect = 'https://app.ana-finance.com/auth/callback';
  let config = { site_url: siteUrl, uri_allow_list: appRedirect, disable_signup: false, external_google_enabled: true };
  const patches = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    if (init.method === 'PATCH') {
      const patch = JSON.parse(init.body);
      patches.push(patch);
      config = { ...config, ...patch };
    }
    return new Response(JSON.stringify(config));
  }));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const { auth } = await import('../scripts/supabase-manage.mjs');
  await auth();
  await auth();
  expect(config.site_url).toBe(siteUrl || 'https://ana-finance.com/admin/');
  expect(config.disable_signup).toBe(false);
  expect(config.external_google_enabled).toBe(true);
  expect(config.uri_allow_list.split(',')).toEqual([
    appRedirect,
    'https://ana-finance.com/admin/',
    'https://ana-finance.github.io/site/admin/',
    'http://localhost:5173/admin/',
  ]);
  for (const patch of patches) {
    expect(patch).not.toHaveProperty('disable_signup');
    expect(patch).not.toHaveProperty('external_google_enabled');
  }
  expect(patches[1]).not.toHaveProperty('site_url');
});

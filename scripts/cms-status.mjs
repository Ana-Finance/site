#!/usr/bin/env node
/* Suivi d'une publication CMS depuis GitHub Actions.
 *   node scripts/cms-status.mjs <building|deploying|failed> [message]
 *   node scripts/cms-status.mjs verify <url-du-site>   → attend que la version soit servie, puis confirme (succeeded)
 * Sans PUBLICATION_ID (build déclenché par un push), ne fait rien.
 */
const [, , action, arg] = process.argv;
const { CMS_EXPORT_URL: url, CMS_BUILD_TOKEN: token, PUBLICATION_ID: id, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
if (!id) { console.log('Pas de publication CMS associée : rien à signaler.'); process.exit(0); }
if (!url || !token) { console.error('CMS_EXPORT_URL / CMS_BUILD_TOKEN manquants'); process.exit(1); }
const runUrl = GITHUB_RUN_ID ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}` : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(status, error) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cms-build-token': token },
    body: JSON.stringify({ publication_id: id, status, run_id: GITHUB_RUN_ID ? Number(GITHUB_RUN_ID) : null, run_url: runUrl, error }),
  });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

if (action === 'verify') {
  const site = (arg || '').replace(/\/?$/, '/');
  await post('verifying');
  for (let i = 1; i <= 30; i++) {
    try {
      const r = await fetch(`${site}cms-publication.json?t=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } });
      const j = r.ok ? await r.json() : null;
      if (j && j.publication_id === id) {
        const res = await post('succeeded'); // la fonction revérifie elle-même avant de confirmer
        if (res.ok) { console.log(`✓ Publication ${id} vérifiée en ligne et confirmée.`); process.exit(0); }
        console.log(`Confirmation refusée (${res.status}) : ${res.body}`);
      } else console.log(`Tentative ${i} : version en ligne ${j ? j.publication_id : 'inconnue'}`);
    } catch (e) { console.log(`Tentative ${i} : ${e.message}`); }
    await sleep(10000);
  }
  await post('failed', 'Déployé, mais la nouvelle version n\'est pas servie en ligne après 5 minutes.');
  process.exit(1);
}
const res = await post(action, arg || null);
console.log(`Statut ${action} : HTTP ${res.status}`);
if (!res.ok && action !== 'failed') process.exit(1);

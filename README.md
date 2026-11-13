# Ana Finance — site vitrine et administration

Site statique (HTML/CSS/JS, sans framework) de 14 pages, hébergé sur GitHub Pages, avec une
administration privée (`/admin/`) pour modifier les contenus, les images, le SEO, publier et suivre l'audience.

| | |
|---|---|
| Site public | pages `.html` à la racine + `assets/` (zones éditables annotées `data-cms`) |
| Administration | `admin-app/` (Vite, React, TypeScript), servie sous `/admin/` |
| Couleurs et gabarits | palette (indigo, violet, magenta, corail), composants communs (titres, bloc final, bulles, menu) et règles des petits écrans décrits dans `assets/css/site.css` |
| Moteur de contenu | `cms/core.js`, partagé par le build et l'aperçu de l'éditeur |
| Données | Supabase : Auth, PostgreSQL avec RLS, Storage privé, Edge Functions (`supabase/`) |
| Publication | brouillon → révision → GitHub Actions reconstruit le site statique → vérification en ligne |
| Analytics | Plausible (sans cookie) ; statistiques lues par une Edge Function |

## Documentation

- [docs/ADMIN_ARCHITECTURE.md](docs/ADMIN_ARCHITECTURE.md) — audit, décisions et compromis
- [docs/SETUP.md](docs/SETUP.md) — mise en service pas à pas (Supabase, GitHub, Plausible, premier admin)
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md) — limites connues

## Commandes

```bash
npm install
npm run dev:admin        # administration en local (http://localhost:5173/admin/)
npm run build            # admin + site complet dans _site/
npm run check            # liens, chemins relatifs, absence de secrets dans _site/
npm test                 # tests unitaires (moteur CMS, build fidèle au HTML source, clés à jour, analytics)
npm run cms:rekey        # après une modification du HTML : nouvelles clés pour les textes modifiés
npm run test:sql         # migrations + permissions RLS sur PostgreSQL
node tests/e2e/admin.e2e.mjs   # parcours complet de l'administration dans Chromium
```

Hébergement : GitHub Pages, source **GitHub Actions** (`.github/workflows/deploy.yml`).
Tant que la source reste « Deploy from a branch », `main` est servie telle quelle.

# Ana Finance — Architecture CMS, administration et Analytics

> Document de décision. Branche : `feature/admin-dashboard`. `main` reste la production et n'est pas modifiée.
> Dernière mise à jour : 2026-11-05.

---

## 1. Audit de l'existant

### 1.1 Stack identifiée

| Élément | Constat |
|---|---|
| Framework | **Aucun.** 14 pages HTML statiques écrites à la main (issues de maquettes Claude Design). |
| Build | **Aucun.** Pas de `package.json`, pas de bundler. Les fichiers sont servis tels quels. |
| Routing | Un fichier `.html` par page à la racine (`index.html`, `agents.html`, …). Tous les liens sont **relatifs** (`demo.html`, `assets/...`). |
| Styles | Styles **inline** sur presque tous les éléments + un bloc `<style>` par page + `assets/css/site.css` (10 lignes). Police Inter (Google Fonts). |
| JS | `assets/js/ana-runtime.js` : mini-moteur réactif maison (`DCLogic`, attributs `data-if`, `data-text`, `data-b-*`, `data-on-*`). Chaque page déclare une classe `Component` inline. `ana-bulle.js` : ouverture de cartes en modale. `ana-analytics.js` : journal localStorage + chargement GA4 après consentement Axeptio (ID `G-XXXXXXXXXX` non renseigné → **aucune mesure réelle aujourd'hui**). |
| Formulaires | `demo.html` et `ressources.html` : validation côté client, **aucun envoi** (affichent une confirmation sans rien transmettre). |
| Contenus | Codés en dur dans le HTML. Header (méga-menu + menu mobile) et footer **dupliqués à l'identique** dans 13 pages ; `demo.html` a un footer réduit. |
| Images | 4 fichiers dans `assets/img/`. Emplacements prévus mais vides : `data-slot` (capture produit, 4 logos clients sur l'accueil, 5 logos sur `integrations.html`). |
| SEO | `<title>`, `meta description`, `og:title`, `og:description`, `og:type` sur chaque page. **Absents** : canonical, `og:image`, sitemap.xml, robots.txt, 404.html. |
| Hébergement | GitHub Pages, **« Deploy from a branch »**, branche `main`, dossier racine, `.nojekyll`. Pas de `CNAME` → URL `https://ana-finance.github.io/site/` (chemin de base `/site/`). |
| CI/CD | **Aucun workflow** GitHub Actions. |

### 1.2 Conséquences

1. Le site ne peut pas être « branché » sur un CMS par composants (il n'y a pas de composants). Il faut **déclarer** les zones éditables dans le HTML existant.
2. Les styles inline rendent toute régénération de markup risquée : on ne doit **remplacer que le contenu** (texte, liens, images) des éléments déclarés, jamais leurs attributs de style.
3. Le chemin de base `/site/` + liens relatifs : tout ce qu'on ajoute doit utiliser des chemins **relatifs** (pas de `/admin/` absolu).
4. GitHub Pages n'a pas de réécriture SPA : l'admin doit être un vrai fichier `admin/index.html` avec un routage par **hash** (`#/pages`).
5. Aucune donnée analytique n'existe aujourd'hui : les KPI afficheront « non configuré » tant que l'intégration n'est pas activée (aucun chiffre fictif).

---

## 2. Contraintes

- Hébergeur statique : pas de serveur Node, pas d'API routes. Toute logique privilégiée → **Supabase** (RLS, RPC SQL, Edge Functions) ou **GitHub Actions**.
- Aucun secret côté navigateur : seule la clé publique (`anon`/publishable) Supabase est exposée, protégée par RLS.
- Repository unique, `main` intacte jusqu'à validation, pas de merge ni de déploiement sans accord.
- Préserver le rendu actuel : la sortie du build doit être **identique au DOM d'origine** tant qu'aucun contenu n'a été modifié (vérifié par test automatisé).

---

## 3. Décisions

### 3.1 CMS : CMS « maison » sur Supabase, zones déclarées par attributs `data-cms`

Comparaison rapide :

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| Decap / Netlify CMS | Gratuit, Git-based | Pensé pour Markdown/SSG, pas pour du HTML inline ; auth GitHub OAuth nécessite un serveur ; pas d'analytics ni d'éditeur visuel | ✗ |
| CMS headless SaaS (Storyblok, Sanity…) | Éditeur visuel mature | Coût, dépendance tierce, migration du site vers des composants | ✗ |
| **CMS maison Supabase** | Correspond exactement au site (HTML annoté), Auth + RLS + Storage inclus, demandé par le cahier des charges | Code à maintenir | **✓ retenu** |

Principe :
- Chaque élément éditable porte `data-cms="<clé>"` et `data-cms-type="text|rich|link|image|slot"`. Chaque `<section>` porte `data-cms-section="<clé>"`.
- Les clés sont ajoutées **une fois** par un script (`scripts/cms-annotate.mjs`) puis versionnées dans le HTML : elles sont stables.
- Header et footer partagés reçoivent des clés `g.header.*` / `g.footer.*` et sont édités **une seule fois** (pseudo-page `_global`). Si un élément du header diffère sur une page (cas réel : une description du méga-menu sur `agents.html`), il reçoit une clé locale pour ne jamais écraser silencieusement une variante.
- Le **HTML source est le schéma** : l'admin lit le HTML déployé pour connaître les champs, la base ne stocke que les **valeurs**.
- Une seule bibliothèque (`cms/core.js`, ESM pure, sans dépendance) applique le contenu à un `Document` : utilisée **à l'identique** par le build Node (via `linkedom`) et par la prévisualisation dans l'admin (DOM natif). Aperçu et production ne peuvent pas diverger.

Types de champs :

| Type | Éléments | Valeur | Édition |
|---|---|---|---|
| `text` | élément ne contenant que du texte | `{ text }` | champ texte |
| `rich` | texte avec balises inline (`span` stylé, `a`, `strong`, `br`) | `{ html }` assaini (liste blanche stricte) | éditeur inline limité |
| `link` | `<a>` texte seul | `{ text, href }` | libellé + destination |
| `image` | `<img>` | `{ src, alt, mediaId? }` | médiathèque + alt |
| `slot` | emplacement `data-slot` vide | `{ src, alt, mediaId? }` ou vide | médiathèque + alt |

Sections : masquage et réordonnancement entre sections sœurs. Le code (`<script>`, attributs `data-on-*`, `data-b-*`, `data-text`) n'est **jamais** éditable.

### 3.2 Publication : génération statique (approche B) + aperçu dynamique côté admin (hybride)

| | A — contenu chargé au runtime | **B — rebuild statique** |
|---|---|---|
| SEO | Contenu et `<head>` injectés en JS (indexation incertaine) | HTML final servi aux moteurs ✓ |
| Dépendance Supabase des visiteurs | Oui (site cassé si Supabase indisponible ou en pause) | **Aucune** ✓ |
| Poids du site public | + SDK / fetch à chaque visite | **0 octet ajouté** ✓ |
| Délai de publication | Immédiat | ~1–2 min |
| Brouillons | Risque de fuite si RLS mal configurée | Jamais servis au public ✓ |

**Retenu : B**, avec un aperçu instantané et privé dans l'admin (le brouillon est appliqué dans une iframe de la vraie page, en mémoire, pour l'utilisateur connecté uniquement).

Séquence de publication (aucune étape ne prétend un succès non vérifié) :

```
Admin clique « Publier »
  → Edge Function `publish` (JWT vérifié, rôle admin)
      → RPC `create_publication` : fige les brouillons en révisions immuables, crée publications(status=queued)
      → appelle GitHub `workflow_dispatch` (token GitHub stocké en secret Supabase, jamais dans le front)
  → Workflow `deploy.yml`
      → GET Edge Function `cms-export?publication=…` (jeton CMS_BUILD_TOKEN) : contenus + URLs signées des seuls médias publiés
      → build : HTML + sitemap + robots + redirections + `cms-publication.json`
      → callback status=deploying → deploy GitHub Pages
      → vérifie en ligne que `cms-publication.json` contient l'id de publication (retries)
      → callback status=succeeded → RPC `finalize_publication` : bascule les pointeurs « publié »
  → l'admin suit le statut et revérifie lui-même `cms-publication.json` avant d'afficher « Publication réussie »
```

Garanties :
- Brouillons et révisions non publiées : lisibles uniquement par les membres authentifiés (RLS).
- Une seule publication active à la fois (index unique partiel + `concurrency` GitHub Actions).
- Modifications concurrentes : verrou optimiste (`save_draft(page, contenu, version_attendue)` → conflit explicite).
- Historique complet (`page_revisions` immuables) et restauration (copie d'une révision dans le brouillon, puis publication).
- Si le build ne peut pas lire Supabase alors qu'il est configuré → **échec du build**, le site en ligne reste inchangé (jamais de retour silencieux aux textes d'origine).
- Les médias ne deviennent publics **qu'au moment de la publication** : ils sont téléchargés depuis le bucket **privé** par le build et servis par GitHub Pages (`assets/media/`). Il n'existe pas de bucket public.

### 3.3 Analytics : Plausible (recommandé), via Edge Function

| Critère | **Plausible** | Google Analytics 4 |
|---|---|---|
| Coût | Payant. API de statistiques réservée à l'offre **Business** (≈ 19 $/mois à 10 k pages vues/mois d'après les comparateurs ; vérifier sur plausible.io) | Gratuit (collecte et Data API, dans la limite des quotas) |
| RGPD / CNIL | Sans cookie, sans donnée personnelle, hébergé dans l'UE. Peut être déployé sans bandeau si configuré conformément à l'exemption CNIL (à valider par votre DPO) | Consentement **obligatoire** en France ; transferts hors UE (encadrés par le Data Privacy Framework) |
| Fiabilité des chiffres | Tous les visiteurs non bloqueurs sont comptés | Seuls les visiteurs ayant consenti → sous-comptage important |
| Intégration | Un script de ~1 Ko, événements personnalisés simples | gtag + Consent Mode + Axeptio |
| API | Stats API v2 : une requête JSON, clé Bearer | Data API v1 : compte de service Google Cloud, JWT signé, quotas par jetons |
| Métriques | visiteurs, visites, pages vues, pages/visite, durée, rebond, sources/UTM, appareils, pays, objectifs | Plus riches mais seuillage et échantillonnage possibles |
| Maintenance | Faible | Plus élevée (consentement, quotas, comptes Google Cloud) |

**Décision : Plausible.** Le code est structuré par adaptateur (`supabase/functions/_shared/analytics/`) ; seul l'adaptateur Plausible est implémenté et testé. Un adaptateur GA4 peut être ajouté sans toucher à l'admin.

Limites assumées :
- Sans abonnement Business, l'admin affiche « Analytics non configuré » (aucun chiffre inventé).
- Plausible n'a pas de notion de « session » distincte : *sessions* = *visits* Plausible. Le taux de rebond et la durée sont ceux de Plausible (définitions documentées dans l'admin).
- Les chiffres Plausible ne sont pas rétroactifs : la collecte commence à l'activation.
- La clé API reste dans les secrets Supabase ; l'admin n'appelle que l'Edge Function `analytics`, qui vérifie l'utilisateur et met en cache les réponses (10 min).

Conversions : événements envoyés par `assets/js/ana-analytics.js` (`cta_demo`, `click_phone`, `click_email`, `click_platform`, `form_demo_success`, `form_resource_success`). Un formulaire ne compte **que si l'envoi a réussi** (enregistrement Supabase confirmé). L'admin choisit quels événements sont des conversions (`conversion_definitions`) ; ils doivent aussi être déclarés comme *goals* dans Plausible.

### 3.4 Administration

- **Vite + React 18 + TypeScript**, dossier `admin-app/`, compilé vers `_site/admin/` avec `base: './'` (fonctionne sous `/site/` comme sur un domaine personnalisé).
- Routage par hash (`#/dashboard`), donc rafraîchissement et accès direct sans réécriture serveur.
- Design system CSS maison (tokens clair/sombre, inspiré Linear/Vercel), icônes `lucide-react`, graphiques `recharts` chargés en *lazy*.
- Le code de l'admin n'est **jamais** chargé par le site public.
- `<meta name="robots" content="noindex">` + `Disallow: /admin/` dans robots.txt (confort SEO, **pas** une mesure de sécurité : la sécurité est dans la RLS et les Edge Functions).

### 3.5 Sécurité

- Supabase Auth e-mail + mot de passe, **inscriptions publiques désactivées**, réinitialisation par e-mail.
- Rôles `admin` / `editor` dans `profiles`. Le premier admin est promu via une requête SQL documentée (exécutée dans le SQL Editor, jamais depuis le front).
- RLS activée sur **toutes** les tables. Les anonymes ne peuvent qu'appeler `submit_lead` (insertion validée) : ils ne lisent aucune table.
- Écritures sensibles uniquement via des fonctions SQL `security definer` qui vérifient le rôle (`is_admin()`, `is_member()`).
- Storage : bucket `media` **privé**, types MIME en liste blanche (JPEG, PNG, WebP, AVIF, GIF — SVG refusé car il peut contenir du script), 10 Mo max.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_TOKEN`, `PLAUSIBLE_API_KEY`, `CMS_BUILD_TOKEN`) uniquement dans les secrets Supabase / GitHub.
- Contenu riche assaini à l'enregistrement **et** au build (liste blanche de balises/attributs, schémas d'URL `http(s)`, `mailto`, `tel`, relatifs, ancres).

---

## 4. Modèle de données

Mono-site (pas de multi-tenant) — extensible en ajoutant une colonne `site_id` si besoin.

| Table | Rôle |
|---|---|
| `profiles` | Utilisateur admin (id = `auth.users.id`), rôle `admin`/`editor`, nom affiché |
| `pages` | Une ligne par page (`slug`, `file_path`, statut `draft/published/archived`, `template_path` pour les pages dupliquées, pointeur `published_revision_id`) |
| `page_drafts` | Brouillon courant par page (`content` jsonb, `version` pour le verrou optimiste) |
| `page_revisions` | Instantanés immuables numérotés (sauvegardes, publications, restaurations) |
| `media_assets` | Métadonnées des fichiers du bucket privé (nom logique, alt, dimensions, poids, suppression logique) |
| `publications` | File et historique des publications (statut, manifeste page→révision, run GitHub, erreur, vérification) |
| `redirects` | Redirections générées lors d'un changement de slug (pages HTML de redirection au build) |
| `site_settings` | Paramètres (général, coordonnées, réseaux, SEO global, analytics non secret) |
| `conversion_definitions` | Événements considérés comme conversions |
| `leads` | Envois réels des formulaires (lecture réservée aux membres) |
| `audit_logs` | Journal d'activité, alimenté uniquement par les fonctions SQL |
| `analytics_cache` | Cache des réponses Analytics (non lisible par les clients) |

Format du contenu (`content` jsonb) :

```json
{
  "fields":   { "index.hero.h1": { "text": "…" }, "index.s3.a1": { "text": "…", "href": "demo.html" } },
  "sections": { "order": ["s1","s2","s3"], "hidden": ["s4"] },
  "seo":      { "title": "…", "description": "…", "ogTitle": "…", "ogDescription": "…", "ogImage": {"mediaId": "…"}, "canonical": "", "noindex": false }
}
```

Migrations versionnées : `supabase/migrations/*.sql`. Contenu initial : `supabase/seed/content.sql` généré depuis le HTML (`npm run cms:seed`).

---

## 5. Structure du repository

Les pages publiques **ne bougent pas** (elles restent à la racine : c'est ce que sert GitHub Pages aujourd'hui).

```
/                         pages publiques (*.html) + assets/   ← inchangé, annoté data-cms
admin-app/                application d'administration (Vite/React/TS)
  src/app/                layout, navigation, routage, auth
  src/modules/            dashboard, analytics, pages, editor, media, seo, publications, settings
  src/components/         composants UI réutilisables
  src/lib/                client Supabase, accès données, analytics
cms/core.js               moteur de contenu partagé (build + aperçu)
scripts/                  cms-annotate, cms-seed, build-site, check-site
supabase/
  migrations/             schéma, RLS, RPC, storage
  functions/              publish, cms-export, analytics, admin-users (+ _shared)
  tests/                  tests SQL des permissions (RLS)
tests/                    tests unitaires (vitest)
.github/workflows/deploy.yml   workflow unique : CI sur PR, build + déploiement sur main / publication
docs/
```

---

## 6. Routage GitHub Pages

| Point | Traitement |
|---|---|
| Chemin de base `/site/` vs domaine perso | Uniquement des chemins relatifs ; Vite `base: './'` ; `cms-publication.json` vérifié en relatif |
| Accès direct à `/admin/` | Fichier réel `admin/index.html` |
| Rafraîchissement des routes admin | Routage par hash |
| 404 | `404.html` généré (lien vers l'accueil). GitHub Pages sert `404.html` à la racine du site |
| Assets | Copiés tels quels ; médias publiés dans `assets/media/` |
| Éditeur | L'iframe charge `../<page>.html` (même origine → manipulation DOM autorisée) |

**Changement de configuration requis au moment de la mise en production** (action manuelle, par vous) : *Settings → Pages → Source : GitHub Actions*. Tant que ce réglage n'est pas fait, `main` continue d'être servie comme aujourd'hui.

---

## 7. Risques techniques

| Risque | Mitigation |
|---|---|
| Régression visuelle du site public | Test automatique « build sans modification = DOM identique à l'original » sur les 14 pages ; seuls des attributs `data-cms*` sont ajoutés aux sources |
| Désynchronisation des clés si le HTML est refondu à la main | Les clés sont dans le HTML ; `npm run check` signale les clés en double et les contenus orphelins |
| Échec du workflow de publication | Statut `failed` visible dans l'admin avec le lien du run ; le site en ligne reste sur la version précédente |
| Supabase gratuit mis en pause après inactivité | N'affecte pas le site public (statique). L'admin affiche l'erreur ; relance dans le tableau de bord Supabase |
| Délai de publication (1–2 min, cache CDN GitHub ~10 min) | Statut détaillé + vérification réelle de l'id publié |
| Coût Plausible Business | Option GA4 possible via adaptateur ; ou Plausible sans API (statistiques consultables dans Plausible directement) |
| Token GitHub expiré | Erreur explicite côté Edge Function `publish` ; procédure de renouvellement documentée |

---

## 8. Plan d'implémentation

| Phase | Livrable testable | Priorité |
|---|---|---|
| 1 | Audit + ce document | — |
| 2–3 | Annotation `data-cms`, moteur `cms/core.js`, build `_site` identique, schéma Supabase + RLS testés sur PostgreSQL local, admin : layout, auth, navigation | P0 |
| 4 | Pages (liste, statuts, duplication, archivage), formulaire de champs, brouillons, historique/restauration, médiathèque | P1 |
| 5 | Éditeur visuel (iframe réelle, survol/sélection, panneau de propriétés, sections, undo/redo, desktop/tablette/mobile) | P1 |
| 6 | Publication réelle (Edge Functions + workflow + vérification en ligne) | P1 |
| 7 | Tracking Plausible + conversions + formulaires réellement envoyés, dashboards KPI | P2 |
| 8 | SEO manager (head généré au build, sitemap, robots, redirections, aperçu Google) | P2–P3 |
| 9 | Tests (unitaires, RLS, build, e2e admin) | continu |
| 10 | Docs d'installation, déploiement, création admin, limites | — |

Voir `docs/SETUP.md` pour la mise en service et `docs/LIMITATIONS.md` pour les limites restantes.

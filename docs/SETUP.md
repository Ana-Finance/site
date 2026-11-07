# Mise en service — CMS, administration et Analytics

Ce guide part du repository tel qu'il est sur la branche `feature/admin-dashboard`.
Durée estimée : 45 minutes. **Rien n'est mis en production tant que vous n'avez pas fusionné la PR et changé la source GitHub Pages (étape 7).**

Valeurs cibles après configuration du domaine et bascule. Les réglages GitHub, Supabase, CMS et Plausible existants doivent être mis à jour séparément :

| | |
|---|---|
| Repository | `Ana-Finance/site` |
| Site public | `https://ana-finance.com/` |
| Administration | `https://ana-finance.com/admin/` |
| Projet Supabase | `https://<ref>.supabase.co` |

---

## 1. Créer le projet Supabase

1. [supabase.com](https://supabase.com) → *New project* — région **Europe (Frankfurt ou Paris)**.
2. Notez dans *Project Settings → API* : l'URL du projet, la clé **anon / publishable** (publique) et la clé **service_role / secret** (à ne jamais publier ; elle n'est utilisée que par les Edge Functions, qui la reçoivent automatiquement).

## 2. Base de données

Avec la [CLI Supabase](https://supabase.com/docs/guides/cli) :

```bash
npm install
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push                     # applique supabase/migrations/*.sql
psql "<chaîne de connexion>" -f supabase/seed/content.sql   # contenu initial (idempotent)
```

Sans CLI : collez dans *SQL Editor*, dans l'ordre, les 4 fichiers de `supabase/migrations/`, puis `supabase/seed/content.sql`.

Le seed est généré depuis le HTML (`npm run cms:seed`). Ne le régénérez que si vous modifiez le HTML **avant** la première mise en service.

## 3. Authentification

*Authentication → Sign In / Providers* :
- Projet partagé avec l’application ANA : conserver ses inscriptions et ses URL de redirection. L’accès au CMS reste réservé aux profils invités.
- Email : *Confirm email* activé ; *Secure password change* activé ; longueur minimale 12.

*Authentication → URL Configuration* :
- Site URL : conserver la valeur utilisée par l’application ANA ; si elle est vide, utiliser `https://ana-finance.com/admin/`.
- Redirect URLs : ajouter sans retirer les URL de l’application ANA : `https://ana-finance.com/admin/` (conserver aussi `https://ana-finance.github.io/site/admin/` pendant la transition et `http://localhost:5173/admin/` pour le développement).

### Premier administrateur (procédure unique)

1. *Authentication → Users → Add user → Create new user* : votre e-mail, un mot de passe fort, *Auto confirm user* coché.
2. *SQL Editor* :

```sql
insert into public.profiles (id, email, display_name, role)
select id, email, 'Votre nom', 'admin' from auth.users where email = 'vous@exemple.fr';
```

Les comptes suivants s'invitent depuis l'administration (*Paramètres → Utilisateurs*). Un compte Auth sans ligne dans `profiles` n'a accès à rien.

## 4. Edge Functions et secrets

### Jeton GitHub (déclenchement des publications)

GitHub → *Settings (de votre compte) → Developer settings → Fine-grained tokens → Generate new token* :
- *Resource owner* : `Ana-Finance` ; *Repository access* : **Only select repositories** → `site`.
- *Permissions → Repository → Actions : Read and write*. Rien d'autre.
- Expiration : 1 an maximum ; notez la date de renouvellement.

### Secrets Supabase

```bash
CMS_BUILD_TOKEN=$(openssl rand -hex 32); echo $CMS_BUILD_TOKEN   # à reporter aussi dans GitHub (étape 5)
npx supabase secrets set \
  GITHUB_TOKEN=github_pat_xxx \
  GITHUB_REPOSITORY=Ana-Finance/site \
  CMS_BUILD_TOKEN=$CMS_BUILD_TOKEN \
  ADMIN_URL=https://ana-finance.com/admin/ \
  SITE_URL=https://ana-finance.com/ \
  ALLOWED_ORIGINS=https://ana-finance.com
npx supabase functions deploy publish
npx supabase functions deploy analytics
npx supabase functions deploy admin-users
npx supabase functions deploy cms-export --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement aux fonctions. Si votre projet n'expose que les nouvelles clés *publishable/secret*, définissez `SUPABASE_ANON_KEY` (clé publishable) et `SUPABASE_SERVICE_ROLE_KEY` (clé secrète) avec `supabase secrets set`.

## 5. Variables et secrets GitHub Actions

Repository → *Settings → Secrets and variables → Actions* :

| Type | Nom | Valeur |
|---|---|---|
| Secret | `CMS_BUILD_TOKEN` | la même valeur qu'à l'étape 4 |
| Variable | `SUPABASE_URL` | `https://<ref>.supabase.co` |
| Variable | `SUPABASE_ANON_KEY` | clé anon / publishable (publique) |
| Variable | `CMS_EXPORT_URL` | `https://<ref>.supabase.co/functions/v1/cms-export` |
| Variable | `SITE_URL` | `https://ana-finance.com/` |

Aucun secret existant n'est modifié par ce projet.

## 6. Analytics (Plausible)

1. Compte sur [plausible.io](https://plausible.io), hébergement UE. Ajoutez le site `ana-finance.com` (Plausible mesure par domaine).
2. *Site settings → Goals → Add goal → Custom event*, un objectif par événement : `form_demo_success`, `form_resource_success`, `cta_demo`, `click_phone`, `click_email`, `click_platform`.
3. Clé API de statistiques (offre **Business** requise pour la Stats API) : *Account settings → API keys → New API key (Stats API)*, puis :
   ```bash
   npx supabase secrets set PLAUSIBLE_API_KEY=xxxx
   # Instance auto-hébergée : npx supabase secrets set PLAUSIBLE_BASE_URL=https://stats.exemple.fr
   ```
4. Dans l'administration : *Paramètres → Analytics* → domaine `ana-finance.com`. Le script de mesure est ajouté à toutes les pages à la publication suivante.

Sans clé API, l'administration affiche « Analytics non configuré » (aucun chiffre inventé) ; la mesure fonctionne quand même et reste consultable dans Plausible.

## 7. Mise en production (avec votre validation)

1. Relisez et fusionnez la Pull Request `feature/admin-dashboard` → `main`.
2. **Settings → Pages → Build and deployment → Source : GitHub Actions.**
   Tant que ce réglage reste sur « Deploy from a branch », le site continue d'être servi comme avant et `/admin/` n'existe pas.
3. *Actions → Build & déploiement → Run workflow* (branche `main`) pour le premier déploiement, ou attendez le run déclenché par la fusion.
4. Vérifiez `https://ana-finance.com/` puis `https://ana-finance.com/admin/`.

Le site publié est alors identique à l'actuel (le test « DOM identique » le garantit), avec en plus `robots.txt`, `sitemap.xml`, `404.html`, les balises canoniques et le script de mesure si configuré.

## 8. Recette en ligne (10 minutes)

1. `https://ana-finance.com/admin/` → connexion avec le compte admin.
2. *Éditeur visuel* → Accueil → cliquer le grand titre → modifier → *Enregistrer*.
3. *Prévisualiser* : la modification apparaît, le site public n'a pas changé.
4. *Publier* → l'écran de suivi passe par *Construction → Déploiement → Vérification → En ligne*.
5. Ouvrir le site public : le nouveau titre est en ligne. *Pages → Accueil → Historique → Restaurer v1* puis publier pour revenir en arrière.
6. *Médias* → importer un logo → *Éditeur* → cliquer « Logo client 1 » → *Choisir une image* → publier.

## Développement local

```bash
cp .env.example .env.local     # renseigner VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev:admin              # http://localhost:5173/admin/ (sert aussi le site public)
npm test                       # moteur CMS, build, analytics
npm run test:sql               # migrations + RLS sur un PostgreSQL local jetable
node tests/e2e/admin.e2e.mjs   # parcours complet dans Chromium (backend simulé)
npm run build && npm run check # site complet dans _site/
```

Après une modification structurelle du HTML d'une page (nouveau bloc), lancez `node scripts/cms-annotate.mjs --force` **uniquement** sur un site pas encore en production : les clés existantes seraient régénérées. En production, ajoutez à la main les attributs `data-cms="<page>.<section>.<élément>-<n>" data-cms-type="text"` aux nouveaux éléments.

## Renouvellements

| Élément | Où | Fréquence |
|---|---|---|
| Jeton GitHub | `supabase secrets set GITHUB_TOKEN=…` | à expiration (erreur « GitHub a refusé le déclenchement » dans l'admin) |
| `CMS_BUILD_TOKEN` | Supabase **et** GitHub, même valeur | en cas de fuite supposée |
| Clé Plausible | `supabase secrets set PLAUSIBLE_API_KEY=…` | à révocation |

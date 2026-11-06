# Gérer Supabase depuis GitHub (sans ordinateur)

Le workflow **Actions → « Supabase — gestion » → Run workflow** installe et administre le projet Supabase.
Il peut être lancé depuis le navigateur ou le téléphone, ou par Claude.

## Préparation (une seule fois)

Dans **Settings → Secrets and variables → Actions → Secrets → New repository secret** :

| Secret | Où l'obtenir |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens → **Generate new token** (nom : `github-actions`) |
| `CMS_GITHUB_TOKEN` | le jeton `github_pat_…` de l'étape 6a. Permissions : **Actions : Read and write** et, pour remplir les variables automatiquement, **Variables : Read and write** |
| `CMS_BUILD_TOKEN` | une longue chaîne aléatoire (64 caractères, gestionnaire de mots de passe) |
| `PLAUSIBLE_API_KEY` | facultatif : clé Stats API de Plausible |

La référence du projet (20 lettres, *Project Settings → General → Project ID*) se saisit dans le champ
`project_ref` au lancement, ou une fois pour toutes dans la variable `SUPABASE_PROJECT_REF`.

## Actions

| Action | Effet | Relançable |
|---|---|---|
| `diagnostic` | État du projet : tables, sécurité RLS, migrations, pages, admins, auth, fonctions, secrets. **Ne modifie rien.** | oui |
| `installer-tout` | auth + migrations + contenu + secrets + fonctions + variables GitHub (+ admin si e-mail rempli), puis diagnostic | oui |
| `migrations` | Applique les migrations manquantes puis le contenu initial. Reconnaît ce qui a déjà été exécuté à la main dans l'éditeur SQL | oui |
| `fonctions` | Enregistre les secrets et déploie les 4 Edge Functions | oui |
| `auth` | Inscriptions libres fermées, URL de redirection de l'admin, mots de passe ≥ 12 caractères | oui |
| `admin` | Invite l'e-mail indiqué (lien pour choisir son mot de passe) ou promeut un compte existant, avec le rôle choisi | oui |
| `variables-github` | Écrit `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CMS_EXPORT_URL`, `SITE_URL` ; à défaut de permission, les affiche dans le résumé du run | oui |

Chaque migration s'exécute dans une transaction : en cas d'erreur, rien n'est appliqué à moitié.
Les clés lues via l'API sont masquées dans les journaux.

## Sécurité

- Seules les personnes ayant le droit d'écriture sur le repository peuvent lancer ce workflow.
- `SUPABASE_ACCESS_TOKEN` donne un accès complet à vos projets Supabase. Révoquez-le et recréez-le en cas de doute, puis mettez le secret à jour.
- Aucune action ne supprime de données.

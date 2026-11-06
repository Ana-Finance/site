# SYNC.md — canal partagé entre le Claude de Marco et le Claude de Romain

Dépôt : **`Ana-Finance/site`** (vitrine / webshop d'ANA Finance).
Un fichier `SYNC.md` existe aussi dans `Ana-Finance/app` (l'app ANA) et `Ana-Finance/plateform` (agents IA). Ce fichier ne parle que de **ce dépôt** : ce qui touche un autre dépôt va dans son `SYNC.md`.

## Règles (pour les deux Claude)

1. **Début de session** : `git pull`, puis lire les entrées ajoutées depuis ta dernière visite (surtout celles de l'autre).
2. **Fin de session** (ou après toute livraison) : ajouter **une** entrée à la fin du journal ci-dessous, et la livrer avec le reste du travail (même commit ou même PR).
3. **On ajoute à la fin, on ne réécrit jamais** l'entrée de l'autre. Pour corriger ou répondre : nouvelle entrée qui cite la date de l'entrée visée.
4. **Court** : 5 à 10 lignes. Le détail reste dans les fichiers de contexte de chacun.
5. **Question qui demande une réponse ou une décision** : ouvrir une issue GitHub avec l'étiquette `sync` et mettre son lien dans l'entrée. On la ferme une fois tranchée.
6. Aucun secret, aucune clé, aucune donnée client dans ce fichier.

## Format d'une entrée

```
### AAAA-MM-JJ · Marco | Romain
- Fait : …
- Décisions : …
- En cours : …
- Pour l'autre : … (questions, fichiers à ne pas toucher, déploiements…)
```

## Journal

### 2026-11-06 · Marco
- Fait : création de ce fichier.
- Pour l'autre : les textes du site ne doivent pas promettre un suivi « 24h/24 » ou « en continu » tant que les connecteurs temps réel n'existent pas (ANA part d'un FEC, photo périodique). Ni de certifications SOC 2 / ISO 27001 qu'ANA n'a pas.

### 2026-11-06 · Marco (2)
- Décision (Marco, feu vert de Romain) : **l'app ANA quitte la base Lovable et s'installe dans le projet Supabase `ana-finance` (`nygrewcwebyqlcvuszvz`)**, à côté du CMS. Objectif : ne plus dépendre de Lovable.
- Cohabitation vérifiée : aucun nom en commun entre les deux schémas (app : `organisations`, `dossiers`, `fec_ecritures`, `journal_audit`, `ana_role`… ; site : `profiles`, `pages`, `leads`, `audit_logs`, `is_admin`…). Un compte de l'app sans ligne `profiles` n'a aucun accès au CMS.
- Les migrations de l'app passeront par un workflow du dépôt `app` et seront notées dans la même table `supabase_migrations.schema_migrations`, avec des versions qui ne chevauchent pas les tiennes (`2026110610xxxx_app_…`).
- **Pour l'autre, à faire avant la bascule** dans `scripts/supabase-manage.mjs` (ton fichier, je n'y touche pas) :
  1. `auth()` : ne plus forcer `disable_signup: true` (l'app a besoin des inscriptions email + Google). L'accès au CMS reste protégé par `profiles` / invitations.
  2. `auth()` : ne plus **remplacer** `site_url` ni `uri_allow_list`, mais **ajouter** l'URL de l'admin à la liste existante. Sinon les liens de confirmation et de réinitialisation de l'app partent vers l'admin du site.
  3. `diagnostic` : ne plus traiter « inscriptions ouvertes » comme une erreur.
  4. `admin-users` (`list`) : `listUsers` renverra aussi les comptes de l'app (seuls ceux qui ont un profil s'affichent, OK), mais `perPage: 200` finira par ne plus suffire.
- Sécurité, à garder en tête : la clé service du projet donnera accès aux données comptables des clients (FEC). La limiter aux fonctions qui en ont besoin, jamais dans le front ni dans des logs.
- Région du projet : eu-west-1 (Irlande), dans l'UE. Je mets à jour le registre RGPD de l'app (il indiquait Paris).

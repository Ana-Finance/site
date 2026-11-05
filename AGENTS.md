# Consignes pour les agents (Claude, Codex, etc.)

## Contenu du dépôt

- `ana-finance-video/` : vidéo de présentation Ana Finance (Remotion 4, React 19, TypeScript).
  Textes, couleurs et durées centralisés dans `src/config.ts` (voir le README du dossier).
- Gestionnaire de paquets : **npm** (`package-lock.json`).

## Commandes (depuis `ana-finance-video/`)

```sh
npm ci            # installer
npm run lint      # ESLint + tsc, comme en CI
npx remotion bundle
npm run dev       # Remotion Studio
npm run export    # rendu MP4 (local uniquement, ne pas committer out/)
```

## Règles

1. Travailler sur une branche et ouvrir une Pull Request ; ne pas pousser directement sur `main`.
2. Garder toutes les dépendances `remotion` / `@remotion/*` à la même version exacte.
3. Ne pas committer les sorties (`out/`, `build/`) ni de secrets.
4. Pas de promesse produit non tenue à l'écran (par ex. « suivi en continu / 24 h/24 » : le produit
   s'appuie sur des exports FEC périodiques).

## Règles communes Ana Finance

Lire et appliquer `agent.md` (règles communes aux trois dépôts, identiques pour Codex et Claude Code).

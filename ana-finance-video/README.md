# Ana Finance — vidéo de présentation (Remotion)

Vidéo 1920×1080, 30 fps, 45 s.

## Prévisualiser

```bash
npm i
npm run dev        # ouvre Remotion Studio
```

- `AnaFinance` : la vidéo complète (les 6 scènes enchaînées avec `<Series>`)
- `Scenes/S1-Accroche` … `Scenes/S6-CTA` : chaque scène seule

## Modifier textes, couleurs et durées

Tout est centralisé dans **`src/config.ts`** :

| Bloc       | Contenu                                         |
| ---------- | ----------------------------------------------- |
| `SCENES`   | durée de chaque scène (en images, 30 = 1 s)     |
| `COLORS`   | couleurs de marque et de l'interface            |
| `TEXTS`    | tous les textes à l'écran, scène par scène      |
| `ASSETS`   | logos dans `public/`                            |

## Structure

```
src/
  config.ts          ← textes, couleurs, durées
  Main.tsx           ← composition principale (<Series>)
  Root.tsx           ← déclaration des compositions
  scenes/            ← Hook, Problem, Reveal, Demo (bulles), Benefits, Cta
  components/        ← fond, textes animés, logo, icônes, curseur
public/
  logo-icon.png, logo-full.png, fonts/ (Inter, embarquée)
```

## Exporter en MP4

```bash
npx remotion render AnaFinance out/ana-finance.mp4
```

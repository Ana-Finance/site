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
| `AUDIO`    | musique on/off, volumes musique et effets       |

## Musique et effets sonores

La musique (120 BPM, drop calé sur l'apparition du logo à 10 s) et les effets
sonores sont générés par synthèse — aucun fichier externe, aucun droit à payer :

```bash
pip install numpy scipy
python3 scripts/generate_audio.py        # écrit public/audio/*.wav
npx remotion ffmpeg -y -i public/audio/music.wav -b:a 192k public/audio/music.mp3 && rm public/audio/music.wav
```

Chaque effet est placé dans sa scène (bloc `{/* Sons */}`) sur l'image où
l'élément apparaît : pops sur les bulles, frappe clavier, coches, carillon de
validation, montée + impact sur le logo, tic-tac de compteurs, whooshs de transition.

## Structure

```
src/
  config.ts          ← textes, couleurs, durées
  Main.tsx           ← composition principale (<Series>)
  Root.tsx           ← déclaration des compositions
  scenes/            ← Hook, Problem, Reveal, Demo (bulles), Benefits, Cta
  components/        ← fond, textes animés, logo, icônes, curseur, Sfx
scripts/
  generate_audio.py  ← synthèse de la musique et des effets
public/
  logo-icon.png, logo-full.png, fonts/ (Inter, embarquée), audio/
```

## Exporter en MP4

```bash
npm run export
```

Produit `out/ana-finance-compatible.mp4` : H.264 yuv420p + AAC 44,1 kHz, lisible
avec le son sur iPhone, Mac (QuickTime), WhatsApp, LinkedIn…

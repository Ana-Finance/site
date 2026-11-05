# Ana Finance — site vitrine

Site statique (HTML/CSS/JS, sans framework) de 14 pages, issu des maquettes Claude Design.

- `index.html` : accueil ; une page `.html` par entrée du menu et du pied de page.
- `assets/js/ana-runtime.js` : petit moteur d'interactivité (menus, onglets, simulateur de prix, formulaires).
- `assets/js/ana-bulle.js` : ouverture des cartes en détail au clic.
- `assets/js/ana-analytics.js` : mesure d'audience, active seulement après consentement (ID GA4 à renseigner).

Hébergement : GitHub Pages (Settings → Pages → Deploy from a branch, dossier racine).

## À compléter avant lancement
- Capture produit et logos clients sur l'accueil (cadres `data-slot`).
- Envoi réel des formulaires (Démo, Ressources) : aujourd'hui ils affichent une confirmation sans rien transmettre.
- Identifiants GA4 (`assets/js/ana-analytics.js`) et Axeptio.

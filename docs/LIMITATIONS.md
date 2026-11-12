# Limites connues et pistes

| Limite | Cause | Contournement / piste |
|---|---|---|
| Publication en 1 à 3 minutes, puis jusqu'à 10 min de cache CDN | Génération statique + CDN GitHub Pages | L'admin distingue « confirmé en ligne » et « propagation en cours » |
| Création de page = duplication d'une page existante | Le site n'a pas de gabarits/composants ; chaque page a sa propre mise en page | Ajouter des modèles HTML dédiés si besoin récurrent |
| Une nouvelle page n'apparaît pas seule dans la navigation | Les menus sont des liens figés dans l'en-tête partagé | Modifier un lien existant de l'en-tête (destination) dans l'éditeur |
| Pas d'ajout libre de blocs ou de sections, ni de changement de style | Choix de sécurité : seuls les éléments déclarés `data-cms` sont éditables, sans HTML/JS arbitraire | Ajouter des attributs `data-cms` aux nouveaux éléments du HTML |
| Certains textes ne sont pas éditables (morceaux de texte entourant un champ de formulaire, éléments animés, textes calculés par `ana-runtime.js`, estimateur de l'accueil) | Ils sont gérés par le code de la page | Modification dans le code |
| Les éléments des menus déroulants ne sont pas cliquables dans l'aperçu (menus fermés) | Le méga-menu s'ouvre au survol | Éditables via la liste « Champs éditables » de l'éditeur ou le mode « Naviguer » |
| `robots.txt` ignoré par les moteurs sous `github.io/site/` | robots.txt doit être à la racine du domaine | Soumettre `sitemap.xml` dans Search Console, ou domaine personnalisé |
| Redirections par page HTML (meta refresh + canonical), pas de 301 | GitHub Pages n'a pas de redirections serveur | Domaine derrière un CDN (Cloudflare) si des 301 sont nécessaires |
| Statistiques de l'admin : offre Plausible Business requise | La Stats API n'est pas incluse dans les offres inférieures | Consulter le tableau de bord Plausible directement ; ou adaptateur GA4 (non implémenté) |
| Pas de notion de session distincte des « visites » Plausible ; rebond et durée selon Plausible | Définitions du fournisseur | Définitions affichées dans l'admin |
| Pas de données historiques avant activation de Plausible | Aucune mesure n'existait (ID GA4 jamais renseigné) | — |
| Carte géographique non affichée (liste des pays à la place) | Pas de bibliothèque de carte ajoutée, pour la légèreté | Ajout possible (ex. carte choroplèthe) |
| Ancienne API `anaAnalytics` : journal localStorage et chargement GA4 retirés | Remplacés par Plausible sans cookie | `anaAnalytics.track()` reste disponible |
| Formulaires : sans Supabase configuré, comportement d'origine (confirmation sans envoi, aucune conversion) | Pas de backend avant mise en service | Configurer Supabase puis publier |
| Pas de notification e-mail à la réception d'une demande : l'alerte n'existe que dans l'administration (tableau de bord, pastille du menu, page « Demandes ») | Hors périmètre | Ouvrir l'administration chaque jour ; ou Database Webhook Supabase → Edge Function d'envoi (Resend, etc.) |
| « Demande vue / non vue » est mémorisé par navigateur, pas par compte ni pour l'équipe | Pas de colonne de suivi dans `leads` (aucune migration ajoutée) | Ajouter un statut de traitement en base si plusieurs personnes traitent les demandes |
| Un texte corrigé dans le HTML ne s'affiche que si sa clé change | Le contenu publié s'applique par-dessus le HTML | `npm run cms:rekey` avant la fusion (vérifié par `npm test`) ; `cms:seo-rev` pour les titres et descriptions |
| La fenêtre de l'accueil affiche un gabarit abstrait, pas le produit, tant qu'aucune capture n'est déposée ; une image d'un autre format que 16:9 est recadrée (haut et gauche conservés) | L'emplacement recouvre le gabarit et remplit la fenêtre | Déposer une capture 16:9 depuis l'éditeur (voir `docs/SETUP.md`, recette en ligne) |
| Les teintes par agent, par étape et par public sont posées dans le HTML (classes `ana-t-*`, `ana-r1` à `ana-r6`) : l'éditeur ne permet pas de les changer | Choix de sécurité : pas de changement de style depuis l'admin | Modifier la classe dans le HTML ; la palette est décrite dans `assets/css/site.css`, bloc « Couleur » |
| Les connecteurs marqués « Prévu » et la mention « société en cours d'immatriculation » sont des textes du HTML | Ils décrivent l'état du produit et de la société à la date de livraison | À mettre à jour (éditeur ou HTML) à chaque connecteur livré et à l'immatriculation |
| Si Supabase est indisponible, l'administration ne fonctionne pas (le site public n'est pas affecté) ; un projet gratuit est mis en pause après une semaine sans activité | Hébergement Supabase | Offre Pro, ou réactivation depuis le tableau de bord |
| Le texte riche utilise `document.execCommand` (déprécié mais supporté par tous les navigateurs) | Pas d'éditeur riche externe ajouté | Migration vers un éditeur riche (Tiptap) si besoin |
| Les tests e2e utilisent un backend simulé ; la RLS est testée séparément sur PostgreSQL | Pas de Supabase local dans l'environnement de développement | Ajouter `supabase start` en CI pour un test d'intégration complet |
| Un fichier média supprimé n'est plus visible dans les anciennes versions de l'historique | La suppression est refusée seulement pour les médias utilisés par un brouillon ou une version en ligne | Le build conserve alors l'image d'origine et le signale dans le journal |

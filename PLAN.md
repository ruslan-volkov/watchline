# Watchline (nom de travail) — Plan produit & technique

## Vision
Un "TV Time allégé" : tracking personnel des films/séries regardés, sans le bruit social. Usage principal : perso + partage passif avec quelques proches.

## Périmètre MVP

### Fonctionnalités incluses
- Tracker de progression épisode par épisode pour les séries
- Historique films vus + notes (5 étoiles)
- Watchlist ("à voir")
- Timeline : sorties à venir (épisodes + films) groupées par proximité temporelle (Aujourd'hui / Demain / Dans X jours)
- Amis : liste simple + activité passive (pas de fil d'actu, pas de likes/commentaires)
- Digest de notifications quotidien groupé (pas de push par titre en temps réel)
- Réglages : densité d'affichage (confort/dense), thème (système/clair/sombre), confidentialité activité

### Hors périmètre v1
- Fil d'activité social, commentaires, likes
- Import depuis Trakt/Letterboxd
- Recommandations personnalisées

## Stack technique
- **Frontend** : React Native + Expo (expo-router), TypeScript
- **Backend** : Supabase (Postgres, Auth, RLS)
- **Données médias** : TMDB API (films + séries + épisodes + dates de sortie, source unique)
- **Notifications** : Supabase Edge Function (cron) + Expo push, digest quotidien

## Modèle de données (Supabase)

```
USERS
  id uuid PK
  username string
  avatar_url string
  activity_visible boolean (default true)
  theme_preference enum('system','light','dark') default 'system'
  density_preference enum('comfortable','compact') default 'comfortable'
  digest_enabled boolean default true
  digest_time time

FRIENDSHIPS
  user_id uuid FK
  friend_id uuid FK
  status enum('pending','accepted')

MEDIA (cache TMDB)
  id uuid PK
  tmdb_id int
  media_type enum('movie','tv')
  title string
  poster_path string
  release_date date

WATCH_ENTRIES
  id uuid PK
  user_id uuid FK
  media_id uuid FK
  status enum('plan_to_watch','watching','completed')
  rating int (1-5, nullable)
  notes text
  started_at date
  finished_at date

EPISODE_PROGRESS
  id uuid PK
  entry_id uuid FK -> WATCH_ENTRIES
  season_number int
  episode_number int
  watched_at date
```

RLS : un user voit ses propres `watch_entries` + celles de ses amis acceptés avec `activity_visible = true`, en lecture seule.

## Design system

### Direction visuelle retenue
"V1 confort" : cartes espacées, palette pastel douce, un statut clairement identifiable par écran. Densité (confort/dense) et thème (clair/sombre) doivent cohabiter sur les mêmes composants — pas de composants dupliqués par mode.

### Typographie
Sentence case partout. Hiérarchie simple : titre d'écran, titre de section (discret), corps de texte, métadonnées (encore plus discret). Pas besoin de plus de précision ici — à ajuster visuellement une fois l'app qui tourne.

### Couleurs
- Chaque média affiche une couleur de "poster placeholder" tant qu'on n'a pas l'affiche réelle de TMDB, assignée arbitrairement pour distinguer les items dans une liste
- Les badges de statut utilisent une paire fond clair + texte de la même teinte (jamais de texte noir sur fond coloré)
- Les barres de progression utilisent une teinte plus soutenue de la couleur du média concerné

### Composants réutilisables (sans dimensions précises — à ajuster à l'usage)
- **Ligne de liste** (timeline, watchlist) : poster + titre + sous-texte toujours contextualisé (jamais une date brute seule — "sort demain", "S3E7 disponible", etc.)
- **Carte "en cours"** : poster avec barre de progression fine en bas + bouton check en overlay (jamais de swipe)
- **Badge de statut** : pilule discrète
- **Notation** : 5 étoiles tap-to-rate, jamais pré-remplies, jamais obligatoires
- **Empty state** : icône → titre contextuel → une phrase qui explique la valeur → un bouton d'action
- **Tab bar** : 4 icônes (accueil, watchlist, bibliothèque, profil)

## Décisions UX validées

### Marquer un épisode vu
- Action = **tap direct** sur un bouton check (jamais de swipe — conflit d'axe avec le scroll horizontal du carrousel "En cours")
- Accessible depuis la fiche détaillée ET depuis un bouton check en overlay sur le poster à l'accueil
- **Cascade automatique** : marquer un épisode marque aussi tous les épisodes non vus avant lui
  - Écart ≤ 5 épisodes : toast non-bloquant "Épisodes X-Y marqués vus aussi · Annuler"
  - Écart > 5 épisodes : dialogue de confirmation bloquant (probable erreur de tap)
- Re-tap sur un épisode vu le décoche

### Recherche & ajout
- Recherche TMDB, tap sur résultat → choix de statut immédiat (à voir/en cours/vu)
- Passer à "vu" déclenche la notation (optionnelle, "Passer" toujours disponible)

### Statut & notation
- 3 statuts : à voir / en cours / vu
- Notation 5 étoiles + note texte libre, uniquement proposée au passage en "vu", jamais obligatoire

### Amis
- Demande d'ami (pas d'ajout direct), activité invisible tant que non acceptée
- Toggle global `activity_visible` dans le profil pour masquer son activité de tous ses amis

### Notifications
- Digest quotidien groupé (sorties du jour/lendemain), pas de notification par titre en temps réel

### Réglages d'affichage
- Densité (confort/dense) et thème (système/clair/sombre) : deux réglages indépendants, même mécanique technique (préférence stockée sur `USERS`, appliquée via contexte React)
- Palette construite sur des tokens de couleur qui basculent clair/sombre automatiquement (pas de palette dark séparée à maintenir)

### Onboarding
- Écran 1 : proposition de valeur en une phrase + 3 boutons auth (Apple / Google / e-mail via Supabase Auth)
- Écran 2 : un seul champ obligatoire (pseudo), photo de profil optionnelle — pas de questionnaire
- Écran 3 : confirmation qui pousse directement vers l'action "Ajouter un titre" (pas d'accueil vide sans guidance)

### États vides
- Chaque écran vide (timeline/watchlist/bibliothèque) a : icône → titre contextuel → une phrase qui explique la valeur (pas une excuse) → un bouton d'action
- Exemples de ton : "Rien à l'horizon" (timeline), "Ta watchlist est vide" (watchlist), "Aucun historique pour l'instant" (bibliothèque) — jamais de "Rien ici" générique

## Écrans du MVP

### 1. Accueil / timeline
- Sections groupées par proximité temporelle : "Aujourd'hui", "Demain", "Dans X jours" (pas de dates calendaires brutes)
- Chaque ligne distingue épisode dispo (pas de badge) vs film qui sort (badge "à voir")
- Section "En cours" en dessous : scroll horizontal de cartes avec progression + bouton check

### 2. Fiche média
- Bouton de statut principal (à voir/en cours/vu) + bouton "Noter"
- Si série en cours : progression saison (compteur + barre)
- Liste d'épisodes cochables un par un, avec logique de cascade (voir Flows)

### 3. Watchlist
- Filtres : Tout / Films / Séries
- Sous-texte contextuel par item ("sort demain", "disponible", "S3 dès le 20 juillet")
- Ajout via recherche

### 4. Bibliothèque
- Compteurs simples en haut (épisodes vus, films vus, en cours) — pas de graphiques
- Tri : Récent / Mieux notés / A-Z
- Vue grille de posters avec note

### 5. Profil
- Liste d'amis avec activité passive en une ligne ("Regarde Slow horses") — respecte `activity_visible`
- Réglages : densité, thème, notifications, compte, déconnexion

## Flows validés
1. Marquer un épisode vu (avec cascade)
2. Recherche & ajout d'un titre
3. Onboarding (auth Apple/Google/email → pseudo → premier ajout)
4. Changement de statut + notation
5. Ajout d'ami (demande → acceptation → activité visible)
6. États vides

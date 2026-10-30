# Watchline

Tracking perso de films & séries — « TV Time allégé ». React Native (Expo) + Supabase.
Voir [PLAN.md](PLAN.md) pour la vision produit complète.

## Stack
- **Expo** (SDK 54, compatible avec l'Expo Go installé) + **expo-router** + TypeScript
- **Supabase** (Postgres, Auth e-mail, RLS)
- **TanStack Query** pour l'état serveur
- Données média : **TMDB** (`src/media/tmdb.ts`) derrière l'interface `MediaProvider`. Bascule automatiquement sur le mock (`src/media/mock.ts`) si `EXPO_PUBLIC_TMDB_ACCESS_TOKEN` est absent.

## Périmètre implémenté (Phase 1 — cœur)
Auth e-mail + onboarding, recherche & ajout, statuts (à voir / en cours / vu), progression
épisode par épisode avec **cascade** (toast ≤ 5, dialogue > 5, re-tap décoche), notation
5 étoiles + note, timeline groupée par échéance, watchlist filtrable, bibliothèque
(compteurs + tris + grille), profil (thème, densité, notifications, déconnexion).

Thème (système/clair/sombre) et densité (confort/dense) partagent les mêmes composants via
des tokens qui basculent automatiquement (`src/theme/tokens.ts`).

Bouton d'ajout en **bouton flottant (FAB)** sur l'accueil et la watchlist.

### Amis (Phase 2 — fait)
Recherche par pseudo (RPC `search_profiles`), demande / acceptation / refus, liste d'amis
avec activité passive une ligne (« Regarde … »), respect de `activity_visible`. RLS testée
de bout en bout (privé, ami visible, ami masqué, visibilité des demandes en attente).

### TMDB (Phase 2 — fait)
Recherche multi (films + séries), fiche film, fiche série avec saisons/épisodes réels
(titres + dates en français) alimentant la cascade. Jeton dans `EXPO_PUBLIC_TMDB_ACCESS_TOKEN`.

> ⚠️ Les variables `EXPO_PUBLIC_*` sont injectées au build : après modif de `.env`,
> relance Metro en vidant le cache — `npx expo start --clear`.

### Digest de notifications (Phase 2 — backend fait)
- Table `push_tokens` (RLS par utilisateur) + enregistrement du token côté client
  (`src/features/notifications/`, no-op silencieux hors development build).
- Edge Function `daily-digest` (`supabase/functions/daily-digest/`) : calcule les sorties
  du jour par utilisateur (films de la watchlist sortant aujourd'hui + épisodes du jour via
  TMDB `next/last_episode_to_air`) et envoie un push Expo groupé. Protégée par `x-cron-secret`.
- Planifiée par `pg_cron` tous les jours à 08:00 UTC.
- **Secrets** de la fonction (`TMDB_ACCESS_TOKEN`, `CRON_SECRET`) : dans `supabase/functions/.env`
  (local, non commité — voir `.env.example`). Les pousser vers la fonction déployée avec :
  `supabase secrets set --env-file supabase/functions/.env --project-ref <ref>`. Sans
  `TMDB_ACCESS_TOKEN`, le digest saute la détection d'épisodes mais fonctionne pour les films.
- **La réception se teste sur un development build** (le push distant est inactif dans Expo Go).
  `digest_time` par utilisateur n'est pas encore honoré (envoi unique à 08:00 UTC) — amélioration future.

### Reste de la Phase 2 (prérequis externes)
- **Auth Apple/Google** : nécessite un development build + config native OAuth.

## Configuration
Le fichier `.env` est déjà renseigné avec le projet Supabase `watchline` (`ruagmrftlzfrispfmvsp`).
Pour repartir sur un autre projet, copie `.env.example` → `.env` et remplis les deux variables.

Le schéma est versionné dans [`supabase/migrations/`](supabase/migrations) (déjà appliqué sur le projet cloud).

### ⚠️ Étape manuelle : confirmation e-mail
Par défaut, Supabase exige une confirmation par e-mail à l'inscription (pas de session
immédiate). Pour un usage perso fluide, désactive-la :
**Dashboard Supabase → Authentication → Sign In / Providers → Email → décocher « Confirm email ».**
Sans ça, après inscription il faut cliquer le lien reçu par mail avant de pouvoir se connecter
(l'app gère ce cas et affiche un message).

## Lancer
```bash
npm install --legacy-peer-deps
npx expo start
```
Puis `i` (simulateur iOS), `a` (Android) ou scanne le QR avec Expo Go.

## Développement local (backend jetable)
Le schéma et la fonction tournent en local, sans jamais toucher au projet cloud.

```bash
supabase start                      # Postgres + Auth + Storage + Edge runtime (Docker)
supabase db reset                   # rejoue les 10 migrations sur une base vierge
./scripts/use-local-backend.sh      # écrit .env.local (prioritaire sur .env)
npx expo start                      # l'app parle au backend local
```

`supabase db reset` est le test de reproductibilité du schéma : il doit passer sans
erreur sur une base vide. Ce qu'il faut savoir :

- **Droits API** — Supabase n'accorde plus automatiquement le DML sur les nouveaux
  objets de `public`. Sans `0010_api_grants.sql`, les 6 tables remontent à froid sans
  `SELECT` et toute requête échoue en `42501`. Les droits y sont alignés sur les
  policies RLS de chaque table ; `anon` n'en reçoit aucun, volontairement.
  ⚠️ Cette migration n'est pas encore appliquée sur le projet cloud (qui porte les
  droits héritées de l'ancien défaut) — voir `FORMATION-DEPLOIEMENT.md`, palier 3.
- **Fonction** — `supabase functions serve --env-file supabase/functions/.env`.
  Les secrets sont lus dans ce fichier (non commité) ; le conteneur ne les recharge
  qu'au (re)démarrage de `serve`.
- **Confirmation e-mail** — désactivée par `config.toml` en local, alors qu'elle exige
  un clic au tableau de bord sur le cloud. Les mails partent dans Mailpit
  (http://127.0.0.1:54324), Studio est sur http://127.0.0.1:54323.
- **Hôtes** — le simulateur iOS partage le `localhost` de la machine. Un émulateur
  Android veut `10.0.2.2`, un appareil physique l'IP du réseau local :
  `./scripts/use-local-backend.sh 192.168.1.20`.

Revenir au cloud : supprimer `.env.local`.

## Vérifs
```bash
npx tsc --noEmit              # typecheck
npx expo export --platform ios --output-dir /tmp/wl-export   # bundle de contrôle
```

# Watchline

Tracking perso de films & séries — « TV Time allégé ». React Native (Expo) + Supabase.
Voir [PLAN.md](PLAN.md) pour la vision produit complète.

## Stack
- **Expo** (SDK 54, compatible avec l'Expo Go installé) + **expo-router** + TypeScript
- **Supabase** (Postgres, Auth e-mail, RLS)
- **TanStack Query** pour l'état serveur
- **PostHog** pour l’analytics produit (`src/lib/analytics.ts`), no-op sans `EXPO_PUBLIC_POSTHOG_KEY`
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

### Téléchargements vers un NAS (fait)
Depuis la fiche d'un film ou d'une série, Watchline demande à **Radarr** (films) ou **Sonarr**
(séries, saisons, épisodes) de télécharger le titre. La qualité, les langues et les indexeurs
(c411…) restent réglés sur le NAS : l'app envoie seulement « télécharge ce titre ».

- **Config** : Profil → NAS (`app/nas.tsx`). Adresse + clé API de chaque service, testées avant
  d'être enregistrées ; le profil de qualité et le dossier par défaut sont choisis parmi ceux que
  le NAS déclare. Les clés vont dans le trousseau (`expo-secure-store`), jamais dans le cache
  React Query (persisté en clair) ni dans Supabase. La config reste sur l'appareil.
- **Fiche média** : ligne « Télécharger » (film / série), icône par saison et par épisode. Un
  **appui long** choisit un autre profil de qualité pour ce téléchargement. L'état (en file,
  téléchargement x %, sur le NAS) se rafraîchit tant que quelque chose est en cours.
- **Séries** : TMDB → TVDB via `/tv/{id}/external_ids` ; une série neuve est ajoutée sans rien
  surveiller, puis seuls les épisodes demandés sont surveillés et cherchés.
- **Réseau** : le NAS doit être joignable depuis le téléphone (Wi-Fi maison, Tailscale…). iOS
  n'autorise le HTTP clair que pour une IP ou un nom `.local` ; pour un nom Tailscale, passer en
  HTTPS (`tailscale serve`). Android n'est pas géré (HTTP clair bloqué par défaut).
- **Notification de fin** : l'Edge Function `nas-download-complete` reçoit le webhook
  Radarr/Sonarr (« On Import ») et envoie un push. Une seule adresse à coller dans Radarr et
  Sonarr, affichée dans l'écran NAS : elle porte un jeton personnel (table `nas_webhook_tokens`,
  créé à la première ouverture de l'écran), pas d'en-tête ni de secret à régler. Optionnelle :
  sans elle, l'app suit quand même l'état tant qu'elle est ouverte.
  ```bash
  supabase db push --project-ref <ref>
  supabase functions deploy nas-download-complete --no-verify-jwt --project-ref <ref>
  ```
- **Essayer sans NAS** : `node scripts/fake-arr.mjs` simule Radarr (:7878) et Sonarr (:8989),
  clé API `test-key`. Le parcours est couvert par `.maestro/nas-download.yaml`.

### Analytics (Phase 2 — fait)
Tout passe par `src/lib/analytics.ts` : les noms d'événements et leurs propriétés y sont
typés, donc renommer un événement casse le build au lieu de couper un funnel en deux.
`src/contexts/AnalyticsContext.tsx` branche la couche sur le cycle de vie de l'app —
consentement, compte identifié, vues d'écran. Expo Router n'a pas d'intégration de screen
tracking : on suit `usePathname()` depuis le layout racine, comme le recommande la doc Expo.

- **Clé** : `EXPO_PUBLIC_POSTHOG_KEY` (+ `EXPO_PUBLIC_POSTHOG_HOST`, cloud EU par défaut).
  Sans clé la couche est un **no-op** — et en dev elle logge les événements dans la console,
  de quoi vérifier l'instrumentation sans projet PostHog.
- **Opt-out** : interrupteur « Partager les statistiques d'usage » dans Profil →
  Confidentialité, persisté en AsyncStorage. Rien n'est envoyé avant que le consentement
  stocké ait été relu au démarrage, donc un utilisateur désinscrit ne fuite pas d'événement
  de lancement.
- **Builds dev** : les événements partent dans le même projet, marqués
  `app_env=development` — filtre là-dessus dans PostHog plutôt que de les jeter, sinon
  l'instrumentation n'est vérifiable nulle part.
- **Jamais envoyé** : e-mail, texte des recherches, contenu des notes, titres en clair.
  Un titre voyage en `tmdb_id`, une recherche en longueur + nombre de résultats.
- **Événements** : `signed_up` / `signed_in` / `signed_out`, `onboarding_completed`,
  `entry_added`, `entry_status_changed`, `entry_rated`, `entry_snooze_toggled`,
  `entry_removed`, `episode_marked` (`next` / `manual` / `cascade`), `episode_unmarked`,
  `media_opened`, `search_performed`, `friend_request_sent` / `_accepted`,
  `download_requested` / `download_failed`, `push_registration`, `setting_changed` — plus `$screen` et le cycle de vie applicatif
  capturés par le SDK. Les gestes sur une entrée portent une propriété `source`
  (`home`, `search`, `media_detail`, `watchlist`…) : le même geste se compare selon
  l'endroit d'où il est offert.

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

## Vérifs
```bash
npx tsc --noEmit              # typecheck
npx expo export --platform ios --output-dir /tmp/wl-export   # bundle de contrôle
```

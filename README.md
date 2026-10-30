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
- Planifiée par `pg_cron` toutes les heures (`0 * * * *`) : la fonction compare l'heure
  locale de chaque utilisateur à son `digest_time`, donc un seul tir quotidien ne
  toucherait que ceux dont l'heure choisie coïncide.
- **Secrets** de la fonction (`TMDB_ACCESS_TOKEN`, `CRON_SECRET`) : dans `supabase/functions/.env`
  (local, non commité — voir `.env.example`). Les pousser vers la fonction déployée avec :
  `supabase secrets set --env-file supabase/functions/.env --project-ref <ref>`. Sans
  `TMDB_ACCESS_TOKEN`, le digest saute la détection d'épisodes mais fonctionne pour les films.
- **La réception se teste sur un development build** (le push distant est inactif dans Expo Go).

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
  créé à la première ouverture de l'écran, remplaçable par un bouton si elle fuit), pas d'en-tête ni de secret à régler. Optionnelle :
  sans elle, l'app suit quand même l'état tant qu'elle est ouverte.
  ```bash
  # Pas de `supabase db push` : l'historique des migrations de la prod (horodatages) ne
  # correspond pas aux fichiers 000N. Appliquer 0013_nas_webhook_tokens.sql à la main
  # (éditeur SQL du tableau de bord) puis déployer la fonction :
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
Le dépôt ne nomme aucun projet Supabase : `.env` (non commité) décide vers lequel l'app
parle, `.env.local` le surcharge, et `scripts/use-local-backend.sh` écrit ce dernier pour
pointer sur la stack locale. Copie `.env.example` → `.env` et remplis les deux variables.

En revanche, **un build EAS ne lit pas ces fichiers** : les `EXPO_PUBLIC_*` y viennent des
environnements EAS, et `eas.json` associe chaque profil au sien (`development`, `preview`,
`production`). Changer d'environnement est donc un changement de build, pas de fichier —
voir `FORMATION-DEPLOIEMENT.md`, palier 3.

Aujourd'hui `production` pointe sur le projet de prod et `preview` sur staging.
`development` est volontairement vide : ces profils chargent le JS depuis Metro, qui lit
`.env` en local. Inspecter avec `eas env:list --environment <env>`.

> ⚠️ `eas env:pull` écrit par défaut dans `.env.local` — le fichier dont
> `scripts/use-local-backend.sh` se sert pour pointer sur la stack locale. Passe toujours
> `--path`, sinon ton dev local repart vers la prod sans rien dire.

Il existe deux projets Supabase — production et staging — et le dépôt n'en nomme aucun.
Une migration passe par staging avant d'atteindre la prod ; la procédure est dans
`FORMATION-DEPLOIEMENT.md`, palier 3.

Le schéma est versionné dans [`supabase/migrations/`](supabase/migrations). Être sur
`master` ne veut pas dire être appliqué : rien n'automatise encore le déploiement.
Staging porte les 16 migrations ; la prod en porte 14 — il lui manque `0017` et
`0015_digest_schedule`, ce dernier ne devant pas partir avant que ses deux valeurs Vault
soient posées, sinon le digest s'envoie avec un en-tête nul. Et **`supabase db push`
n'est pas utilisable sur ces projets** : leur historique porte des versions horodatées qui
ne correspondent pas aux noms de fichiers, donc la CLI ne reconnaîtrait aucune migration
comme appliquée et rejouerait tout. Les migrations se posent par l'API de management ou le
tableau de bord.

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
  droits hérités de l'ancien défaut) — voir `FORMATION-DEPLOIEMENT.md`, palier 3.
- **Planification** — `0015_digest_schedule.sql` déclare le job `pg_cron`, qui lit son
  secret et son URL de base dans Vault au moment de l'appel. Ces deux valeurs sont de
  la configuration, pas du schéma : `supabase/seed.sql` les pose pour le local (et y
  désactive le job — le digest poste vers `exp.host`, donc un stack de dev avec de vrais
  jetons atteindrait de vrais appareils). Pour l'exercer quand même :
  `select cron.alter_job((select jobid from cron.job where jobname = 'watchline-daily-digest'), active := true);`
  Sur un projet déployé, il faut poser les deux valeurs une fois — sinon le job échoue au
  tir et la raison apparaît dans `cron.job_run_details`.
- **Fonction** — `supabase functions serve --env-file supabase/functions/.env`.
  Les secrets sont lus dans ce fichier (non commité) ; le conteneur ne les recharge
  qu'au (re)démarrage de `serve`.
- **Confirmation e-mail** — désactivée par `config.toml` en local, alors qu'elle exige
  un clic au tableau de bord sur le cloud. Les mails restent dans le serveur de test
  local au lieu de partir chez le destinataire.
- **URL et ports** — demande-les à `supabase status`, ne les écris pas en dur : ils
  viennent de `config.toml`, et un `supabase start -x <service>` peut laisser Studio
  ou le serveur de mail de côté (les tests e2e le font).
- **⚠️ La stack est partagée** — le `project_id` étant dans un fichier versionné, tous
  les worktrees du dépôt pilotent *les mêmes* conteneurs. Un `supabase db reset` fait
  donc échouer le run e2e de quelqu'un d'autre, et un `supabase stop` le coupe net.
  Vérifie avec `docker ps --filter name=watchline` avant de réinitialiser.
- **Hôtes** — le simulateur iOS partage le `localhost` de la machine. Un émulateur
  Android veut `10.0.2.2`, un appareil physique l'IP du réseau local :
  `./scripts/use-local-backend.sh 192.168.1.20`.

Revenir au cloud : supprimer `.env.local`.

## Vérifs
```bash
npx tsc --noEmit              # typecheck
npx expo export --platform ios --output-dir /tmp/wl-export   # bundle de contrôle
```

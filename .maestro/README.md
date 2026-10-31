# Tests de bout en bout (Maestro)

Parcours utilisateur joués sur le simulateur iOS, contre un Supabase **local** (Docker) —
jamais contre la prod. Sans jeton TMDB dans le build, la recherche répond depuis
`src/media/mock.ts`, donc les titres sont stables.

## Prérequis (une fois)
- Xcode installé et sa licence acceptée : `sudo xcodebuild -license accept`
- Docker lancé
- Maestro : `brew install mobile-dev-inc/tap/maestro` (nécessite un JDK : `brew install openjdk`)
- Un simulateur iOS « iPhone 17 Pro » (autre appareil : `E2E_DEVICE="iPhone 17" npm run test:e2e`)

## Lancer
```bash
npm run test:e2e
```
Le script (`scripts/e2e-ios.sh`) démarre Supabase local, construit l'app en **Release**
(le bundle JS est embarqué : pas de Metro) avec `EXPO_PUBLIC_SUPABASE_*` pointant vers la
stack locale, l'installe sur le simulateur, puis lance les flows de ce dossier.

L'app est construite avec `APP_VARIANT=development` (id `com.rvolkov.watchline.dev`) pour ne
pas écraser une vraie installation de « Watchline ».

## Les flows
- `onboarding-add-title.yaml` : inscription, pseudo, ajout d'un titre, présence dans la watchlist.
- `friends.yaml` : demande d'ami, activité visible, puis « Activité masquée ». L'amie est un
  second utilisateur créé et piloté par l'API (`scripts/*.js`, qui reçoivent `API_URL` et
  `ANON_KEY` via `maestro test -e`) : pas besoin d'un second simulateur.
- `nas-download.yaml` : relie l'app à un Radarr et un Sonarr, puis télécharge un film et une
  série. Ils sont simulés par `scripts/fake-arr.mjs`, que `scripts/e2e-ios.sh` démarre
  (clé API `test-key`).
- `recommendations.yaml` : l'ami recommande une série (via l'Edge Function `recommend-media`,
  que `scripts/e2e-ios.sh` sert le temps du test), ajout à la liste, envoi d'un titre en
  retour, puis relance.
- `subflows/` : étapes partagées (non lancées seules par `maestro test .maestro`).

> ⚠️ La stack locale `watchline-e2e` est partagée par tous les worktrees qui utilisent
> `supabase/config.toml`. Un `supabase db reset` lancé ailleurs pendant un test efface ses
> comptes et le fait échouer ; relancer suffit.

## Écrire un flow
- Cibler par texte visible ou `accessibilityLabel` d'abord ; `testID` seulement pour les
  champs de saisie, qui n'ont pas de texte propre (`sign-up-email`, `onboarding-username`…).
- Un compte neuf par exécution (e-mail horodaté) : les flows n'ont pas besoin de remise à zéro
  de la base.

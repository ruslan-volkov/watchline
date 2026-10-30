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

## Écrire un flow
- Cibler par texte visible ou `accessibilityLabel` d'abord ; `testID` seulement pour les
  champs de saisie, qui n'ont pas de texte propre (`sign-up-email`, `onboarding-username`…).
- Un compte neuf par exécution (e-mail horodaté) : les flows n'ont pas besoin de remise à zéro
  de la base.

# Formation déploiement — Watchline comme terrain d'exercice

Parcours en 8 paliers, du plus fondamental au plus avancé. Chaque palier part d'un
manque **réel** de ce repo, pas d'un exercice artificiel. L'ordre compte : chacun
s'appuie sur le précédent.

Pour chaque palier : ce qui manque aujourd'hui, ce que tu construis, le critère de
réussite, et le concept transférable (ce que tu retiendras quand tu auras oublié
Supabase et Expo).

---

## Palier 0 — Reproduire l'environnement en local

**État actuel** — Il n'y a pas de `supabase/config.toml`. La stack locale n'a jamais
été initialisée : les 9 migrations de `supabase/migrations/` n'ont été appliquées que
sur le projet cloud, à la main. Impossible de repartir de zéro sans toucher la prod.

**À faire**
- `supabase init` puis `supabase start` (Postgres + Auth + Storage en local, via Docker).
- `supabase db reset` : vérifier que les 9 migrations rejouent *dans l'ordre, à vide,
  sans erreur*. C'est loin d'être garanti — une migration écrite contre une base
  vivante casse souvent à froid.
- `supabase functions serve daily-digest` et l'appeler avec `curl` + le header
  `x-cron-secret`.
- Pointer l'app dessus : un `.env.local` avec l'URL locale (`http://127.0.0.1:55321`).

**Réussi quand** — `supabase db reset && supabase functions serve` te donne un backend
complet et jetable, et l'app tourne contre lui sans toucher au projet cloud.

**✅ Fait le 2026-10-29.** Ce que le rejeu à froid a révélé :

1. **Les 9 migrations passent toutes à vide** — y compris `pg_cron` et la conversion
   de type de `rating`. Mon pronostic était pessimiste.
2. **Mais le schéma n'était pas suffisant.** Les 6 tables remontaient avec
   `REFERENCES/TRIGGER/TRUNCATE` et aucun `SELECT` : toute requête tombait en `42501`.
   La prod fonctionne parce qu'elle est antérieure au changement de défaut Supabase,
   pas parce que le dépôt le décrit. Corrigé par `0010_api_grants.sql`, où les droits
   sont alignés sur les policies de chaque table — deux couches indépendantes qui
   doivent se répondre.
3. **Le secret codé en dur est dangereux, et ça s'est prouvé par accident.** Le
   conteneur de fonctions avait démarré avant que `supabase/functions/.env` existe :
   `CRON_SECRET` était absent, et la fonction a **accepté** une requête portant le
   secret public du dépôt (HTTP 200) au lieu de tomber en panne. C'est le scénario du
   palier 1, reproduit en vrai.
4. **La fonction avale ses erreurs** : elle destructure `{ data }` sans jamais lire
   `error`. Une requête refusée renvoie `{"sent":0,"reason":"no eligible tokens"}` en
   HTTP 200 — indiscernable d'une journée calme. À traiter au palier 7 ; c'est aussi
   pourquoi un 200 ne prouve rien ici, et pourquoi les droits `service_role` ont dû
   être vérifiés directement par requête REST.
5. **Code et planification se contredisent** : le commentaire dit « Runs hourly » et le
   code compare l'heure locale de chaque utilisateur, mais le cron de 0004 est
   `0 8 * * *`, une fois par jour. Le `digest_time` par utilisateur ne peut donc pas
   fonctionner. À traiter au palier 2.

Livré : `supabase/config.toml` (`project_id`, `verify_jwt = false` pour la fonction),
`supabase/migrations/0010_api_grants.sql`, `scripts/use-local-backend.sh`, et la
section « Développement local » du README.

**Concept** — *Dev/prod parity* et reproductibilité. Un déploiement n'est fiable que si
l'environnement est jetable et recréable par une commande. C'est le prérequis de tout
le reste : sans ça, tu ne peux ni tester un pipeline ni répéter un rollback.

---

## Palier 1 — Faire échouer les secrets correctement

**État actuel** — `supabase/functions/daily-digest/index.ts:5` :

```ts
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? 'wl_cron_<redacted>';
```

Un fallback codé en dur, dans un fichier versionné, pour le seul mécanisme qui protège
la fonction (`verify_jwt` est désactivé). Si la variable d'environnement disparaît lors
d'un déploiement, la fonction ne tombe pas en panne : elle continue de tourner avec un
secret public. C'est le pire des deux mondes — une défaillance silencieuse qui ouvre
l'accès.

**À faire**
- Supprimer le fallback ; lever une erreur au chargement du module si `CRON_SECRET`
  est absent (*fail fast*, pas à la première requête).
- Rotation : générer un nouveau secret, le pousser (`supabase secrets set`), mettre à
  jour le job cron, vérifier que l'ancien est refusé. Mesurer la fenêtre d'indisponibilité.
- Comparer la vérification du secret à une comparaison en temps constant — et décider
  si ça vaut le coup ici (indice : ça dépend du modèle de menace, pas de la mode).
- Vérifier qu'aucun secret ne traîne : `git log -p -- supabase/functions/ | grep -iE 'secret|token'`.

**Réussi quand** — La fonction refuse de démarrer sans configuration, et tu sais faire
tourner un secret en production en connaissant le temps de coupure.

**🟡 Moitié faite le 2026-10-30.** La partie locale est bouclée ; la rotation en
production attend ton accord (elle touche le projet cloud).

Le portail, avant et après, mesuré sur la stack locale :

| Requête | Avant | Après |
| --- | --- | --- |
| sans en-tête | 401 | 500 |
| mauvais secret | 401 | 500 |
| bon secret | 200 | 500 |
| secret du dépôt | **200** | 500 |

La colonne « après » est prise avec `CRON_SECRET` retiré de l'environnement : plus
aucune requête ne passe, et le log dit pourquoi en une ligne. C'est la ligne
`secret du dépôt → 200` qui était le vrai défaut.

1. **« Fail fast » ne veut pas dire « le déploiement échoue ».** Le `throw` est au
   chargement du module, mais l'edge runtime instancie le worker *à la première
   requête* : le déploiement réussit, et on ne découvre la panne qu'au déclenchement
   du cron. Fail-closed, oui ; fail-early, non. Une configuration manquante reste donc
   invisible jusqu'à 08:00 UTC — c'est l'argument d'un *dead man's switch* au palier 7.
2. **Un secret dans l'historique se propage.** Le scan n'a pas trouvé que le commit
   d'origine (`40bd381`) : mon propre commit de palier 0 l'avait recopié dans ce
   fichier en citant la ligne fautive. Deux emplacements pour une seule fuite. Le
   dépôt étant privé, c'est une urgence modérée, pas une alerte.
3. **Comparaison en temps constant : non, et avec des chiffres.** La fuite temporelle
   d'un `!==` sur chaîne courte est de l'ordre de la nanoseconde ; la gigue réseau est
   de l'ordre de la milliseconde, soit six ordres de grandeur au-dessus. Il faudrait
   ~10¹² requêtes par position d'octet pour la faire émerger du bruit, sur un point
   d'entrée limité en débit et avec un secret de 256 bits. Ce n'est pas le maillon
   faible : le maillon faible, c'est que le secret a traîné dans un fichier versionné
   et voyage en clair dans un en-tête. On le fait tourner, on n'ajoute pas de
   cérémonie cryptographique.
4. **La fenêtre d'indisponibilité vient d'une duplication, pas d'une lenteur.** Le
   secret existe dans deux systèmes : la variable d'env de la fonction et le corps SQL
   du job `pg_cron` (d'où le « applied out-of-band » de `0004`). Les deux ne peuvent
   pas changer au même instant, donc toute rotation a une fenêtre. La supprimer n'est
   pas un problème de rapidité : il faut que le cron lise le secret au moment de
   l'appel (Supabase Vault) au lieu de le porter en dur — à traiter au palier 2.

Livré : le `throw` au chargement dans `supabase/functions/daily-digest/index.ts`, la
citation du secret retirée de ce fichier, et la note de génération dans
`supabase/functions/.env.example`. Les deux autres fonctions (`notify-friend-*`)
gardent `verify_jwt`, dérivent l'identité du JWT de l'appelant et n'ont pas ce défaut.

**Rotation tentée en production le 2026-10-30, annulée volontairement.** Déroulé :

| t (UTC) | Événement |
| --- | --- |
| 19:02 | relevé de l'état réel du projet cloud |
| 19:05:41 | `supabase secrets set CRON_SECRET` → nouveau secret sur la fonction |
| 19:05–19:07 | **fenêtre ouverte** : la fonction attend le nouveau, le cron envoie l'ancien |
| 19:07:30 | retour arrière, ancien secret remis |
| 19:08 | sonde : HTTP 200, service rétabli |

**Fenêtre : 109 s.** Le cron (prochain tir 20:00) n'a jamais été déclenché dedans :
zéro digest manqué. Mais ce chiffre ne mesure pas la plateforme — il mesure mon temps
de réaction entre deux commandes. La propagation réelle de `secrets set` vers le worker
n'a pas pu être chronométrée, la sonde répétée vers la production ayant été refusée.

5. **Le secret de production *était* le littéral du dépôt.** Les deux sha256 coïncident.
   Ce n'était donc pas une hypothèse : la valeur présente dans `40bd381` est celle qui
   gardait la fonction. (Au passage, `supabase secrets list` publie le sha256 de chaque
   valeur — de quoi confirmer un secret deviné, sans le révéler.)
6. **La production tourne `0 * * * *`, toutes les heures.** Le commentaire de `0004` et
   le README annonçaient `0 8 * * *`, une fois par jour. C'est le dépôt qui dérive de la
   production, pas l'inverse : le « Runs hourly » du code et le `digest_time` par
   utilisateur sont donc corrects en prod. Ça **annule la conclusion n° 5 du palier 0**.
   Pire, le commentaire de `0004` est une recette : la réappliquer sur un projet neuf
   aurait créé une planification différente de la production, en silence. Corrigé.
7. **La duplication n'est pas qu'une fenêtre, c'est un mur d'automatisation.** Les deux
   côtés ne se manipulent pas de la même façon : la variable d'env de la fonction se met
   à jour *depuis un fichier*, sans que personne ne lise la valeur ; le SQL du job cron,
   lui, exige d'écrire le secret en clair dans la commande. C'est ce qui a arrêté la
   rotation — pas un obstacle technique, une conséquence du choix de conception. Tant que
   le secret est porté en dur par le cron, la rotation ne peut pas être automatisée du
   tout, et ne peut être faite que par quelqu'un qui a le droit de voir la valeur.

**Le vrai correctif** n'est donc pas « rotationner plus vite ». C'est que le cron lise le
secret au moment de l'appel — `vault.decrypted_secrets` dans le `jsonb_build_object` —
pour que sa commande n'en contienne aucun. Une rotation redevient alors une écriture dans
un seul système, sans fenêtre et automatisable. À faire au palier 2, dont c'est le sujet.

Reste à faire : la rotation elle-même, une fois le cron découplé du secret.

**Concept** — *Fail closed, fail fast* et rotation de secrets. Une config absente doit
provoquer une panne bruyante au démarrage, jamais une dégradation silencieuse de la
sécurité. Vrai partout : variables d'env, feature flags, certificats.

---

## Palier 2 — Mettre l'infrastructure sous contrôle de version

**État actuel** — `supabase/migrations/0004_push_tokens.sql:26-35` : la planification
`pg_cron` du digest est un **bloc SQL commenté**, avec la note « Applied out-of-band ».
Le job qui tourne en production n'existe dans aucun fichier. Si le projet Supabase est
perdu, cette planification est perdue — et personne ne peut savoir, en lisant le repo,
à quelle heure le digest part ni vers quelle URL.

C'est le cas d'école de la *dérive de configuration* (configuration drift) : l'état réel
du système n'est plus décrit par le code.

**À faire**
- Rendre la planification déclarative. Le blocage est réel — le SQL embarque le secret.
  Deux voies, explore les deux :
  1. **Supabase Vault** : stocker le secret dans `vault.secrets`, et écrire une migration
     qui le lit (`select decrypted_secret from vault.decrypted_secrets ...`) au lieu de
     l'inliner. La migration devient committable.
  2. Un script de provisionnement idempotent (`scripts/provision-cron.mjs`) qui lit le
     secret dans l'environnement et appelle `cron.unschedule` puis `cron.schedule`.
- Dans les deux cas : **l'idempotence**. Rejouer la migration ou le script deux fois ne
  doit pas créer deux jobs. (J'annonçais que `cron.schedule` échoue sur un nom existant :
  c'est faux depuis pg_cron 1.4, il met à jour. Le vrai piège est ailleurs — voir plus bas.)
- Vérifier depuis la base : `select * from cron.job;` doit correspondre exactement à ce
  que décrit le repo.

**Réussi quand** — Un projet Supabase neuf reçoit le schéma **et** sa planification par
la seule exécution de ce qui est versionné. Aucune étape manuelle au tableau de bord.

**🟡 Fait en local le 2026-10-30, pas appliqué en production.**

Livré : `supabase/migrations/0013_digest_schedule.sql` déclare le job, qui lit son
secret *et* son URL de base dans Vault au moment de l'appel — sa commande ne contient
donc ni l'un ni l'autre et devient committable. `supabase/seed.sql` (jamais appliqué à
un projet déployé) pose les deux valeurs pour le local et y désactive le job.

Vérifié par rejeu à froid, 14 migrations sur base vide :

| Contrôle | Résultat |
| --- | --- |
| jobs après rejeu | 1, `0 * * * *` |
| secret dans `cron.job.command` | aucun |
| migration rejouée 3× | 1 job, même `jobid` |
| commande stockée exécutée telle quelle | **HTTP 200** |
| `project_url` manquante | violation NOT NULL, erreur tracée |

1. **`cron.schedule` est un upsert**, pas une erreur — depuis pg_cron 1.4, vérifié en
   1.6.4. Ce que j'annonçais dans ce fichier était faux. Le vrai piège d'idempotence est
   ailleurs : **dans le seed**. Une migration qui génère un secret « s'il est absent »
   casse en silence un projet existant, où il *est* absent de Vault — le job se mettrait
   à envoyer une valeur que la fonction déployée ignore. D'où un choix explicite :
   `0013` ne seed rien du tout.
2. **`supabase db reset` sort en code 0 alors que le seed a échoué.** Mon premier seed
   faisait un `update cron.job`, refusé (`42501`, la table n'est pas modifiable par ce
   rôle — il faut `cron.alter_job`). Le message apparaît dans la sortie, mais le code de
   retour dit « tout va bien ». Un script de CI qui se fie au code de sortie publierait
   un environnement à moitié configuré.
3. **Le rejeu préserve `active`.** Pratique en local, mais la contrepartie compte : un
   job que quelqu'un a désactivé en production ne sera pas réactivé par un redéploiement.
   L'IaC décrit ici la planification, pas son activation.
4. **L'échec est bruyant d'un côté seulement.** Sans `project_url`, `net.http_post` viole
   une contrainte NOT NULL et l'erreur est tracée dans `cron.job_run_details`. Sans le
   secret seul, en revanche, la requête part avec un en-tête nul et reçoit un 401 : visible
   dans `net._http_response`, mais le job est compté comme réussi. L'asymétrie est dans
   pg_net, pas dans notre code.
5. **Ce que ce palier ne règle pas** : le secret vit toujours dans *deux* systèmes — Vault
   et la variable d'env de la fonction. La rotation garde donc sa fenêtre. Ce qui a changé,
   c'est qu'elle ne demande plus d'écrire la valeur dans du SQL : `vault.update_secret`
   d'un côté, `supabase secrets set --env-file` de l'autre, deux gestes automatisables
   sans lire la valeur. Supprimer la fenêtre pour de bon suppose une source unique — soit
   la fonction lit le secret en base, soit on abandonne le secret partagé pour la
   vérification du JWT par la plateforme. À décider, pas à faire ici.

**Pour l'appliquer en production**, il faudra d'abord poser dans Vault le secret que la
fonction détient *déjà*, sinon le job part avec un en-tête nul dès la migration passée.
C'est une transition *expand/contract*, comme `0011` l'a fait pour les helpers RLS.

**Concept** — *Infrastructure as code* et idempotence. Tout état de production créé à la
main est une dette invisible, découverte au pire moment. Et le fait que ce soit un secret
qui ait poussé l'auteur à sortir du code : c'est la tension centrale de l'IaC, et Vault
(ou SOPS, ou Sealed Secrets) est la réponse générique.

---

## Palier 3 — Un deuxième environnement

**État actuel** — Un seul projet Supabase (`ruagmrftlzfrispfmvsp`, nommé en clair dans
le README). Toute migration va directement en production, sur tes vraies données.
Il n'existe aucun endroit où se tromper.

**À faire**
- Créer un second projet Supabase, `watchline-staging`. Y appliquer les 9 migrations
  depuis zéro — ça valide le palier 0 pour de vrai.
- Alternative à évaluer : les **branches Supabase** (branche éphémère par PR, liée au
  dépôt GitHub). Compare le coût et le cycle de vie des deux approches avant de choisir.
- Côté app, les variables `EXPO_PUBLIC_*` sont figées *au build* (le README l'écrit
  déjà). Un profil `preview` dans `eas.json` doit donc pointer sur staging, et
  `production` sur la prod — via les **EAS environment variables**
  (`development` / `preview` / `production`), pas via un `.env` local.
- Écrire la procédure de promotion : ce qui doit être vrai sur staging avant qu'une
  migration touche la prod.

**Réussi quand** — Tu peux casser staging sans conséquence, et une migration atteint la
prod seulement après y être passée.

**Concept** — *Environment promotion*. Un artefact (ou une migration) progresse par
paliers identiques ; il n'est jamais rebâti différemment pour la prod. Corollaire sur
mobile : la config est injectée au build, donc « le même artefact partout » n'est pas
tenable tel quel — tu découvres pourquoi le mobile complique la livraison continue.

---

## Palier 4 — Le pipeline déploie

**État actuel** — `.github/workflows/ci.yml` fait `tsc --noEmit` et `jest --ci`. Rien
d'autre. Pas de lint. Aucune migration appliquée, aucune fonction déployée, aucun build
déclenché. Tout le déploiement est manuel.

**À faire**
- Étendre la CI : un job `deploy-staging` sur `master` qui enchaîne
  `supabase db push` puis `supabase functions deploy daily-digest`, avec
  `SUPABASE_ACCESS_TOKEN` en secret GitHub et le project ref de **staging**.
- Faire tourner les migrations contre une base éphémère dans la CI (`supabase db reset`),
  pour que toute PR prouve que le schéma se reconstruit à froid.
- Mettre une **barrière humaine** avant la prod : un GitHub Environment avec required
  reviewers. Observer la différence entre déploiement continu et livraison continue.
- Réfléchir à l'ordre : migration avant ou après le déploiement du code ? Les deux
  cassent, mais pas de la même façon. Écris la règle que tu retiens
  (indice : migrations rétro-compatibles, expand/contract).

**Réussi quand** — Un merge sur `master` met staging à jour tout seul, et la prod attend
une approbation explicite.

**Concept** — *Pipeline de livraison* et compatibilité de schéma. Le point dur n'est pas
d'automatiser les commandes, c'est l'ordonnancement : pendant un déploiement, ancien code
et nouveau schéma coexistent. Le motif *expand/contract* est la réponse, et il est
universel — Postgres, MySQL, ou un champ protobuf.

---

## Palier 5 — Builds et soumission déclaratifs

**État actuel** — `eas.json` définit 4 profils propres (dev, dev-simulator, preview,
production, avec `autoIncrement` et l'auto-submit vers TestFlight). Mais chaque build
est lancé à la main, depuis ta machine. Il n'y a pas de `.eas/workflows/`.

**À faire**
- Créer `.eas/workflows/production.yml` (`eas workflow:create --template build` pour
  partir d'un squelette). La structure réelle :

```yaml
name: Production release

on:
  push:
    branches: ['master']

jobs:
  build_ios:
    type: build
    params:
      platform: ios
      profile: production
  submit:
    type: submit
    needs: [build_ios]
    params:
      build_id: ${{ needs.build_ios.outputs.build_id }}
      profile: production
```

- Noter ce que `needs` + `outputs` apportent : un identifiant d'artefact passe d'un job
  à l'autre. C'est la même mécanique que n'importe quel orchestrateur de pipeline.
- Lancer sans attendre un push : `eas workflow:run .eas/workflows/production.yml`.
- Explorer `type: fingerprint` : il détecte si la couche native a changé, donc s'il faut
  un vrai build ou si une mise à jour OTA suffit. C'est de la *détection de changement*
  pour éviter du travail inutile — le même raisonnement qu'un cache de build.
- À savoir : les workflows planifiés (`on: schedule`) sont réservés aux offres payantes.

**Réussi quand** — Une release part sans que tu tapes une commande de build, et tu sais
dire quel job a produit quel artefact.

**Concept** — *Pipelines déclaratifs, graphe de dépendances, artefacts*. `needs`,
`outputs`, `if`, la concurrence : c'est le même modèle mental que GitHub Actions, GitLab
CI, Argo ou Temporal. Ce que tu apprends ici se relit ailleurs.

---

## Palier 6 — Déploiement progressif et retour arrière

**État actuel** — `expo-updates` n'est pas installé. Il n'existe donc **aucun** moyen de
corriger quoi que ce soit sans repasser par la revue App Store (24-48 h). Et aucun moyen
d'annuler une release : la seule issue est d'en publier une autre.

C'est le trou le plus grave du projet d'un point de vue exploitation.

**À faire**
- Installer `expo-updates`, configurer les canaux (channels) alignés sur les profils
  `eas.json`.
- Publier une mise à jour OTA avec un `type: update` dans un workflow, sur un canal de
  test d'abord.
- Le cœur de l'exercice : `rollout_percentage`. Livrer à 10 %, observer, puis étendre —
  ou revenir en arrière. C'est du déploiement canari, et c'est ce que le mobile offre de
  plus proche d'un blue/green.
- Comprendre `runtimeVersion` : une mise à jour OTA ne peut pas franchir un changement
  de code natif. Trouver la limite expérimentalement, c'est comprendre ce qu'un artefact
  encapsule vraiment.
- Écrire la procédure de rollback et la **chronométrer**. Combien de minutes entre « on
  voit le bug » et « les utilisateurs ont le correctif » ?

**Réussi quand** — Tu peux annuler une mauvaise release en minutes, et tu connais
précisément la frontière entre ce qui est corrigeable à chaud et ce qui exige un build.

**Concept** — *Progressive delivery* et MTTR. Déployer, c'est facile ; revenir en arrière
vite, c'est le vrai métier. Canari, rollout par pourcentage, kill switch : la question
n'est jamais « est-ce que ça va casser » mais « en combien de temps je reviens ».

---

## Palier 7 — Savoir que ça tourne

**État actuel** — Le digest part à 08:00 UTC. S'il échoue — TMDB en panne, token expiré,
erreur Postgres — personne ne le sait. La fonction renvoie du JSON mais ne journalise
rien de structuré, et rien ne surveille le job cron. Une semaine sans notification
passerait inaperçue.

**À faire**
- Journalisation structurée dans `daily-digest` : une ligne JSON par exécution
  (utilisateurs traités, pushs envoyés, échecs, durée). Les requêter dans les logs
  Supabase.
- Une table `digest_runs` écrite à chaque exécution : c'est ta trace d'audit, et la base
  de l'alerte suivante.
- Un **dead man's switch** : si aucune exécution réussie depuis 26 h, être prévenu.
  Noter la différence avec une alerte sur erreur — ici c'est l'*absence* d'événement qui
  est le signal, et c'est toujours le cas le plus difficile.
- Jouer les scénarios d'échec : révoquer le token TMDB, mettre un mauvais `CRON_SECRET`.
  Est-ce que ton dispositif les détecte ? Combien de temps après ?
- Lire les advisors de sécurité et de performance du projet Supabase, et traiter ce qui
  remonte.

**Réussi quand** — Tu es prévenu d'un digest manquant avant de t'en apercevoir par
l'absence de notification sur ton téléphone.

**Concept** — *Observabilité* : logs, métriques, alertes sur absence de signal. On ne
peut pas exploiter ce qu'on ne voit pas, et les pannes silencieuses des tâches
planifiées sont la catégorie de bug la plus durablement coûteuse.

---

## Palier 8 (optionnel) — Franchir la limite du PaaS

Les paliers 0-7 t'apprennent le déploiement réel, mais **toujours derrière Supabase et
EAS**, qui te cachent les conteneurs, le réseau et les serveurs. Pour toucher la couche
en dessous, deux ponts possibles depuis ce projet :

- **Terraform + le provider Supabase** : décrire le projet, ses branches et sa config en
  HCL. Tu découvres le `plan`/`apply`, la gestion d'état (state), la dérive — le vrai
  vocabulaire de l'IaC, sur une infrastructure que tu connais déjà.
- **Réimplanter `daily-digest` en service conteneurisé** : la même logique en Node ou Go,
  un Dockerfile, un déploiement sur Fly.io / Cloud Run / un VPS, un cron externe. Tu
  obtiens ce que l'Edge Function masquait : image, healthcheck, variables d'env au
  runtime, logs, limites CPU/mémoire.

---

## Ce que ce parcours ne t'apprendra pas

Kubernetes, le load balancing, le service mesh, la montée en charge, les bases de données
répliquées. Watchline est une app perso à un utilisateur : les problèmes d'échelle n'y
existent pas et ne peuvent pas être simulés honnêtement. Pour ça il faut un autre terrain.

En revanche, migrations, secrets, environnements, pipelines, rollback et observabilité
sont *les mêmes problèmes* à toutes les échelles. C'est 80 % du métier, et ce repo les
contient tous pour de vrai.

---

## Ordre recommandé

0 → 1 → 2 sont fondamentaux et rapides (quelques heures chacun) : ils rendent le projet
reproductible et sûr. 3 → 4 forment le vrai pipeline et demandent le plus de travail.
5 → 6 sont spécifiques au mobile mais 6 est le plus formateur du lot. 7 se fait en
parallèle de n'importe quel autre. 8 quand tu veux sortir du confort du PaaS.

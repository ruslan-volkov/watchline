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
- `supabase db reset` : vérifier que les 9 migrations rejouent _dans l'ordre, à vide,
  sans erreur_. C'est loin d'être garanti — une migration écrite contre une base
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

**Concept** — _Dev/prod parity_ et reproductibilité. Un déploiement n'est fiable que si
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
  est absent (_fail fast_, pas à la première requête).
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

| Requête         | Avant   | Après |
| --------------- | ------- | ----- |
| sans en-tête    | 401     | 500   |
| mauvais secret  | 401     | 500   |
| bon secret      | 200     | 500   |
| secret du dépôt | **200** | 500   |

La colonne « après » est prise avec `CRON_SECRET` retiré de l'environnement : plus
aucune requête ne passe, et le log dit pourquoi en une ligne. C'est la ligne
`secret du dépôt → 200` qui était le vrai défaut.

1. **« Fail fast » ne veut pas dire « le déploiement échoue ».** Le `throw` est au
   chargement du module, mais l'edge runtime instancie le worker _à la première
   requête_ : le déploiement réussit, et on ne découvre la panne qu'au déclenchement
   du cron. Fail-closed, oui ; fail-early, non. Une configuration manquante reste donc
   invisible jusqu'à 08:00 UTC — c'est l'argument d'un _dead man's switch_ au palier 7.
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

| t (UTC)     | Événement                                                                    |
| ----------- | ---------------------------------------------------------------------------- |
| 19:02       | relevé de l'état réel du projet cloud                                        |
| 19:05:41    | `supabase secrets set CRON_SECRET` → nouveau secret sur la fonction          |
| 19:05–19:07 | **fenêtre ouverte** : la fonction attend le nouveau, le cron envoie l'ancien |
| 19:07:30    | retour arrière, ancien secret remis                                          |
| 19:08       | sonde : HTTP 200, service rétabli                                            |

**Fenêtre : 109 s.** Le cron (prochain tir 20:00) n'a jamais été déclenché dedans :
zéro digest manqué. Mais ce chiffre ne mesure pas la plateforme — il mesure mon temps
de réaction entre deux commandes. La propagation réelle de `secrets set` vers le worker
n'a pas pu être chronométrée, la sonde répétée vers la production ayant été refusée.

5. **Le secret de production _était_ le littéral du dépôt.** Les deux sha256 coïncident.
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
   à jour _depuis un fichier_, sans que personne ne lise la valeur ; le SQL du job cron,
   lui, exige d'écrire le secret en clair dans la commande. C'est ce qui a arrêté la
   rotation — pas un obstacle technique, une conséquence du choix de conception. Tant que
   le secret est porté en dur par le cron, la rotation ne peut pas être automatisée du
   tout, et ne peut être faite que par quelqu'un qui a le droit de voir la valeur.

**Le vrai correctif** n'est donc pas « rotationner plus vite ». C'est que le cron lise le
secret au moment de l'appel — `vault.decrypted_secrets` dans le `jsonb_build_object` —
pour que sa commande n'en contienne aucun. Une rotation redevient alors une écriture dans
un seul système, sans fenêtre et automatisable. À faire au palier 2, dont c'est le sujet.

Reste à faire : la rotation elle-même, une fois le cron découplé du secret.

**Concept** — _Fail closed, fail fast_ et rotation de secrets. Une config absente doit
provoquer une panne bruyante au démarrage, jamais une dégradation silencieuse de la
sécurité. Vrai partout : variables d'env, feature flags, certificats.

---

## Palier 2 — Mettre l'infrastructure sous contrôle de version

**État actuel** — `supabase/migrations/0004_push_tokens.sql:26-35` : la planification
`pg_cron` du digest est un **bloc SQL commenté**, avec la note « Applied out-of-band ».
Le job qui tourne en production n'existe dans aucun fichier. Si le projet Supabase est
perdu, cette planification est perdue — et personne ne peut savoir, en lisant le repo,
à quelle heure le digest part ni vers quelle URL.

C'est le cas d'école de la _dérive de configuration_ (configuration drift) : l'état réel
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

Livré : `supabase/migrations/0018_digest_schedule.sql` déclare le job, qui lit son
secret _et_ son URL de base dans Vault au moment de l'appel — sa commande ne contient
donc ni l'un ni l'autre et devient committable. `supabase/seed.sql` (jamais appliqué à
un projet déployé) pose les deux valeurs pour le local et y désactive le job.

Vérifié par rejeu à froid, 14 migrations sur base vide :

| Contrôle                               | Résultat                          |
| -------------------------------------- | --------------------------------- |
| jobs après rejeu                       | 1, `0 * * * *`                    |
| secret dans `cron.job.command`         | aucun                             |
| migration rejouée 3×                   | 1 job, même `jobid`               |
| commande stockée exécutée telle quelle | **HTTP 200**                      |
| `project_url` manquante                | violation NOT NULL, erreur tracée |

1. **`cron.schedule` est un upsert**, pas une erreur — depuis pg_cron 1.4, vérifié en
   1.6.4. Ce que j'annonçais dans ce fichier était faux. Le vrai piège d'idempotence est
   ailleurs : **dans le seed**. Une migration qui génère un secret « s'il est absent »
   casse en silence un projet existant, où il _est_ absent de Vault — le job se mettrait
   à envoyer une valeur que la fonction déployée ignore. D'où un choix explicite :
   `0015` ne seed rien du tout.
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
5. **Ce que ce palier ne règle pas** : le secret vit toujours dans _deux_ systèmes — Vault
   et la variable d'env de la fonction. La rotation garde donc sa fenêtre. Ce qui a changé,
   c'est qu'elle ne demande plus d'écrire la valeur dans du SQL : `vault.update_secret`
   d'un côté, `supabase secrets set --env-file` de l'autre, deux gestes automatisables
   sans lire la valeur. Supprimer la fenêtre pour de bon suppose une source unique — soit
   la fonction lit le secret en base, soit on abandonne le secret partagé pour la
   vérification du JWT par la plateforme. À décider, pas à faire ici.

**Pour l'appliquer en production**, il faudra d'abord poser dans Vault le secret que la
fonction détient _déjà_, sinon le job part avec un en-tête nul dès la migration passée.
C'est une transition _expand/contract_, comme `0011` l'a fait pour les helpers RLS.

**Concept** — _Infrastructure as code_ et idempotence. Tout état de production créé à la
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
- Côté app, les variables `EXPO_PUBLIC_*` sont figées _au build_ (le README l'écrit
  déjà). Un profil `preview` dans `eas.json` doit donc pointer sur staging, et
  `production` sur la prod — via les **EAS environment variables**
  (`development` / `preview` / `production`), pas via un `.env` local.
- Écrire la procédure de promotion : ce qui doit être vrai sur staging avant qu'une
  migration touche la prod.

**Réussi quand** — Tu peux casser staging sans conséquence, et une migration atteint la
prod seulement après y être passée.

**🟡 Staging créé et câblé à l'environnement EAS `preview` (2026-10-30/31). Un pas
manuel reste à faire.**

**L'arbitrage se règle sur les chiffres, pas sur les goûts.** Organisation `RuslanCorp`,
plan **free** :

|                             | Second projet | Branches Supabase                             |
| --------------------------- | ------------- | --------------------------------------------- |
| Coût                        | **0 $/mois**  | 0,01344 $/h, soit ≈ 9,80 $/mois en permanence |
| Disponible sur le plan free | oui           | **non — branching = plan Pro**                |
| Cycle de vie                | permanent     | éphémère, une par PR                          |

La comparaison s'effondre d'elle-même : les branches exigent le plan Pro (25 $/mois plus
le compute). Ce n'est donc pas « moins cher contre plus pratique », c'est « disponible
contre indisponible ». Le quota free autorise **deux projets actifs** — il y en a un actif
et cinq en pause, et les projets en pause ne comptent pas.

**Mais le plan free a un piège qui change la nature de staging** : un projet free est mis
en pause après **7 jours** d'activité faible. Un staging qu'on utilise de temps en temps
sera donc endormi la plupart du temps, et un projet en pause ne reçoit pas de migration.
Le coût de cette option n'est pas financier, il est opérationnel — et la procédure de
promotion doit commencer par le réveil.

**Côté app, j'ai rendu explicite ce qui était déduit.** `eas.json` associe maintenant
chaque profil à son environnement EAS (`environment`). La déduction automatique d'EAS
donnait déjà le même résultat — `production` quand `distribution` vaut `store`,
`development` quand `developmentClient` est vrai, `preview` sinon — donc ce changement ne
modifie aucun comportement. C'est précisément l'intérêt : la correspondance profil →
environnement était une règle invisible, elle est maintenant écrite.

Deux réserves honnêtes :

- **La précédence entre le bloc `env` d'un profil et les variables de l'environnement EAS
  n'est documentée nulle part.** Nos profils de dev posent `APP_VARIANT` en `env` ; tant
  qu'aucune clé n'existe des deux côtés, la question ne se pose pas. Ne pas en créer.
- **Réserve levée le 2026-10-31** : `eas-cli` est installé et les trois environnements
  sont inspectés. Voir « Ce que les environnements EAS contenaient » ci-dessous.

### Ce que la création de staging a révélé

`watchline-staging` (`lmagsjyusqjxpngpqqcn`, eu-west-3, 0 $/mois) porte les 13 migrations,
le job `pg_cron` de `0015`, ses deux valeurs Vault et les trois Edge Functions. Cinq choses
sont apparues, dont deux qui invalident ce que ce dépôt affirmait.

**1. `supabase db push` ne peut pas être le chemin de déploiement de ce projet.**
L'historique de la prod porte des versions horodatées et des noms qui ne sont pas ceux des
fichiers (`initial_schema`, `push_tokens_and_cron`, mais aussi `0008_profiles_timezone`) :
tout a été appliqué par le tableau de bord ou l'API, jamais par `db push`. La CLI
comparerait les versions du dossier (`0001`…`0016`) à celles de la base, n'en trouverait
aucune, et rejouerait tout — `create type media_type` échouerait immédiatement. La
procédure ci-dessous est corrigée en conséquence. Remettre `db push` en service demanderait
un `supabase migration repair` sur chacun des deux projets : c'est une décision du palier 4,
pas un détail. En attendant, staging a reçu ses 13 migrations par l'API de management, donc
avec la même convention horodatée que la prod — au moins les deux projets se ressemblent.

**2. Le commentaire de `0010_api_grants.sql` se trompe sur la cause.** Il affirme que
Supabase n'accorde plus le DML sur les nouveaux objets de `public` et que « le projet cloud
est antérieur au changement ». Mesuré sur un projet créé le jour même :

| défaut `postgres` dans `public` | local (CLI 2.109) | cloud (staging neuf **et** prod) |
| ------------------------------- | ----------------- | -------------------------------- |
| `anon`                          | `Dxtm`            | `arwdDxtm`                       |
| `authenticated`                 | `Dxtm`            | `arwdDxtm`                       |

La divergence n'est pas _ancien projet vs nouveau_, c'est **l'image locale de la CLI vs la
plateforme cloud**. `0010` reste nécessaire — sans lui, le rejeu à froid en local échoue en
42501 — mais il décrit mal pourquoi. Sans second projet, impossible de le savoir : un seul
environnement cloud ne permet pas de distinguer « ancien » de « cloud ».

**3. Corollaire : `0010` n'accorde que, il ne révoque jamais.** Sur le cloud `anon` a déjà
tous les privilèges ; l'appliquer en prod ne lui retirerait donc rien, alors que le fichier
affirme « `anon` gets nothing, on purpose ». Les lignes restent protégées (toutes les
policies passent par `auth.uid()`, nul pour `anon` ; `media` est même `to authenticated`),
et `TRUNCATE` — le seul privilège qui ignore RLS — n'est pas exposé par PostgREST. Donc pas
de porte ouverte, mais un écart entre ce que le fichier décrit et ce qui est en place. Le
corriger demande un `0016` qui révoque explicitement, et non une retouche de `0010` qui est
déjà appliqué : c'est précisément le genre de changement qu'on veut voir passer par staging
d'abord.

**4. `verify_jwt = false` voyage bien avec le dépôt.** Après déploiement, staging rend
`verify_jwt: false` pour `daily-digest` et `true` pour les deux autres, conformément à
`config.toml`. Ce réglage est donc réellement du code, et pas un interrupteur oublié dans le
tableau de bord de la prod — autre chose qu'on ne pouvait pas savoir avec un seul projet.

**5. Deux environnements veulent deux fichiers de secrets, et `.gitignore` ne suivait pas.**
Il ignorait `.env` et `.env*.local` — mais pas `.env.staging`. Dans un dépôt dont
l'historique contient déjà un secret en clair, le piège était trop beau : la règle est
devenue `.env*` avec `!.env.example`.

**Ce qui a été vérifié sur staging, pas en local**

- 13 migrations rejouées à froid sans erreur. `supabase_vault` est présent par défaut sur un
  projet neuf ; `pg_cron` et `pg_net` ne le sont pas et sont bien créés par `0004`.
- Le job existe, actif, `0 * * * *`, et **sa commande ne contient aucun secret**.
- La commande stockée, exécutée à la main : la requête part de la base, atteint la fonction
  et revient. Les deux lectures Vault se résolvent donc réellement — une valeur manquante
  aurait échoué sur le `url` NOT NULL de `pg_net`.
- Sans `CRON_SECRET`, la fonction rend `500 WORKER_ERROR` sur toute requête, en-tête inclus.
  Le fail-closed du palier 1 n'était pas un artefact de la machine de dev.

**Parité imparfaite, à savoir** — staging tourne sur Postgres 17.11.0.011, la prod sur
17.6.1.141. Staging est donc _en avance_, ce qui est le mauvais sens : un comportement qui
passe sur staging peut manquer en prod. On ne choisit pas la version d'un projet Supabase.

**Le pas manuel qui reste, et pourquoi il est manuel.** Le secret doit exister dans deux
systèmes : Vault (que lit le job) et l'environnement de la fonction. Vault le détient déjà,
généré par Postgres via `gen_random_bytes` — sa valeur n'est donc jamais passée par un outil
ni par une conversation. Pour le poser côté fonction, il faut le **lire**, et aucun chemin ne
le permet sans l'exposer : la CLI garde son jeton dans le keychain, et le mot de passe de la
base de staging est généré à la création puis jamais affiché. C'est le constat du palier 1,
reproduit sur un environnement neuf : _installer un secret partagé dans deux systèmes exige
que quelqu'un le lise_. Dans l'éditeur SQL de staging :

```sql
select decrypted_secret from vault.decrypted_secrets where name = 'digest_cron_secret';
```

puis écrire `supabase/functions/.env.staging` (désormais ignoré par git) avec ce
`CRON_SECRET` et le `TMDB_ACCESS_TOKEN`, et :

```bash
supabase secrets set --env-file supabase/functions/.env.staging --project-ref lmagsjyusqjxpngpqqcn
```

**La vraie correction est ailleurs, et elle clôt le palier 1.** Tant que le secret vit dans
deux systèmes, la rotation reste un geste à deux mains. Si la fonction lisait son secret
depuis Vault — elle a déjà `service_role`, mais `vault.decrypted_secrets` ne lui est pas
lisible, il faudrait donc une fonction `security definer` dans `private` — la base
deviendrait la source unique : la rotation tiendrait en un `vault.update_secret`, sans second
système et sans franchissement. C'est une décision de conception, pas une correction de bug,
donc je ne l'ai pas prise seul.

### Ce que les environnements EAS contenaient

`eas-cli` 27.2.0, installé en global : c'est ce que donne la doc, et `eas.json` déclarait
déjà `cli.version: ">= 12.0.0"`, donc la version est contrainte depuis le dépôt sans
dépendance supplémentaire. La session Expo était déjà ouverte (`exelion`) et le projet déjà
lié par `extra.eas.projectId`.

**`production` était correctement câblé. `preview` et `development` étaient vides.**

Un build `preview` partait donc sans aucune variable Supabase. Pas en silence :
`src/lib/supabase.ts` lève au chargement si l'URL ou la clé manquent, donc l'app plante au
lancement avec un message explicite — même discipline fail-closed que le digest du palier 1.
Mais « ça plante tout de suite » n'est une bonne nouvelle que parce que personne n'avait
encore essayé.

`preview` pointe maintenant sur staging. Le câblage s'est fait par `eas env:pull` depuis
`production`, puis `eas env:push` vers `preview`, en ne changeant que l'URL et la clé
publiable : le jeton TMDB n'a ainsi jamais transité par une ligne de commande. `production`
a été relu après coup, inchangé.

`development` reste vide, volontairement : ces profils ont `developmentClient: true`, donc
le JS vient de Metro au lancement, et c'est Metro — en local — qui inline les
`EXPO_PUBLIC_*` depuis `.env` / `.env.local`. L'environnement EAS ne sert qu'au binaire.

**Piège trouvé, propre à ce dépôt** : `eas env:pull` écrit par défaut dans **`.env.local`**,
le fichier que `scripts/use-local-backend.sh` utilise pour pointer l'app sur la stack locale.
Un `eas env:pull` sans `--path` l'écrase et redirige silencieusement le dev local vers la
prod. Toujours passer `--path`.

**Finding de sécurité — et le réflexe habituel ne le corrige pas.**
`EXPO_PUBLIC_TMDB_ACCESS_TOKEN` est un jeton porteur TMDB, enregistré en visibilité
`PUBLIC`. Le préfixe `EXPO_PUBLIC_` veut dire qu'il est **inliné dans le bundle JS** : il est
donc extractible de n'importe quel build livré, et la doc Expo le dit sans détour — « Do not
put secrets in `EXPO_PUBLIC_` variables. Everything in client bundles is readable by end
users. » Le passer en `sensitive` **ne changerait rien** : la visibilité protège les logs EAS
et le tableau de bord, pas le bundle. En `secret`, le build casserait, un secret n'étant pas
disponible à l'inlining.

La seule correction réelle est de sortir TMDB du client : un Edge Function proxy, le jeton
restant côté serveur. C'est un changement d'architecture — `src/media/tmdb.ts` appelle TMDB
en direct — pas une case à cocher, donc noté ici et pas décidé seul. Entre-temps le jeton est
en lecture seule et révocable depuis le compte TMDB.

### Procédure de promotion (corrigée après création de staging)

1. **Réveiller staging** depuis le tableau de bord (projet free, probablement en pause).
2. Appliquer les migrations manquantes **par l'API de management ou le tableau de bord**,
   dans l'ordre des fichiers. Pas `supabase db push` : voir le point 1 ci-dessus.
3. **Vérifier sur staging, pas en local** : `cron.job` correspond à `0015`, les droits de
   `0010` sont là, et les valeurs Vault sont posées.
4. Build **`preview`** (qui pointe sur staging) et parcours complet sur appareil.
5. **Seulement alors**, appliquer les mêmes migrations à la prod, puis build `production`.

La règle tient en une phrase : _une migration n'atteint la prod qu'après être passée par
staging_. Et pour `0015`, chaque passage demande en plus de poser dans Vault le secret
que la fonction de cet environnement détient déjà — sans quoi le digest part avec un
en-tête nul. C'est la transition expand/contract du palier 2, à faire deux fois.

### Premier passage réel : `0016`

La procédure ci-dessus n'avait jamais été parcourue. `0016_revoke_anon_api_grants.sql` est
le premier changement à l'emprunter, et il a été choisi pour ça : petit, issu d'un finding
de ce palier, et limité à des privilèges.

**Le test d'abord — et il existait déjà, en se trompant.**
`supabase/tests/database/rls.test.sql` affirmait depuis le début : « anonymous callers
cannot read profiles at all (0010 grants anon nothing) ». Cette assertion passait en local
et aurait échoué sur le cloud, et la CI ne la joue que contre la stack locale : elle ne
pouvait donc structurellement pas voir l'écart. **Un test vert qui ne tourne qu'à l'endroit
où son hypothèse est vraie ne prouve rien.** J'ai ajouté une assertion portant sur les
privilèges eux-mêmes plutôt que sur un de leurs symptômes. Elle échouait en local aussi
(il restait `REFERENCES/TRIGGER/TRUNCATE`), et quand elle casse elle nomme ce qui reste.

**Ce que la mesure sur staging a montré, et que le raisonnement avait manqué.** Avant
`0016`, avec la clé publiable et aucune session :

| table                                           | avant `0016` | pourquoi                                                                                                                                                                             |
| ----------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profiles`, `watch_entries`, `episode_progress` | 401 `42501`  | `permission denied for function has_friend_link` — c'est la **policy** qui échoue, `0011` n'ayant accordé `EXECUTE` sur les helpers `private` qu'à `authenticated` et `service_role` |
| `friendships`, `media`, `push_tokens`           | **200 `[]`** | atteignables : aucune policy ne s'applique à `anon`, donc une réponse vide bien formée                                                                                               |
| `INSERT` sur `media`                            | 401 `42501`  | `new row violates row-level security policy`                                                                                                                                         |

Aucune donnée exposée, donc — mais trois tables atteignables, et la protection des trois
autres venant d'un `EXECUTE` accordé par une migration qui n'avait rien à voir avec les
privilèges d'API. Une coïncidence, pas une intention, et je ne l'aurais pas su sans mesurer.

Après `0016`, les six répondent uniformément `401 / 42501 permission denied for table <x>` :
l'échec se produit à la couche des privilèges, et plus par ricochet. `authenticated` et
`service_role` sont inchangés, relus après coup.

**Ce qui n'a pas été vérifié, et il faut le dire.** Le parcours authentifié sur staging :
il n'y a pas de compte de test et en créer un demanderait la clé `service_role`. La preuve
que les chemins `authenticated` fonctionnent toujours vient de la suite pgTAP locale
(20/20), pas de staging. Et je n'ai pas lancé `supabase db reset` : une autre session
travaillait sur la stack partagée. Le rejeu à froid est donc couvert par la CI, qui démarre
un stack neuf — pas par moi.

**Appliqué en production le 2026-10-31**, `0010` puis `0016`, dans cet ordre.

Pré-vol d'abord, et il n'était pas décoratif : vérifier qu'aucune Edge Function ne lit ces
tables avec la clé anon. `daily-digest` et `nas-download-complete` utilisent `service_role`.
Les deux `notify-friend-*` créent bien un client avec la clé anon — mais uniquement pour
`auth.getUser()`, en transmettant le JWT de l'appelant, donc GoTrue et pas PostgREST :
aucun privilège de table en jeu. Sans cette lecture, le revoke était un pari.

Mesuré sur la prod, requêtes anonymes avec la clé publiable :

| tables                                                      | avant                        | après                                   |
| ----------------------------------------------------------- | ---------------------------- | --------------------------------------- |
| `friendships`, `media`, `push_tokens`, `nas_webhook_tokens` | **200 `[]`**                 | 401 `42501`                             |
| `profiles`, `watch_entries`, `episode_progress`             | 401, via le helper `private` | 401 `42501 permission denied for table` |

Contrôles après coup : `authenticated` garde `SELECT` sur `profiles`, `UPDATE` sur
`watch_entries` et `EXECUTE` sur les deux helpers `private` ; `service_role` garde `SELECT`
sur `push_tokens`, `watch_entries` et `nas_webhook_tokens` ; `anon` n'a plus `SELECT` nulle
part. GoTrue répond toujours.

**Ce que ça ne prouve pas** : aucun parcours authentifié n'a été joué sur la prod. La preuve
comportementale vient de pgTAP en local, où les mêmes droits donnent 25 assertions vertes
sur 26 — la seule rouge étant celle de `master`, pour une raison sans rapport. Les contrôles
ci-dessus portent sur les privilèges, pas sur une session réelle.

Dernier détail qui en dit long : l'historique de la prod affiche maintenant `0010_api_grants`
**après** `0013_nas_webhook_tokens`, parce que les horodatages suivent l'ordre d'application
et non celui des fichiers. Le dossier et l'historique racontent deux histoires différentes —
le même problème que celui qui interdit `supabase db push`.

**Le merge avec `master` a révélé un troisième problème, dans la convention elle-même.**
Deux branches ont produit un `0013` chacune : `0013_digest_schedule` ici,
`0013_nas_webhook_tokens` sur master. Git a fusionné sans rien signaler — les noms de
fichiers diffèrent — mais `version` est la **clé primaire** de
`supabase_migrations.schema_migrations`, donc le second insert échoue et `supabase db reset`
casse. L'historique local portait en plus un `0014_recommendations` venu d'une troisième
session : mon `0014` allait donc collisionner une seconde fois. J'ai renuméroté les miens en
`0015` et `0016`, en laissant `0014` à cette session.

Le fond n'est pas réglé : **une numérotation séquentielle écrite à la main ne survit pas aux
branches parallèles.** `supabase migration new` génère justement des horodatages
(`20261031…`), qui ne peuvent pas collisionner. Basculer la convention toucherait des
fichiers de `master`, donc c'est une décision à prendre — pas un geste de résolution de
conflit.

Le merge a aussi apporté `nas_webhook_tokens`, qui accorde à `authenticated` et
`service_role` mais ne dit rien d'`anon` : la table arrive donc sur le cloud avec `anon` à
`arwdDxtm`, exactement le trou que `0016` venait de boucher ailleurs. Elle y est ajoutée.
Et la prod l'a déjà reçue — c'est aujourd'hui sa seule table dans ce cas.

### Remise à niveau de staging, et deux trous de plus

Staging était en retard d'une migration sur master. La remise à niveau — `0013_nas_webhook_tokens`
puis `0016` — a tenu en deux appels, mais elle a fait apparaître deux choses.

**1. Le trou des privilèges par défaut, démontré au lieu d'être supposé.** Dix secondes après
la création de `nas_webhook_tokens` sur staging, une requête anonyme a reçu **`200 []`**,
pendant que les six tables déjà révoquées restaient à 401. C'est exactement ce que `0016`
avait laissé de côté : sur le cloud, `ALTER DEFAULT PRIVILEGES` rouvre la porte pour chaque
nouvelle table, et une liste explicite ne rattrape pas un oubli. Ce n'est plus un risque
théorique, c'est mesuré. **Recommandation renforcée** : aligner le défaut du cloud sur celui
de la CLI vaut mieux qu'un revoke à répéter indéfiniment — mais ça gouverne des objets dont
aucune migration d'ici n'est propriétaire, donc ça reste à arbitrer.

**2. Un réglage qui n'existait que dans la plateforme — et une panne en attente.** En prod,
`nas-download-complete` tourne avec `verify_jwt: false`, ce qui est nécessaire : Radarr et
Sonarr n'ont pas de session Supabase, et le jeton dans l'adresse est le justificatif. Mais
`config.toml` ne la mentionnait pas, donc son défaut valait `true`. **Un simple
`supabase functions deploy` aurait donc remis la vérification en marche et cassé le webhook
en production, sans que personne ne touche à son code.** Le bloc est maintenant dans
`config.toml`, et le déploiement sur staging l'a confirmé en rendant `verify_jwt: false`.
Impossible à trouver avec un seul environnement : il fallait comparer ce que le dépôt produit
à ce que la plateforme porte déjà.

Les quatre fonctions de staging ont désormais les mêmes drapeaux que la prod.

**Et une dérive que j'ai créée moi-même.** L'historique de staging compte 16 lignes pour 15
fichiers : `0013_digest_schedule` et `0014_revoke_anon_api_grants` y restent sous les noms
d'avant la renumérotation. Le schéma est juste, l'historique ment un peu. Sans conséquence —
rien ne compare ces noms aux fichiers — mais c'est précisément ce qui rend un historique
inutilisable, et un argument de plus pour la convention horodatée.

### `0017` : fermer le défaut, et ce qu'il refuse de fermer

`0017_revoke_anon_default_privileges.sql` retire à `anon` les privilèges par défaut sur les
nouveaux objets de `public`, pour le rôle `postgres` — celui sous lequel les migrations
créent les objets.

**Le test d'abord, et il m'a piégé.** La première assertion portait sur `pg_default_acl`.
Elle n'a pas échoué : elle a **planté**. `defaclobjtype` est de type `"char"`, donc
`"char" || unknown` est ambigu, et l'erreur a interrompu le fichier — « You planned 27 tests
but ran 24 ». Comme mon `grep` ne montrait que les lignes `Failed test`, j'ai cru un instant
que l'assertion passait. **Un test qui plante n'est pas un test qui passe**, et un filtre
trop serré sur la sortie suffit à confondre les deux. Avec un cast explicite, elle a échoué
comme attendu : `r:MAINTAIN r:REFERENCES r:TRIGGER r:TRUNCATE S:UPDATE`.

**Et l'assertion de catalogue ne suffisait pas.** `pg_default_acl` n'enregistre que les
droits accordés _nommément_ à un rôle : il ne voit pas ce qu'`anon` détient via PUBLIC. J'ai
donc ajouté une assertion comportementale — le test crée une table dans sa propre transaction
et vérifie qu'`anon` n'y a rien, sans que personne n'ait révoqué. C'est celle-là qui prouve
que `0017` travaille.

**Les fonctions sont volontairement absentes, après avoir essayé.** `revoke all on functions
from anon` retire bien l'entrée `anon=X` de l'ACL par défaut, mais ne change **rien
d'observable** : une fonction neuve dans `public` arrive avec `proacl` à NULL, donc le défaut
interne de PostgreSQL — `EXECUTE` à **PUBLIC** — et `anon` est membre de PUBLIC. Mesuré en
local, puis à nouveau sur staging avec une fonction-sonde, où `has_function_privilege` sur
`public` confirmait la provenance du droit. Fermer ça demande de révoquer à PUBLIC, ce qui
porte plus loin qu'`anon` et ce qui, à l'essai, s'est comporté différemment des deux côtés.
J'ai donc **retiré la ligne du fichier** plutôt que de garder un commentaire qui promet plus
que la mesure. La convention qui marche reste celle de `0002` et `0003` : révoquer `EXECUTE`
fonction par fonction, explicitement.

**Mesuré sur staging**, avec une table, une séquence et une fonction créées puis supprimées :
table `(aucun)`, séquence `(aucun)`, fonction `EXECUTE` — via PUBLIC. Le trou des tables est
fermé pour de bon ; celui des fonctions est documenté et ouvert.

**Détail honnête** : staging a reçu la version à trois lignes avant que je retire la
troisième. Son ACL par défaut n'a donc plus l'entrée `anon=X` sur les fonctions, là où le
fichier ne la retirerait plus. Sans effet observable — PUBLIC couvre `anon` de toute façon —
et dans le sens le moins permissif, donc je l'ai laissé ainsi plutôt que de ré-accorder un
droit pour faire coïncider deux états.

**`0017` n'est pas appliqué en production.**

### Deuxième merge avec `master` : la collision revient, et quelqu'un d'autre trouve le même trou

La prédiction du premier merge s'est vérifiée : `master` porte bien un `0014_recommendations`,
mais il porte aussi un `0015_recommendations_revoke_default_grants`. Mon
`0015_digest_schedule` est donc entré en collision **une deuxième fois**, et comme la
première, git a fusionné sans un mot : les noms de fichiers diffèrent, seul le préfixe
numérique compte pour `schema_migrations`. Renuméroté en `0018`.

Deux fois en deux merges, ce n'est plus un accident, c'est la convention. **Une numérotation
séquentielle tenue à la main ne survit pas aux branches parallèles**, et le coût ne se paie
pas au merge — il se paie au `db reset` suivant, loin du geste qui l'a causé. La décision de
basculer sur les horodatages de `supabase migration new` reste à prendre, et le palier 4 en
dépend : on ne peut pas écrire un job qui applique les migrations tant que leur identité
n'est pas stable.

**Plus instructif : `master` a rencontré le même trou de privilèges, et l'a bouché
autrement.** Son `0015` révoque tout sur les deux tables de recommandations _avant_ de
réaccorder, avec ce constat en commentaire : « une migration qui crée une table doit révoquer
avant d'accorder » — et la remarque que les bases locales et de CI n'ont jamais eu ces
défauts, donc qu'aucun test ne peut attraper ça. Deux sessions, le même défaut du cloud, deux
réponses :

- **une règle à se rappeler** à chaque migration qui crée une table (`master`) ;
- **un défaut changé une fois pour toutes** (`0017` ici).

Les deux sont justes, et elles ne se marchent pas sur les pieds : après `0017`, le
`revoke … from anon` de `master` devient un no-op, et le reste de sa migration continue de
porter `authenticated` et `service_role`. Mais la comparaison tranche la question ouverte
plus haut : `0017` ne couvre qu'`anon`, donc la règle reste à se rappeler pour
`authenticated` — et c'est exactement l'oubli qu'un humain fait. L'étendre reste un
arbitrage plus large, parce que ça gouvernerait aussi les tables créées depuis le tableau de
bord.

**Dérive, mise à jour.** Le dépôt porte 18 migrations ; staging en a 16 (il lui manque les
deux de recommandations), la prod 14. Rien ne rattrape ça tout seul — c'est le palier 4, et
l'écart grandit à chaque merge pendant qu'on en parle.

**Concept** — _Environment promotion_. Un artefact (ou une migration) progresse par
paliers identiques ; il n'est jamais rebâti différemment pour la prod. Corollaire sur
mobile : la config est injectée au build, donc « le même artefact partout » n'est pas
tenable tel quel — tu découvres pourquoi le mobile complique la livraison continue.

---

## Palier 4 — Le pipeline déploie

**État actuel** — `.github/workflows/ci.yml` fait `biome ci`, un typecheck et `jest --ci`,
plus un job pgTAP sur une stack locale ; `master` y a ajouté le lint et un hook pre-commit
(`lefthook.yml`) depuis. Mais aucune migration appliquée, aucune fonction déployée, aucun
build déclenché. Tout le déploiement est manuel.

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

**Concept** — _Pipeline de livraison_ et compatibilité de schéma. Le point dur n'est pas
d'automatiser les commandes, c'est l'ordonnancement : pendant un déploiement, ancien code
et nouveau schéma coexistent. Le motif _expand/contract_ est la réponse, et il est
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
    branches: ["master"]

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
  un vrai build ou si une mise à jour OTA suffit. C'est de la _détection de changement_
  pour éviter du travail inutile — le même raisonnement qu'un cache de build.
- À savoir : les workflows planifiés (`on: schedule`) sont réservés aux offres payantes.

**Réussi quand** — Une release part sans que tu tapes une commande de build, et tu sais
dire quel job a produit quel artefact.

**Concept** — _Pipelines déclaratifs, graphe de dépendances, artefacts_. `needs`,
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

**Concept** — _Progressive delivery_ et MTTR. Déployer, c'est facile ; revenir en arrière
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
  Noter la différence avec une alerte sur erreur — ici c'est l'_absence_ d'événement qui
  est le signal, et c'est toujours le cas le plus difficile.
- Jouer les scénarios d'échec : révoquer le token TMDB, mettre un mauvais `CRON_SECRET`.
  Est-ce que ton dispositif les détecte ? Combien de temps après ?
- Lire les advisors de sécurité et de performance du projet Supabase, et traiter ce qui
  remonte.

**Réussi quand** — Tu es prévenu d'un digest manquant avant de t'en apercevoir par
l'absence de notification sur ton téléphone.

**Concept** — _Observabilité_ : logs, métriques, alertes sur absence de signal. On ne
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
sont _les mêmes problèmes_ à toutes les échelles. C'est 80 % du métier, et ce repo les
contient tous pour de vrai.

---

## Ordre recommandé

0 → 1 → 2 sont fondamentaux et rapides (quelques heures chacun) : ils rendent le projet
reproductible et sûr. 3 → 4 forment le vrai pipeline et demandent le plus de travail.
5 → 6 sont spécifiques au mobile mais 6 est le plus formateur du lot. 7 se fait en
parallèle de n'importe quel autre. 8 quand tu veux sortir du confort du PaaS.

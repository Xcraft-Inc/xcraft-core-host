# 📘 xcraft-core-host

## Aperçu

`xcraft-core-host` est le module de démarrage et d'amorçage du framework Xcraft. Il assure la compatibilité avec deux moteurs d'exécution — **Node.js** et **Electron** — et orchestre l'intégralité du cycle de vie d'une application Xcraft : chargement de la configuration, sélection du realm, gestion du proxy réseau, démarrage du serveur Xcraft, connexion au bus de communication, et lancement des quêtes applicatives principales.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Configuration avancée](#configuration-avancée)
- [Détails des sources](#détails-des-sources)
- [Licence](#licence)

## Structure du module

Le module s'organise autour de plusieurs composants principaux :

- **`bin/host`** : Point d'entrée CLI qui instancie et exécute le host
- **`lib/host.js`** : Classe `Host` orchestrant le démarrage complet de l'application
- **`lib/index.js`** : Export public de la configuration résolue au chargement du module
- **`lib/initialConfigLoader.js`** : Chargement asynchrone de la configuration initiale avec gestion des realms
- **`lib/configBuilder.js`** : Construction de l'objet de configuration complet avec fonctions utilitaires
- **`lib/applyOverrides.js`** : Application des surcharges d'environnement sur la configuration initiale
- **`lib/args-parsing.js`** : Analyse des arguments en ligne de commande via yargs
- **`lib/helpers.js`** : Fonctions utilitaires de bas niveau (lecture de projet, chemins)
- **`lib/proxy.js`** : Singleton de gestion du proxy HTTP/HTTPS
- **`lib/wm.js`** : Gestionnaire de fenêtres Electron (singleton global)
- **`lib/screen.js`** : Utilitaire de calcul des bounds de fenêtre
- **`lib/msgbox.js`** : Fenêtre modale légère pour les messages de progression

## Fonctionnement global

Le démarrage d'une application Xcraft suit ce flux :

```
bin/host
  └─> host.js (run)
        ├─> initialConfigLoader  → lit goblins.json / westeros.json
        │     └─> (Electron + useRealms) sync fichiers .ork depuis resources
        ├─> applyOverrides       → applique les surcharges env (GOBLINS_APP, etc.)
        ├─> Host.load()
        │     ├─> configBuilder  → construit l'objet config complet
        │     ├─> selectRealm    → sélection du realm .ork (Electron + useRealms)
        │     ├─> xcraft-server  → instanciation (sans démarrage)
        │     ├─> gatekeeper     → authentification mTLS via serveur gatekeeper
        │     └─> WM.loadConfig / loadSplash  → splash screen Electron
        └─> Host.boot()
              ├─> prologModuleLoad (optionnel)
              ├─> xcraft-server.start()  → démarrage effectif du serveur
              ├─> WM.init() (Electron)
              ├─> BusClient.connect()
              ├─> bootstrapHorde (si module horde enregistré)
              ├─> goblin._init
              └─> _startQuests()
                    ├─> mainQuest     → quête principale (bootstrap applicatif)
                    ├─> afterLoadQuests
                    ├─> secondaryQuest (Electron ready)
                    └─> notifications d'instances/fichiers/URLs en attente
```

### Gestion des realms

Lorsque `useRealms` est activé dans la configuration initiale, le module gère les fichiers `.ork` (realm files). Ces fichiers contiennent des surcharges de configuration pour différents environnements. En mode Electron, si plusieurs realms sont disponibles, une interface de sélection est présentée à l'utilisateur via le splash screen. En mode développement, seuls les fichiers `-dev.ork` sont pris en compte ; en production, tous les fichiers `.ork`.

### Authentification gatekeeper

Pour les applications connectées à un serveur Xcraft distant sécurisé, le module gère un flux d'authentification mTLS :

1. Vérification de l'existence de clés/certificats existants dans le `realmsStorePath`
2. Si absents : enregistrement auprès du gatekeeper via une URL d'authentification OAuth
3. Affichage d'une fenêtre d'authentification dans Electron
4. Sauvegarde des clés PEM reçues dans le `realmsStorePath`
5. Fallback vers import manuel (dialog Electron) si le gatekeeper est inaccessible

### Distribution en tribus (tribes)

Le module implémente un algorithme de routage pour les architectures distribuées. La fonction `getTribeFromId` détermine quelle tribu doit traiter un acteur donné, en se basant sur un hash des caractères de son identifiant :

- Identifiant sans `@` → tribu 0
- Identifiant se terminant par `@` → tribu 0
- Identifiant avec `@` → hash des caractères du dernier segment (1, 2 ou 3 caractères selon la longueur), modulo `(totalTribes - 1) + 1`

L'algorithme extrait le dernier token après le dernier `@`. Selon sa longueur, il combine 1, 2 ou 3 codes de caractères (premier, milieu, dernier) avant d'appliquer le modulo.

### Proxy réseau

Au démarrage, le module tente d'initialiser le proxy HTTP dans cet ordre de priorité :

1. Variables d'environnement (`HTTP_PROXY`, `HTTPS_PROXY`)
2. Registre Windows (`Internet Settings` — HKCU puis HKLM)
3. Fichier PAC (détecté via `AutoConfigURL` mais non supporté)

Si un proxy est détecté, `epsitec-global-agent` est initialisé pour intercepter toutes les requêtes HTTP/HTTPS. Les communications loopback (`127.0.0.1`, `localhost`) sont toujours exclues du proxy.

### Gestion des événements Electron

En mode Electron, le module s'abonne aux événements système :

| Événement            | Action                                                            |
| -------------------- | ----------------------------------------------------------------- |
| `window-all-closed`  | Déclenche l'arrêt via `goblin.tryShutdown`                        |
| `second-instance`    | Notifie la quête `newInstanceQuest`                               |
| `open-file` (macOS)  | Notifie la quête `openFileQuest`                                  |
| `open-url` (macOS)   | Notifie la quête `openUrlQuest`                                   |
| `activate` (macOS)   | Notifie la quête `activateQuest`                                  |
| `lock/unlock` (idle) | Déclenche `cryo.sweep` au verrouillage, re-sync au déverrouillage |

Les événements `open-file`, `open-url` et `second-instance` sont mis en file d'attente si le bus n'est pas encore connecté, puis traités dès que la connexion est établie.

### Interception de protocoles personnalisés

En mode Electron, les protocoles définis dans `config.protocols` sont interceptés via l'API `protocol.handle` d'Electron. Chaque requête est transmise via le bus à la quête correspondante, qui peut retourner un chemin de fichier local à streamer en réponse (avec headers optionnels).

### Gestion de l'arrêt

Lors de la fermeture de l'application, si la synchronisation des actions est activée (`actionsSync.enable`), le module attend la fin des synchronisations en cours avant d'envoyer la commande `shutdown`. Une fenêtre `MsgBox` est affichée pendant l'attente si celle-ci dépasse 500 ms.

## Exemples d'utilisation

### Démarrage depuis un point d'entrée applicatif

```javascript
// app/index.js
const run = require('xcraft-core-host');

run(async (start) => {
  // Fonction optionnelle passée comme "start" à la secondaryQuest
  console.log('Electron ready, launching UI...');
}).catch((err) => {
  console.error(err);
});
```

### Accès à la configuration depuis un autre module

```javascript
const xHost = require('xcraft-core-host');

console.log(xHost.appId); // ex: 'my-app'
console.log(xHost.variantId); // ex: 'prod' (ou undefined)
console.log(xHost.appVersion); // ex: '1.2.3-abc1234'
console.log(xHost.appConfigPath); // ex: '/home/user/.config/MyCompany/my-app'
console.log(xHost.resourcesPath); // chemin vers les ressources de l'app

// Calcul du routage en tribu (4 tribus au total)
const tribe = xHost.getTribeFromId('some-actor@abc123', 4); // → 1, 2, ou 3
```

### Détermination de la clé de routage

```javascript
const xHost = require('xcraft-core-host');

// Retourne 'my-app' ou 'my-app-2' selon l'argument --tribe
const routingKey = xHost.getRoutingKey();
```

### Démarrage CLI (Node.js sans Electron)

```bash
# Lancement direct via le binaire
npx xcraft-host

# Avec options
npx xcraft-host --app my-app --log 2 --tribe 1 --total-tribes 4
```

## Interactions avec d'autres modules

- **[xcraft-server]** : Instanciation et démarrage du serveur Xcraft (bus, routes)
- **[xcraft-core-bus]** : Accès au bus de commandes, génération de noms d'orchestrateurs
- **[xcraft-core-busclient]** : Client bus pour l'envoi de commandes depuis le host
- **[xcraft-core-etc]** : Lecture des configurations des modules
- **[xcraft-core-horde]** : Chargement automatique de la horde (serveurs distants)
- **[xcraft-core-transport]** : Mise à jour des lignes de routage réseau
- **[xcraft-core-goblin]** : Récupération des bases Ripley, enregistrement utilisateur realm
- **[xcraft-core-log]** : Logging interne

Le module est **le point d'entrée unique** de toute application Xcraft. Il est requis par les autres modules via `require('xcraft-core-host')` pour accéder aux métadonnées globales de l'application (chemins, identifiants, version, fonctions de routage).

## Configuration avancée

Le fichier `config.js` expose les options suivantes, gérées par [`xcraft-core-etc`] :

| Option                | Description                                                                                 | Type      | Valeur par défaut |
| --------------------- | ------------------------------------------------------------------------------------------- | --------- | ----------------- |
| `mainQuest`           | Quête principale lancée au démarrage (bootstrap applicatif)                                 | `string`  | `null`            |
| `secondaryQuest`      | Quête lancée quand Electron est prêt                                                        | `string`  | `null`            |
| `afterLoadQuests`     | Liste de quêtes appelées après le chargement du host                                        | `array`   | `[]`              |
| `openFileQuest`       | Quête appelée lors de l'ouverture d'un fichier (macOS)                                      | `string`  | `null`            |
| `openUrlQuest`        | Quête appelée lors de l'ouverture d'une URL enregistrée                                     | `string`  | `null`            |
| `prologModuleLoad`    | Module chargé avant le boot du serveur Xcraft                                               | `string`  | `null`            |
| `singleInstance`      | Rend l'application mono-instance                                                            | `boolean` | `false`           |
| `newInstanceQuest`    | Quête appelée lors du lancement d'une nouvelle instance                                     | `string`  | `null`            |
| `activateQuest`       | Quête appelée lors de l'activation de l'app (macOS)                                         | `string`  | `null`            |
| `appOptions`          | Options CLI personnalisées au format yargs                                                  | `object`  | `null`            |
| `disableGoblinWM`     | Désactive goblin-wm (splash) avec Electron                                                  | `boolean` | `false`           |
| `powerSaveBlockers`   | Bloqueurs d'économie d'énergie Electron (`prevent-app-suspension`, `prevent-display-sleep`) | `array`   | `[]`              |
| `powerMonitorSweeper` | Active le sweeper Cryo au verrouillage système                                              | `boolean` | `false`           |
| `protocols`           | Map de protocoles personnalisés à intercepter (ex: `{"myapp": "quest.name"}`)               | `object`  | `{}`              |

### Variables d'environnement

| Variable                                      | Description                                              | Exemple                     | Valeur par défaut                                   |
| --------------------------------------------- | -------------------------------------------------------- | --------------------------- | --------------------------------------------------- |
| `GOBLINS_APP`                                 | Identifiant de l'application (avec variante optionnelle) | `my-app@prod`               | déduit de `goblins.json`                            |
| `GOBLINS_APP_MASTER`                          | Identifiant de l'application maître (horde)              | `my-app`                    | égal à `GOBLINS_APP`                                |
| `WESTEROS_APP`                                | Alias legacy de `GOBLINS_APP`                            | `my-app`                    | non défini                                          |
| `XCRAFT_APP_CONFIG_PATH`                      | Chemin de stockage de la configuration applicative       | `/data/config`              | `appData/appCompany/appId`                          |
| `XCRAFT_APPENV`                               | Environnement applicatif (`release`, `staging`, etc.)    | `release`                   | valeur de `appEnv` dans `goblins.json`              |
| `NODE_ENV`                                    | Environnement Node.js                                    | `production`                | non défini (mis à `production` si `appEnv=release`) |
| `XCRAFT_LOG`                                  | Niveau de log (0–3)                                      | `2`                         | `2` hors développement                              |
| `XCRAFT_DEBUG`                                | Active l'inspecteur pour les processus enfants           | `1`                         | non défini                                          |
| `XCRAFT_PROBE`                                | Active le probe de performance                           | `1`                         | non défini                                          |
| `GOBLINS_DEVTOOLS`                            | Affiche les devtools React/Redux                         | `1`                         | non défini                                          |
| `XCRAFT_LOG_MODS`                             | Modules pour lesquels les logs sont actifs               | `goblin-wm,xcraft-core-bus` | non défini                                          |
| `HTTP_PROXY`                                  | Proxy HTTP                                               | `http://proxy.corp:8080`    | non défini                                          |
| `HTTPS_PROXY`                                 | Proxy HTTPS                                              | `https://proxy.corp:8080`   | non défini                                          |
| `NO_PROXY`                                    | Exclusions du proxy                                      | `internal.corp`             | `127.0.0.1,localhost`                               |
| `GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE` | Namespace pour global-agent (vidé intentionnellement)    | `""`                        | non défini                                          |
| `PROXY_AUTOCONFIG_URL`                        | URL du fichier PAC détecté (non supporté)                | `http://wpad/proxy.pac`     | non défini                                          |
| `APPIMAGE`                                    | Chemin de l'AppImage Linux (pour l'indicateur système)   | `/opt/app.AppImage`         | non défini                                          |
| `CHROME_DESKTOP`                              | Nom du fichier .desktop pour AppImage Linux              | `appimagekit_<md5>.desktop` | non défini                                          |

## Détails des sources

### `lib/index.js`

Point d'entrée public du module. Au chargement, il résout immédiatement la configuration de l'application en cherchant le fichier `goblins.json` ou `westeros.json` dans l'arborescence du projet, applique les surcharges d'environnement, puis construit et exporte l'objet de configuration complet. Cet export est utilisé par tous les autres modules Xcraft via `require('xcraft-core-host')`. La configuration exportée est marquée `_isMinimalConfig: true` pour indiquer qu'elle n'a pas encore été enrichie par le cycle de démarrage complet.

### `lib/host.js`

Cœur du module. Contient la classe `Host` qui hérite de `EventEmitter` et orchestre le démarrage complet de l'application. Le module exporte directement la fonction `run(start?)` qui instancie un `Host` et appelle séquentiellement `load()` puis `boot()`.

En mode Windows, un patch est appliqué sur `Module._resolveFilename` pour normaliser la casse des lettres de lecteur dans les chemins résolus via des jonctions NTFS — problème survenant lorsque des modules sont référencés à la fois depuis `node_modules/` (junction) et `lib/` (chemin réel).

#### Méthodes publiques

- **`load(initialConfig)`** — Charge et finalise la configuration, sélectionne le realm, instancie `xcraft-server` (sans le démarrer), gère l'authentification gatekeeper si nécessaire, initialise le proxy réseau, et prépare les événements Electron (singleInstance, power management, open-file/url, etc.).
- **`boot(start, isTesting)`** — Démarre effectivement le serveur Xcraft, initialise le gestionnaire de fenêtres, connecte le bus client, démarre la horde si nécessaire, puis déclenche la séquence de quêtes (`mainQuest`, `afterLoadQuests`, `secondaryQuest`).
- **`saveRealmKeys(server, certPem, privateKeyPem)`** — Sauvegarde les clés PEM d'un realm sur le disque dans le `realmsStorePath`.
- **`checkRealmKeys(server)`** — Vérifie l'existence des fichiers clé et certificat d'un realm.
- **`getRealmClientCertificateSubject(server)`** — Lit et retourne le sujet du certificat PEM d'un realm sous forme d'objet (`{CN, OU, E, ...}`).
- **`importKeyAndCertFiles(server, keyFiles)`** — Importe une paire clé/certificat depuis des chemins de fichiers vers le store des realms. Retourne `true` si l'import est réussi.
- **`gatekeeper()`** — Orchestre le flux d'authentification mTLS complet avec le serveur gatekeeper pour tous les serveurs de la topologie qui en ont un.
- **`selectRealm(config)`** — Présente à l'utilisateur la sélection d'un realm `.ork` si plusieurs sont disponibles (via le splash screen), ou sélectionne automatiquement le seul realm disponible.

### `lib/initialConfigLoader.js`

Chargement asynchrone de la configuration initiale. En mode Node.js ou sans realms, retourne directement la configuration issue de `goblins.json`. En mode Electron avec `useRealms`, il synchronise les fichiers `.ork` depuis le dossier `resources` de l'application vers le `realmsStorePath`, filtre selon le mode (production vs développement), et propose à l'utilisateur d'importer manuellement des fichiers realm via un dialog Electron si aucun n'est trouvé dans le store.

### `lib/configBuilder.js`

Construit l'objet de configuration complet à partir de la configuration initiale. Ajoute les fonctions utilitaires `getRoutingKey()` et `getTribeFromId()`, calcule les chemins (`appConfigPath`, `resourcesPath`, `realmsStorePath`), intègre la version applicative depuis `package.json` (avec suffix de commit optionnel), et expose `leaveRealm()` si les realms sont activés. L'objet résultant est assigné à `xcraft-core-host` lors du `load()`.

#### Méthodes de la configuration exportée

- **`getRoutingKey()`** — Retourne la clé de routage pour le bus (`appId` ou `appId-{tribe}` selon l'argument `--tribe`).
- **`getTribeFromId(id, totalTribes)`** — Calcule le numéro de tribu pour un identifiant d'acteur donné. Retourne 0 pour les identifiants sans `@` ou se terminant par `@`. Pour les autres, effectue un hash basé sur les codes de caractères du dernier segment, modulo `(totalTribes - 1) + 1`.
- **`leaveRealm()`** — Supprime les fichiers clé et certificat PEM du realm courant du store (déconnexion propre d'un realm).

### `lib/applyOverrides.js`

Applique les surcharges d'environnement sur la configuration initiale lue depuis `goblins.json`. Résout `appId` et `variantId` depuis la variable `GOBLINS_APP` (ou `WESTEROS_APP` en fallback), `masterAppId` depuis `GOBLINS_APP_MASTER`, détermine `appData` depuis `XCRAFT_APP_CONFIG_PATH` ou `xcraft-core-utils`, et calcule le chemin `realmsStorePath` (différencié production/développement).

### `lib/args-parsing.js`

Analyse des arguments en ligne de commande avec `yargs`. Expose une fonction `parseArgs(parse?, commandLine?, skipEnv?)` qui construit et met en cache l'objet `argv`. Les arguments Electron (`--inspect`, `--inspect-brk`, `--remote-debugging-port`, `--original-process-start-time`, `--allow-file-access-from-files`) sont filtrés avant l'analyse yargs.

Les arguments reconnus et leurs variables d'environnement associées :

| Argument                 | Alias | Variable d'env     | Description                                    |
| ------------------------ | ----- | ------------------ | ---------------------------------------------- |
| `--app`                  | `-a`  | `GOBLINS_APP`      | Nom de l'application (caché hors dev)          |
| `--tribe`                | `-t`  | —                  | Numéro de tribu (caché hors dev)               |
| `--total-tribes`         | `-T`  | —                  | Nombre total de tribus (caché hors dev)        |
| `--devtools`             | —     | `GOBLINS_DEVTOOLS` | Affiche les devtools frontend                  |
| `--debug-child`          | `-d`  | `XCRAFT_DEBUG`     | Active l'inspecteur pour les processus enfants |
| `--probe`                | —     | `XCRAFT_PROBE`     | Active le probe de performance                 |
| `--log`                  | `-l`  | `XCRAFT_LOG`       | Niveau de log (0–3)                            |
| `--log-mods`             | —     | `XCRAFT_LOG_MODS`  | Modules avec logs actifs                       |
| `--locale`               | —     | —                  | Locale de démarrage                            |
| `--no-splash`            | —     | —                  | Démarre sans splash screen                     |
| `--nabu`                 | —     | —                  | Active le traducteur Nabu                      |
| `--no-tls`               | —     | —                  | Connexion bus sans TLS                         |
| `--relaunch-reason`      | —     | —                  | Raison du redémarrage (caché)                  |
| `--relaunch-desktops`    | —     | —                  | DesktopIds à rouvrir après relaunch (caché)    |
| `--topology`             | —     | —                  | Configuration réseau de topologie              |
| `--disable-actions-sync` | —     | —                  | Désactive la synchronisation du store          |

### `lib/helpers.js`

Fonctions utilitaires de bas niveau :

- **`loadInitialConfig(projectPath)`** — Lit `goblins.json` ou `westeros.json` depuis un chemin de projet. Lance une exception si aucun fichier n'est trouvé.
- **`loadProject()`** — Remonte l'arborescence depuis `__dirname` pour trouver le projet racine contenant `goblins.json` avec un `appId` valide. Ignore les dossiers `node_modules`.
- **`getResourcesPath(projectPath, masterAppId, variantId)`** — Retourne le chemin `app/{masterAppId}/resources[@{variantId}]` si ce dossier existe, sinon `process.resourcesPath` ou `projectPath`.
- **`importRealmFile(filePath, storePath)`** — Copie un fichier `.ork` dans le store des realms, en créant le répertoire destination si nécessaire.

### `lib/proxy.js`

Singleton `HttpProxy` qui tente d'initialiser la pile réseau avec un proxy via `initNetworkStack()`. Les communications loopback (`127.0.0.1`, `localhost`) sont toujours exclues du proxy. Les URLs de proxy invalides (ex: `http://http=localhost`) sont filtrées.

Sur Windows, la lecture du registre s'effectue dans cet ordre : `HKEY_CURRENT_USER` puis `HKEY_LOCAL_MACHINE`. Le proxy doit être explicitement activé (`ProxyEnable = 1`) pour être pris en compte.

### `lib/wm.js`

Gestionnaire de fenêtres Electron, exposé comme singleton global via `Symbol.for('goblin-wm.window-manager')`. Gère le cycle de vie de toutes les fenêtres Electron de l'application, incluant le splash screen, les fenêtres d'authentification OAuth, et les fenêtres applicatives principales.

La classe interne `Window` encapsule un `BrowserWindow` Electron avec des comportements par défaut : masquage initial jusqu'au `ready-to-show`, suppression du menu, prévention des changements de titre, et support des DevTools. Elle gère également les partitions de session en substituant `$PROCESS_PID` par le PID courant du processus, ce qui garantit qu'une seconde instance démarre sans délai.

#### Méthodes publiques de `WindowManager`

- **`create(windowId, options)`** — Crée et enregistre une nouvelle fenêtre Electron. Ferme automatiquement le splash (avec un délai `splashDelay`) quand la première fenêtre non-splash devient visible. Gère optionnellement les liens externes et le menu contextuel selon la configuration.
- **`displaySplash(onLoaded)`** — Affiche la fenêtre splash. Charge `splash.html` depuis les resources si disponible, sinon le fichier intégré. Souscrit aux événements `client.progressed` pour afficher la progression.
- **`displayAuth(authUrl, takeWholeScreen, onClose, noParent, windowId, onLoaded, windowOptions)`** — Affiche une fenêtre d'authentification OAuth. Si une fenêtre avec le même `windowId` existe déjà, la met au premier plan. Retourne une fonction disposer.
- **`prompt({values})`** — Affiche une liste de choix via le splash screen (utilisé pour la sélection de realm). Retourne une `Promise` avec la valeur sélectionnée via IPC.
- **`dispose(windowId, clearStorageData)`** — Ferme et supprime une fenêtre du gestionnaire. Peut effacer les données de session si `clearStorageData` est `true`.
- **`disposeAll()`** — Ferme toutes les fenêtres enregistrées.
- **`focus()`** — Restaure et met au premier plan la fenêtre courante (dernière fenêtre créée).
- **`init(xHost)`** — Initialise le gestionnaire avec la référence au `Host`, configure l'User-Agent Electron, et établit le client bus interne.
- **`loadConfig()`** — Charge la configuration de `goblin-wm` via `xcraft-core-etc`, avec fallback sur `splashWindowOptions` de `xcraft-core-host`.
- **`loadSplash()`** — Affiche le splash si l'argument `--no-splash` n'est pas présent et que `disableSplash` n'est pas activé dans la config.
- **`setWindowCurrentFeeds(windowId, desktopId, feeds)`** — Associe des feeds Xcraft à une fenêtre identifiée.
- **`getWindowIdFromDesktopId(desktopId)`** — Retrouve l'identifiant de fenêtre depuis un `desktopId` Xcraft.
- **`getWindowInstance(windowId)`** — Retourne l'objet `BrowserWindow` Electron pour un `windowId` donné.
- **`getWindowOptions(windowId)`** — Retourne les options de fenêtre utilisées lors de la création.
- **`getWindowState(window)`** — Retourne l'état courant d'une fenêtre (bounds, maximized, fullscreen).
- **`getDefaultWindowState()`** — Retourne l'état par défaut basé sur les bounds calculées par `Screen`.

### `lib/screen.js`

Classe utilitaire `Screen` avec une méthode statique :

- **`getDefaultWindowBounds(uWidth, uHeight)`** — Calcule les bounds d'une fenêtre centrée sur l'écran courant (écran le plus proche du curseur). Utilise 80% de la zone de travail par défaut ; bascule à 100% si la zone serait inférieure à 1280×720. Si des dimensions fixes sont fournies, les utilise telles quelles et centre la fenêtre.

### `lib/msgbox.js`

Fenêtre modale Electron légère (`MsgBox`) pour afficher des messages de progression (ex. : synchronisation de base de données en cours lors de l'arrêt). Fond bleu foncé (`#1e3d5b`), sans cadre, toujours centrée.

- **`open()`** — Ouvre la fenêtre en chargeant `msgbox.html`.
- **`emit(message)`** — Envoie un message HTML via IPC (`progress`) pour mise à jour de l'affichage.
- **`close()`** — Ferme la fenêtre si elle n'est pas déjà détruite.

### `test/tribe.spec.js`

Tests unitaires vérifiant l'algorithme de calcul de tribu `getTribeFromId`. Couvre les cas : identifiant sans `@`, avec `@` vide, avec segment d'un, deux, et plusieurs caractères, et avec segments imbriqués (`a@z@xxx`). Valide que le routage est déterministe et bien distribué.

## Licence

Ce module est distribué sous [licence MIT](./LICENSE).

---

_Ce contenu a été généré par IA_

[xcraft-server]: https://github.com/Xcraft-Inc/xcraft-server
[xcraft-core-bus]: https://github.com/Xcraft-Inc/xcraft-core-bus
[xcraft-core-busclient]: https://github.com/Xcraft-Inc/xcraft-core-busclient
[xcraft-core-etc]: https://github.com/Xcraft-Inc/xcraft-core-etc
[xcraft-core-horde]: https://github.com/Xcraft-Inc/xcraft-core-horde
[xcraft-core-transport]: https://github.com/Xcraft-Inc/xcraft-core-transport
[xcraft-core-goblin]: https://github.com/Xcraft-Inc/xcraft-core-goblin
[xcraft-core-log]: https://github.com/Xcraft-Inc/xcraft-core-log

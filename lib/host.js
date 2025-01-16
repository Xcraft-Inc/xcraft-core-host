#!/usr/bin/env node
'use strict';

if (process.platform === 'win32') {
  /* HACK: workaround when require.resolve is used on modules
   * that are created as junctions on Windows. When a junction
   * is resolved to the real directory, the drive letter doesn't
   * use the same case. It's a major problem when a module is
   * required from module in node_modules/ and other modules
   * in lib/ (referenced in node_modules/ with a junction).
   */
  const Module = require('module');
  const origResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function () {
    const result = origResolveFilename.apply(this, arguments);
    return result.replace(/^([a-z]):/, (c) => c.toUpperCase());
  };
}

const moduleName = 'xcraft-core-host';
const xLog = require('xcraft-core-log')(moduleName);

const fse = require('fs-extra');
const path = require('node:path');
const initialConfigLoader = require('./initialConfigLoader.js');
const configBuilder = require('./configBuilder.js');

const neutron = require('xcraft-core-host/lib/neutron.js');
const isElectron = neutron.isGraphical();

const watt = require('gigawatts');
const EventEmitter = require('events');

class Host extends EventEmitter {
  #sweeped = false;
  #idleStateInterval;
  #secondInstance = [];
  #filePath = [];
  #openUrl = [];
  #config = null;
  _app = null;

  constructor() {
    super();

    if (isElectron) {
      const {app} = require('xcraft-core-host/lib/neutron.js');
      this._app = app;
    }

    watt.wrapAll(this);
  }

  getRealmKeysPath(server) {
    const keyPath = path.join(
      this.#config.realmsStorePath,
      `${server}@${this.#config.variantId}-key.pem`
    );
    const certPath = path.join(
      this.#config.realmsStorePath,
      `${server}@${this.#config.variantId}-cert.pem`
    );
    return {keyPath, certPath};
  }

  async saveRealmKeys(server, certPem, privateKeyPem) {
    const {keyPath, certPath} = this.getRealmKeysPath(server);
    await fse.writeFile(certPath, certPem);
    await fse.writeFile(keyPath, privateKeyPem);
  }

  importKeyAndCertFiles(server, keyFiles) {
    const {certPath, keyPath} = this.getRealmKeysPath(server);

    if (keyFiles.length !== 2) {
      return false;
    }

    const list = [];

    for (const keyFile of keyFiles) {
      const basename = path.basename(keyFile);
      if (basename === path.basename(certPath)) {
        list.push({src: keyFile, dst: certPath});
      } else if (basename === path.basename(keyPath)) {
        list.push({src: keyFile, dst: keyPath});
      }
    }

    if (list.length !== 2) {
      return false;
    }

    for (const {src, dst} of list) {
      fse.copySync(src, dst);
    }

    return true;
  }

  getRealmClientCertificateSubject(server) {
    const pki = require('node-forge').pki;
    const {certPath} = this.getRealmKeysPath(server);
    const certPem = fse.readFileSync(certPath);
    const cert = pki.certificateFromPem(certPem);
    return Object.fromEntries(
      cert.subject.attributes.map((attr) => [attr.shortName, attr.value])
    );
  }

  checkRealmKeys(server) {
    const {keyPath, certPath} = this.getRealmKeysPath(server);
    const hasKey = fse.existsSync(keyPath);
    const hasCert = fse.existsSync(certPath);
    //TODO: check expire date ?
    return hasKey && hasCert;
  }

  async tryToImportKeys(server) {
    xLog.err('Gatekeeper process failed, ask for keys...');

    const {app, dialog} = require('xcraft-core-host/lib/neutron.js');
    await app.whenReady();

    const result = dialog.showMessageBoxSync({
      title: `Connection to the ${server} realm`,
      type: 'info',
      message:
        'The connection via the gatekeeper has failed.\nYou must provide the keys or quit and contact an administrator.',
      buttons: ['Continue', 'Quit'],
    });
    if (result === 1) {
      xLog.dbg(`user canceled import`);
      app.exit(0);
      return;
    }

    const filePaths = dialog.showOpenDialogSync({
      title: 'Select a key and a cert files to import (2 files)',
      defaultPath: app.getPath('home'),
      buttonLabel: 'import',
      filters: [
        {
          name: 'PEM key and certificate file (.pem)',
          extensions: ['pem'],
        },
      ],
      properties: ['openFile', 'multiSelections', 'dontAddToRecent'],
    });
    if (!filePaths) {
      xLog.dbg(`user canceled import`);
      app.exit(0);
      return;
    }

    const imported = this.importKeyAndCertFiles(server, filePaths);
    if (!imported) {
      await dialog.showErrorBox(
        'Error with key and certificate',
        'The provided files are not supported, exit...'
      );
      app.exit(0);
      return;
    }
  }

  async gatekeeper() {
    const {topology} = require('xcraft-core-etc')().load('xcraft-core-horde');
    let realmsUserInfos = {};

    for (const [server, {gatekeeper}] of Object.entries(topology)) {
      if (!gatekeeper) {
        continue;
      }
      const hasKeys = this.checkRealmKeys(server);
      if (hasKeys) {
        const {CN, OU, E} = this.getRealmClientCertificateSubject(server);
        realmsUserInfos[server] = {login: E, rank: OU, id: CN};
        continue;
      }

      let failed;
      try {
        xLog.dbg('Registering with gatekeeper...');
        const registerResp = await fetch(`${gatekeeper}/register`);
        const {providerUrl, waitingUrl} = await registerResp.json();

        xLog.dbg('Login with auth provider...');

        await neutron.wmDisplayAuth(providerUrl, true, null, server);

        const loginResp = await fetch(waitingUrl);
        const results = await loginResp.json();
        const {login, accepted} = results;
        if (!accepted) {
          xLog.dbg('Registration failed for login ', login, ' (not accepted)');
          failed = true;
        } else {
          xLog.dbg('Registration accepted for login ', login);
          const {
            keys: {certPem, privateKeyPem},
          } = results;
          await this.saveRealmKeys(server, certPem, privateKeyPem);
          const {CN, OU, E} = this.getRealmClientCertificateSubject(server);
          realmsUserInfos[server] = {login: E, rank: OU, id: CN};
          xLog.dbg('Realm keys saved');
        }
      } catch (err) {
        failed = true;
        xLog.err('Cannot reach the gatekeeper:', err);
      } finally {
        if (failed) {
          await this.tryToImportKeys(server);
        }
      }
    }

    await neutron.wmDisplaySplash();
    return realmsUserInfos;
  }

  async load(initialConfig) {
    initialConfig = configBuilder(initialConfig);
    const {config, skipEnv} = await this.selectRealm(initialConfig);
    this.#config = config;

    const xHost = require('xcraft-core-host');
    Object.assign(xHost, this.#config);

    if (!process.env.GOBLINS_APP) {
      process.env.GOBLINS_APP = config.variantId
        ? `${config.appId}@${config.variantId}`
        : config.appId;
    }
    if (!process.env.GOBLINS_APP_MASTER) {
      process.env.GOBLINS_APP_MASTER = config.appMasterId;
    }

    if (config.appEnv === 'release' && !process.env.NODE_ENV) {
      process.env.NODE_ENV = 'production';
    }

    if (!process.env.XCRAFT_LOG && process.env.NODE_ENV !== 'development') {
      process.env.XCRAFT_LOG = '2';
    }

    this._appConfigPath = config.appConfigPath;
    this._ignoreCloseRequests = false;
    this._powerSaveBlockerIds = [];

    this._xServer = require('xcraft-server')(
      config.appConfigPath,
      config.projectPath,
      () => require('./args-parsing.js')(false, process.argv, true),
      skipEnv
    );

    if (isElectron && this.#config.useRealms) {
      this.#config.realmsUserInfos = await this.gatekeeper();
    }

    if (isElectron) {
      if (!config.useRealms) {
        await neutron.appWhenReady();
      }
      await neutron.wmLoadConfig();
      if (!config.useRealms) {
        await neutron.wmLoadSplash();
      }
    }

    const xEtc = require('xcraft-core-etc')();
    const appArgs = require('./args-parsing.js')();
    if (appArgs.nabu) {
      /* because nabu is working with an external nabu-thrall server, AXON is mandatory */
      const transportConfig = xEtc.load('xcraft-core-transport');
      if (transportConfig.backends.indexOf('axon') === -1) {
        transportConfig.backends.push('axon');
      }
      xEtc.saveRun('xcraft-core-transport', transportConfig);
    }

    this._xConfig = xEtc.load(moduleName);

    xLog.dbg(`process arguments: ${process.argv.join(' ')}`);

    process.on('uncaughtException', (ex) => {
      xLog.err(
        `Please, ensure to yield properly all async calls: ${
          ex.stack || ex.message || ex
        }`
      );
    });

    if (isElectron) {
      const {powerSaveBlocker, powerMonitor} = neutron;

      if (this._xConfig.singleInstance) {
        const gotTheLock = this._app.requestSingleInstanceLock();
        if (!gotTheLock) {
          this._app.quit();
        } else {
          this._app.on('second-instance', (event, rawArgs, workingDir) => {
            try {
              neutron.wmFocusApp();
              const args = require('./args-parsing.js')(true, rawArgs);
              if (this._busClient && this._busClient.isConnected()) {
                this._notifyNewInstance(args, workingDir, rawArgs);
              } else {
                this.#secondInstance.push({args, workingDir, rawArgs});
              }
            } catch (err) {
              xLog.err(err.stack || err.message || err);
            }
          });
        }
      }

      this._app.on('window-all-closed', () => {
        if (this._ignoreCloseRequests) {
          const MsgBox = require('./msgbox.js');
          const alert = new MsgBox();
          alert.open();
          alert.emit('Waiting for application restart...');
          return;
        }
        if (this._busClient && this._busClient.isConnected()) {
          this._notifyAppClosed();
        } else {
          this._app.quit();
        }
      });

      // Specific for macOS
      this._app.on('open-file', (ev, filePath) => {
        if (this._busClient && this._busClient.isConnected()) {
          this._notifyOpenFile(filePath);
        } else {
          this.#filePath.push(filePath);
        }
        ev.preventDefault();
      });

      this._app.on('open-url', (ev, url) => {
        if (this._busClient && this._busClient.isConnected()) {
          this._notifyOpenUrl(url);
        } else {
          this.#openUrl.push(url);
        }
        ev.preventDefault();
      });

      for (const blockerType of this._xConfig.powerSaveBlockers) {
        this._powerSaveBlockerIds.push(powerSaveBlocker.start(blockerType));
      }

      if (this._xConfig.powerMonitorSweeper) {
        this.#idleStateInterval = setInterval(() => {
          const idleState = powerMonitor.getSystemIdleState(30);
          switch (idleState) {
            case 'locked':
              this._notifyPowerMonitorLock('locked');
              break;
            case 'active':
            case 'unknown':
              this._notifyPowerMonitorLock('unlocked');
              break;
          }
        }, 1000);
      }
    } else {
      xLog.info(`node runtime detected`);
    }

    xLog.info(`config; ${JSON.stringify(config, null, 2)}`);
  }

  async selectRealm(config) {
    let selectedRealm = null;
    let skipEnv = false;

    if (isElectron && config.useRealms) {
      await neutron.appWhenReady();

      if (config.realmFiles.length > 1) {
        selectedRealm = await neutron.wmPrompt({
          values: config.realmFiles,
        });
      } else {
        selectedRealm = config.realmFiles[0];
        await neutron.wmDisplaySplash();
      }
    }

    if (selectedRealm) {
      xLog.dbg(`selected realm: ${selectedRealm}`);
      config.variantId = selectedRealm.replace(/\.ork$/, '');
      config.appConfigPath = path.join(
        config.appData,
        config.appCompany,
        config.variantId ? `${config.appId}-${config.variantId}` : config.appId
      );

      const realmPath = path.join(config.realmsStorePath, selectedRealm);
      const xcraftRoot = path.join(
        config.appData,
        config.appCompany,
        `${config.appId}-${config.variantId}`
      );

      const overrider = fse.readJSONSync(realmPath);
      require('xcraft-server/lib/init-env.js')(
        xcraftRoot,
        config.projectPath,
        null,
        overrider
      );
      skipEnv = true;

      delete process.env.GOBLINS_APP;
      delete process.env.GOBLINS_APP_MASTER;
    }

    config._isMinimalConfig = false;
    return {config, skipEnv};
  }

  get config() {
    return this.#config;
  }

  get filePath() {
    return this.#filePath;
  }

  *_waitForSync(next) {
    let alert;
    let databases;

    const emit = () => {
      if (!alert) {
        return;
      }
      if (databases?.length) {
        alert.emit(`Synchronizing ${databases.join(', ')}<br/>Please wait…`);
      } else {
        alert.emit(`Synchronizing<br/>Please wait…`);
      }
    };

    setTimeout(() => {
      const MsgBox = require('./msgbox.js');
      alert = new MsgBox();
      alert.open();
      emit();
    }, 500);

    for (let wait = false; ; wait = true) {
      const res = yield this._busClient.command.send(
        'goblin.tryShutdown',
        {wait},
        null,
        next
      );
      if (!res.data) {
        break;
      }

      ({databases} = res.data);
      if (!databases.length) {
        break;
      }

      emit();
    }

    if (alert) {
      alert.close();
    }
  }

  // FIXME: not 100% accurate..
  *_terminate(next) {
    if (this.#idleStateInterval) {
      clearInterval(this.#idleStateInterval);
      this.#idleStateInterval = null;
    }

    const goblinConfig = require('xcraft-core-etc')().load(
      'xcraft-core-goblin'
    );

    if (goblinConfig?.actionsSync?.enable) {
      yield this._waitForSync();
    }
    if (this._unsubLineUpdated) {
      this._unsubLineUpdated();
    }
    if (this._busClient) {
      this._busClient.command.send('shutdown');
    }

    if (isElectron) {
      const {powerSaveBlocker} = require('xcraft-core-host/lib/neutron.js');
      for (const powerSaveId of this._powerSaveBlockerIds) {
        powerSaveBlocker.stop(powerSaveId);
      }
    }
  }

  _notifyOpenFile(filePath) {
    if (!this._xConfig.openFileQuest) {
      return;
    }
    this._busClient.command.send(
      this._xConfig.openFileQuest,
      {filePaths: [filePath]},
      null,
      (err) => {
        if (err) {
          xLog.err(err.stack || err.message || err);
        }
      }
    );
  }

  _notifyOpenUrl(url) {
    if (!this._xConfig.openUrlQuest) {
      return;
    }
    this._busClient.command.send(
      this._xConfig.openUrlQuest,
      {url},
      null,
      (err) => {
        if (err) {
          xLog.err(err.stack || err.message || err);
        }
      }
    );
  }

  *_notifyProtocol(req, next) {
    let {protocol, host, pathname, href} = new URL(req.url);
    protocol = protocol.split(':', 1)[0];

    if (!this._xConfig.protocols?.[protocol]) {
      return;
    }
    if (!this._busClient || !this._busClient.isConnected()) {
      return;
    }

    const result = yield this._busClient.command.send(
      this._xConfig.protocols[protocol],
      {protocol, host, pathname, href},
      null,
      next
    );
    if (result?.data) {
      const stream = fse.createReadStream(result.data);
      return new Response(stream);
    }
  }

  _notifyPowerMonitorLock(status) {
    if (!this._xConfig.powerMonitorSweeper) {
      return;
    }
    if (!this._busClient || !this._busClient.isConnected()) {
      return;
    }
    const hasSweeper = this._busClient.getCommandsNames()['cryo.sweep'];
    if (!hasSweeper) {
      return;
    }
    if (status === 'unlocked') {
      this.#sweeped = false;
      return;
    }
    if (status === 'locked' && !this.#sweeped) {
      this._busClient.command.send('cryo.sweep', null, null, (err) => {
        this.#sweeped = true;
        if (err) {
          xLog.err(err.stack || err.message || err);
        }
      });
    }
  }

  _notifyAppClosed() {
    this._terminate();
  }

  _notifyNewInstance(args, workingDir, rawArgs) {
    if (!this._xConfig.newInstanceQuest) {
      return;
    }
    this._busClient.command.send(
      this._xConfig.newInstanceQuest,
      {commandLine: args, workingDirectory: workingDir, rawArgs},
      null,
      (err) => {
        if (err) {
          xLog.err(err.stack || err.message || err);
        }
      }
    );
  }

  _getGoblinUser() {
    const busConfig = require('xcraft-core-etc')().load('xcraft-core-bus');
    const {resourcesPath} = require('xcraft-core-host');
    const policiesJSONFile = path.join(resourcesPath, busConfig.policiesPath);
    const {readJSONSync} = require('fs-extra');
    const policies = readJSONSync(policiesJSONFile, {throws: false});
    let goblinUser;
    if (policies && policies.defaultSystemUserId) {
      goblinUser = `${policies.defaultSystemUserId}@system`;
    } else {
      goblinUser = 'defaultSystemUser@system';
    }

    if (
      this.#config.useRealms &&
      this.#config.realmsUserInfos &&
      Object.keys(this.#config.realmsUserInfos).length > 0
    ) {
      const Goblin = require('xcraft-core-goblin');
      //get the first entry, in multi-realms can be prolematic
      const userInfos = Object.values(this.#config.realmsUserInfos)[0];
      Goblin.registerUser(userInfos);
      goblinUser = userInfos.id;
    }
    return goblinUser;
  }

  *_init(xBus, next) {
    /* HACK: force and unusual orc name.
     * The problem is that the greathall::* topic is already registered, then
     * when this BusClient is used to send commands, an other orc name must
     * be used in order to handle properly all subscribes of events.
     */
    let connected = false;

    const httpProxy = require('./proxy.js');
    yield httpProxy.initNetworkStack();

    const _next = next.parallel();
    const unsub = this._busClient.events.subscribe(`greathall::loaded`, () => {
      unsub();
      _next();
    });

    this._ignoreCloseRequests = false;
    const onReconnect = (callback) => {
      this._busClient
        .on('reconnect', () => callback('done'))
        .on('reconnect attempt', () => callback('attempt'));
      return () => {
        this._busClient.removeListener('reconnect', callback);
        this._busClient.removeListener('reconnect attempt', callback);
      };
    };

    onReconnect((status) => {
      const goblinConfig = require('xcraft-core-etc')().load(
        'xcraft-core-goblin'
      );
      const syncClientEnabled = goblinConfig.actionsSync?.enable;

      switch (status) {
        case 'attempt':
          this._ignoreCloseRequests = syncClientEnabled ? false : true;
          xLog.warn('Connection lost with the server, attempt a reconnection');
          break;
        case 'done':
          this._ignoreCloseRequests = false;
          xLog.dbg('New connection done');
          break;
      }
    });

    const onCommandsRegistry = () => {
      if (!this._busClient.isConnected() || !connected) {
        return;
      }
      this._busClient.removeListener('commands.registry', onCommandsRegistry);
      this._busClient.command.send(
        'goblin._init',
        null,
        null,
        (err) => this.emit('goblin.initialized', err),
        {forceNested: true}
      );
    };
    this._busClient.on('commands.registry', onCommandsRegistry);

    const isLoaded = yield this._busClient.connect('ee', null, next);
    if (isLoaded) {
      unsub();
      _next();
    }

    connected = true;
    yield next.sync();

    this._unsubLineUpdated = this._busClient.events.subscribe(
      '*::warehouse.lines-updated',
      (msg) => {
        const {Router} = require('xcraft-core-transport');
        Router.updateLines(
          msg.data.lines,
          msg.data.token,
          msg.data.generation,
          msg._xcraftHorde
        );
      }
    );

    xBus.notifyCmdsRegistry();
  }

  *_startAndRunMainQuest(goblinUser, next) {
    /* Start the main quest (app bootstrap). */
    yield this._busClient.command.send(
      this._xConfig.mainQuest,
      null,
      null,
      next,
      null,
      {_goblinUser: goblinUser}
    );
  }

  *_bootstrapHorde() {
    const xHorde = require('xcraft-core-horde');
    if (xHorde.config.autoload) {
      const resp = this._busClient.newResponse(moduleName);
      yield xHorde.autoload(resp);
    }
  }

  *_startQuests(xBus, next) {
    let alert;
    const goblinUser = this._getGoblinUser();
    this._startAndRunMainQuest(goblinUser, next.parallel());
    if (this._app) {
      const _next = next.parallel();
      this._app
        .whenReady()
        .then(() => _next())
        .catch(_next);

      const appArgs = require('./args-parsing.js')();

      if (isElectron && appArgs['relaunch-reason']) {
        const {app} = require('xcraft-core-host/lib/neutron.js');
        let message = `${app.getName()} is restarting, please wait...`;
        if (appArgs) {
          switch (appArgs['relaunch-reason']) {
            case 'client-connection':
              message = `${app.getName()} is restarting after a connection lose, please wait...`;
              break;
            case 'server-restart':
              message = `${app.getName()} is restarting after a server restart, please wait...`;
              break;
          }
        }

        const MsgBox = require('./msgbox.js');
        alert = new MsgBox();
        alert.open();
        alert.emit(message);
      }
    }

    if (isElectron) {
      const {protocol} = neutron;
      for (const proto of Object.keys(this._xConfig.protocols)) {
        protocol.handle(proto, async (req) => await this._notifyProtocol(req));
      }
    }

    yield next.sync();

    if (this._xConfig.afterLoadQuests) {
      for (const quest of this._xConfig.afterLoadQuests) {
        yield this._busClient.command.send(quest, null, null, next, {
          forceNested: true,
        });
      }
    }

    xBus.acceptIncoming();

    for (const {args, workingDir, rawArgs} of this.#secondInstance) {
      try {
        this._notifyNewInstance(args, workingDir, rawArgs);
      } catch (err) {
        xLog.err(err.stack || err.message || err);
      }
    }
    this.#secondInstance.length = 0;

    for (const filePath of this.#filePath) {
      this._notifyOpenFile(filePath);
    }
    this.#filePath.length = 0;

    for (const openUrl of this.#openUrl) {
      this._notifyOpenUrl(openUrl);
    }
    this.#openUrl.length = 0;

    if (alert) {
      setTimeout(() => alert.close(), 4000);
    }

    if (this._xConfig.secondaryQuest) {
      /* Start the secondary quest (electron ready) */
      yield this._busClient.command.send(
        this._xConfig.secondaryQuest,
        null,
        null,
        next,
        null,
        {_goblinUser: goblinUser}
      );
    }
  }

  *boot(next) {
    if (this._xConfig.prologModuleLoad) {
      /* Ensure that the event loop is empty (handle macOS open-file events), then continue */
      yield setTimeout(next, 100);
      require(this._xConfig.prologModuleLoad)(this);
    }

    yield this._xServer.start(next);

    if (isElectron && !this._xConfig.disableGoblinWM) {
      yield neutron.wmInit(this);
    }

    const {BusClient} = require('xcraft-core-busclient');
    const xBus = require('xcraft-core-bus');

    this._busClient = new BusClient();
    this._busClient._orcName = xBus.generateOrcName();

    if (xBus._commander.isModuleRegistered('horde')) {
      yield this._bootstrapHorde();
    }

    if (this._xConfig.mainQuest) {
      const _next = next.parallel();
      this.on('goblin.initialized', (err) => {
        if (err) {
          _next(err);
          return;
        }
        this._startQuests(xBus, _next);
      });
      yield this._init(xBus);
      yield next.sync();
    } else {
      yield this._init(xBus);
      xBus.acceptIncoming();
    }
  }
}

/* Prepare GOBLINS_APP environment variable */
const appArg = process.argv.reduce((res, arg, it, arr) => {
  if (/^--app=/.test(arg)) {
    //                           --app=venture-trade-company
    res.unshift(arg.split('=')[1]);
  } else if (
    /^-[b-z]+a$/.test(arg) || //   -da venture-trade-company
    arg === '-a' || //              -a venture-trade-company
    arg === '--app' //           --app venture-trade-company
  ) {
    res.unshift(arr[it + 1]);
  }
  return res;
}, []);
if (appArg.length > 0) {
  process.env.GOBLINS_APP = appArg[0];
  if (!process.env.GOBLINS_APP_MASTER) {
    process.env.GOBLINS_APP_MASTER = process.env.GOBLINS_APP;
  }
}

const run = async () => {
  if (isElectron) {
    xLog.info(`electron runtime detected,`);
    const {protocol, app} = neutron;

    protocol.registerSchemesAsPrivileged([
      {scheme: 'app', privileges: {standard: true}},
    ]);

    /* Enable app indicator support with Linux and AppImage */
    if (process.platform === 'linux' && process.env.APPIMAGE) {
      const {md5} = require('xcraft-core-utils/lib/crypto.js');
      const id = md5(`file://${path.resolve(process.env.APPIMAGE).trim()}`);
      const desktopName = `appimagekit_${id}.desktop`;
      process.env['CHROME_DESKTOP'] = desktopName;
      app?.setDesktopName(desktopName);
    }
  }

  const initialConfig = await initialConfigLoader(appArg, isElectron);
  if (!initialConfig) {
    return;
  }
  const host = new Host();
  await host.load(initialConfig);
  host.boot().catch((err) => {
    xLog.err(err.stack || err.message || err);
  });
};
run();

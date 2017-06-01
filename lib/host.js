'use strict';

const moduleName = 'xcraft-core-host';

const {app} = require ('electron');
const watt = require ('watt');
const path = require ('path');
const xLog = require ('xcraft-core-log') (moduleName);

class Host {
  constructor () {
    this._isElectron = !!process.versions.electron;
    this._appConfigPath = {};

    if (this._isElectron) {
      const config = require ('./index.js');
      this._appConfigPath = config.appConfigPath;

      xLog.info (
        `electron runtime detected, config path: ${config.appConfigPath}, project path: ${config.projectPath}`
      );

      this._xServer = require ('xcraft-server') (
        config.appConfigPath,
        config.projectPath
      );

      app.on ('window-all-closed', () => {}); /* Prevent the app exiting */
    } else {
      // FIXME
      this._xServer = require ('xcraft-server') ();
    }

    const etcRoot = path.join (this._appConfigPath, 'etc');
    this._xConfig = require ('xcraft-core-etc') (etcRoot).load (moduleName);

    watt.wrapAll (this);
  }

  *_startAndRunMainQuest (busClient, next) {
    yield this._xServer.start (next);

    /* HACK: force and unusual orc name.
     * The problem is that the greathall::* topic is already registered, then
     * when this BusClient is used to send commands, an other orc name must
     * be used in order to handle properly all subscribes of events.
     */
    busClient._orcName = 'host';

    yield busClient.connect (
      'ee',
      require ('xcraft-core-busclient').getGlobal ().getToken (),
      next
    );

    /* Start the main quest (app bootstrap). */
    yield busClient.command.send (this._xConfig.mainQuest, null, null, next);
  }

  *boot (next) {
    if (this._isElectron) {
      app.once ('ready', next.parallel ().arg (0));
    }

    const {BusClient} = require ('xcraft-core-busclient');
    const busClient = new BusClient ();

    this._startAndRunMainQuest (busClient, next.parallel ());
    yield next.sync ();

    /* Start the secondary quest (electron ready) */
    yield busClient.command.send (
      this._xConfig.secondaryQuest,
      null,
      null,
      next
    );
  }
}

const host = new Host ();
host.boot ().catch (xLog.err);

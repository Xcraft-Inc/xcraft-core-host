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

    watt.wrapAll (this);
  }

  *start (next) {
    if (this._isElectron) {
      app.on ('ready', next.parallel ().arg (0));
    }
    this._xServer.start (next.parallel ());
    yield next.sync ();

    const busClient = require ('xcraft-core-busclient').getGlobal ();
    yield busClient.connect (busClient.getToken (), next);

    const etcRoot = path.join (this._appConfigPath, 'etc');
    const xConfig = require ('xcraft-core-etc') (etcRoot).load (moduleName);

    /* Start the main quest (app bootstrap). */
    yield busClient.command.send (xConfig.mainQuest, null, null, next);

    /* Start the secondary quest (electron ready) */
    yield busClient.command.send (xConfig.secondaryQuest, null, null, next);
  }
}

const host = new Host ();
host.start ().catch (xLog.err);

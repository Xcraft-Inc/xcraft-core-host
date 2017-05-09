'use strict';

const moduleName = 'xcraft-core-host';

const watt = require ('watt');
const path = require ('path');
const xLog = require ('xcraft-core-log') (moduleName);

class Host {
  constructor () {
    this._appConfigPath = {};

    if (process.versions.electron) {
      const config = require ('./index.js');
      this._appConfigPath = config.appConfigPath;

      xLog.info (
        `electron runtime detected,\nconfig path: ${config.appConfigPath}\nproject path: ${config.projectPath}`
      );

      this._xServer = require ('xcraft-server') (
        config.appConfigPath,
        config.projectPath
      );

      const {app} = require ('electron');
      app.on ('window-all-closed', () => {}); /* Prevent the app exiting */
    } else {
      // FIXME
      this._xServer = require ('xcraft-server') ();
    }

    watt.wrapAll (this);
  }

  *start (next) {
    yield this._xServer.start (next);

    const busClient = require ('xcraft-core-busclient').getGlobal ();
    yield busClient.connect (busClient.getToken (), next);

    const etcRoot = path.join (this._appConfigPath, 'etc');
    const xConfig = require ('xcraft-core-etc') (etcRoot).load (moduleName);

    /* Start the main quest (app bootstrap). */
    busClient.command.send (xConfig.mainQuest);
  }
}

const host = new Host ();
host.start ().catch (xLog.err);

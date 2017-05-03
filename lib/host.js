'use strict';

const moduleName = 'xcraft-core-host';

const path = require ('path');
const xLog = require ('xcraft-core-log') (moduleName);

let xServer;
let appConfigPath;

if (process.versions.electron) {
  const config = require ('./index.js');
  appConfigPath = config.appConfigPath;

  xLog.info (`electron runtime detected,\nconfig path: ${config.appConfigPath}\nproject path: ${config.projectPath}`);

  xServer = require ('xcraft-server') (
    config.appConfigPath,
    config.projectPath
  );
} else {
  // FIXME
  xServer = require ('xcraft-server') ();
}

xServer.start (err => {
  if (err) {
    xLog.err (err);
    return;
  }

  const busClient = require ('xcraft-core-busclient').getGlobal ();
  busClient.connect (busClient.getToken (), err => {
    if (err) {
      xLog.error (err);
      return;
    }

    const etcRoot = path.join (appConfigPath, 'etc');
    const xConfig = require ('xcraft-core-etc') (etcRoot).load (moduleName);

    /* Start the main quest (app bootstrap). */
    busClient.command.send (xConfig.mainQuest);
  });
});

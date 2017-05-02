'use strict';

const moduleName = 'xcraft-core-host';

const path = require ('path');
const xLog = require ('xcraft-core-log') (moduleName);

let xServer;
let appConfigPath;

if (process.versions.electron) {
  const config = require ('./index.js');
  appConfigPath = config.appConfigPath;

  xLog.info (
    `electron runtime detected,\nconfig path: ${config.appConfigPath}\nproject path: ${config.projectPath}`
  );

  xServer = require ('xcraft-server') (
    config.appConfigPath,
    config.projectPath
  );
} else {
  // FIXME
  xServer = require ('xcraft-server') ();
}

xServer.start ();

// FIXME: it's buggy because it must be done only when the server is ready
// otherwise is abuses of the reconnect stuff.

// const xBus = require ('xcraft-core-bus');
// const xBusClient = require ('xcraft-core-busclient');
// const busClient = new xBusClient.BusClient ();
// busClient.connect (xBus.getToken (), err => {
//   if (err) {
//     xLog.error (err);
//     return;
//   }
//   const etcRoot = path.join (appConfigPath, 'etc');
//   const xConfig = require ('xcraft-core-etc') (etcRoot).load (moduleName);
//
//   /* Start the main quest (app bootstrap). */
//   busClient.command.send (xConfig.mainQuest, null, null, () => {
//     busClient.stop (() => {});
//   });
// });

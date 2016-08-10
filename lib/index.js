'use strict';

const moduleName = 'xcraft-core-host';

const path = require ('path');
const xLog = require ('xcraft-core-log') (moduleName);

let xServer;
let appConfigPath;
let projectPath;

if (process.versions.electron) {
  const {app} = require ('electron');
  appConfigPath = path.join (app.getPath ('appData'), app.getName ());
  // FIXME
  projectPath = path.join (__dirname, '../../../');
  xLog.info (`electron runtime detected,
              config path: ${appConfigPath}
              project path: ${projectPath}`);


  xServer = require ('xcraft-server') (appConfigPath, projectPath);
} else {
  // FIXME
  xServer = require ('xcraft-server') ();
}

xServer.start ();

const busClient = require ('xcraft-core-busclient').initGlobal ();
busClient.connect (null, err => {
  if (err) {
    xLog.error (err);
    return;
  }
  const etcRoot = path.join (appConfigPath, 'etc');
  const xConfig = require ('xcraft-core-etc') (etcRoot).load (moduleName);

  /* Start the main quest (app bootstrap). */
  busClient.command.send (xConfig.mainQuest);
});

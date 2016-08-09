'use strict';
const moduleName = 'xcraft-core-host';
const path = require ('path');
const xLog = require ('xcraft-core-log') (moduleName);

let xServer;
if (process.versions.electron) {
  const {app} = require ('electron');
  const appConfigPath = path.join (app.getPath ('appData'), app.getName ());
  //FIXME
  const projectPath = path.join (__dirname, '../../../');
  xLog.info (`electron runtime detected,
              config path: ${appConfigPath}
              project path: ${projectPath}`);
  xServer = require ('xcraft-server') (appConfigPath, projectPath);
} else {
  //FIXME
  xServer = require ('xcraft-server') ();
}

xServer.start ((err) => {
  if (err) {
    xLog.err (err);
  }
});

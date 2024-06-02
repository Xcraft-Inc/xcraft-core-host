'use strict';

const fse = require('fs-extra');
const path = require('path');
const {loadInitialConfig, importRealmFile} = require('./helpers.js');
const applyOverrides = require('./applyOverrides.js');
const moduleName = 'xcraft-core-host';
const xLog = require('xcraft-core-log')(moduleName);

module.exports = async (appArg, isElectron) => {
  //FIXME: UGLY RELATIVE JOIN
  const projectPath = path.join(__dirname, '../../../');
  const initialConfig = loadInitialConfig(projectPath);
  const config = applyOverrides(projectPath, initialConfig);
  const {useRealms, realmsStorePath} = config;

  if (!isElectron || !useRealms) {
    return config;
  }

  xLog.dbg(`using realms with storage at: ${realmsStorePath}`);
  let files = null;
  try {
    files = fse.readdirSync(realmsStorePath);
  } catch (err) {
    //
  }

  if (!files) {
    const {app, dialog} = require('electron');
    await app.whenReady();
    xLog.dbg(`asking user for realm key import`);
    const {canceled, filePaths} = await dialog.showOpenDialog({
      title: 'Select a realm file to import',
      defaultPath: app.getPath('home'),
      buttonLabel: 'import',
      filters: [{name: 'Ork Realm File (.ork)', extensions: ['ork']}],
      properties: ['openFile', 'multiSelections', 'dontAddToRecent'],
    });
    if (canceled) {
      xLog.dbg(`user canceled import`);
      app.exit(0);
      return null;
    }
    for (const filePath of filePaths) {
      importRealmFile(filePath, realmsStorePath);
    }
    try {
      files = fse.readdirSync(realmsStorePath);
    } catch (err) {
      //
    }
  }

  files = files.filter((f) => path.extname(f) === '.ork');
  if (!files) {
    throw new Error('Error during import of ork files');
  }
  xLog.dbg(`found ${files.length} realm(s) files`);
  config.realmFiles = files;

  return config;
};

'use strict';

const fse = require('fs-extra');
const path = require('path');
const xUtils = require('xcraft-core-utils');
const moduleName = 'xcraft-core-host';
const xLog = require('xcraft-core-log')(moduleName);

function loadInitialConfig(projectPath) {
  const configFiles = ['goblins.json', 'westeros.json'].map((fileName) =>
    path.join(projectPath, fileName)
  );
  let error;
  for (const configFile of configFiles) {
    try {
      return fse.readJSONSync(configFile);
    } catch (ex) {
      error = ex;
    }
  }

  if (error) {
    throw error;
  }
}

function importRealmFile(filePath, storePath) {
  const fileName = path.basename(filePath);
  const destPath = path.join(storePath, fileName);
  fse.mkdirpSync(storePath);
  fse.copyFileSync(filePath, destPath);
}

module.exports = async (appArg, isElectron) => {
  const projectPath = path.join(__dirname, '../../../'); //FIX ME: ugly ;)
  const initialConfig = loadInitialConfig(projectPath);
  const fullAppId = initialConfig.appId;
  const {appCompany, appDate, useRealms} = initialConfig;

  const appData =
    process.env.XCRAFT_APP_CONFIG_PATH ||
    initialConfig.appConfigPath ||
    xUtils.os.getAppData();

  const realmsStorePath = path.join(appData, appCompany, 'xcraft-realms');
  if (useRealms) {
    xLog.dbg(`using realms with storage at: ${realmsStorePath}`);
    let files = null;
    try {
      files = fse.readdirSync(realmsStorePath);
    } catch (err) {
      //
    }

    if (!files) {
      if (!isElectron) {
        throw new Error('Not impl.');
        //TODO: handle file args realm key registration
      }
      const {app, dialog} = require('electron');
      await app.whenReady();
      xLog.dbg(`asking user for realm key import`);
      const {canceled, filePaths} = await dialog.showOpenDialog({
        title: 'Select a realm file to import',
        defaultPath: app.getPath('home'),
        buttonLabel: 'import',
        filters: [{name: 'Ork Realm File', extensions: ['ork']}],
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
  }

  const [appId, variantId] = (
    process.env.GOBLINS_APP ??
    process.env.WESTEROS_APP ??
    initialConfig.appId
  ).split('@');

  /* The masterAppId makes sens is case of hordes like Thrall servers */
  const [masterAppId] = (
    process.env.GOBLINS_APP_MASTER ??
    process.env.GOBLINS_APP ??
    process.env.WESTEROS_APP ??
    initialConfig.appId
  ).split('@');

  return {
    projectPath,
    fullAppId,
    appCompany,
    appDate,
    appId,
    variantId,
    masterAppId,
    appData,
    useRealms,
    realmsStorePath,
  };
};

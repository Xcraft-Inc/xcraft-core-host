'use strict';

const fs = require('fs');
const path = require('path');
const xUtils = require('xcraft-core-utils');

function loadInitialConfig(projectPath) {
  const configFiles = ['goblins.json', 'westeros.json'].map((fileName) =>
    path.join(projectPath, fileName)
  );
  let error;
  for (const configFile of configFiles) {
    try {
      return JSON.parse(fs.readFileSync(configFile.toString()));
    } catch (ex) {
      error = ex;
    }
  }

  if (error) {
    throw error;
  }
}

module.exports = (isElectron) => {
  const projectPath = path.join(__dirname, '../../../'); //FIX ME: ugly ;)
  const initialConfig = loadInitialConfig(projectPath);
  const fullAppId = initialConfig.appId;
  const {appCompany, appDate, useRealms} = initialConfig;

  const appData =
    process.env.XCRAFT_APP_CONFIG_PATH ||
    initialConfig.appConfigPath ||
    xUtils.os.getAppData();

  const realmsStorePath = path.join(appData, appCompany, 'xcraft-realms');

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

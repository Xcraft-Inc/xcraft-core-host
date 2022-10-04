'use strict';

const fs = require('fs');
const path = require('path');
const xUtils = require('xcraft-core-utils');

const config = {
  appConfigPath: null,
  projectPath: path.join(__dirname, '../../../'), // FIXME
};

function loadInitialConfig() {
  const configFiles = ['goblins.json', 'westeros.json'].map((fileName) =>
    path.join(config.projectPath, fileName)
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

const initialConfig = loadInitialConfig();
const appData = initialConfig.appConfigPath || xUtils.os.getAppData();

const {appCompany, appId: _appId, appDate} = initialConfig;

const [appId, variantId] = (
  process.env.GOBLINS_APP ??
  process.env.WESTEROS_APP ??
  _appId
).split('@');
config.appArgs = require('./args-parsing.js');
config.appId = appId;
config.appCompany = appCompany;
config.appDate = appDate;
config.variantId = variantId;
config.appData = appData;
config.appConfigPath = path.join(
  appData,
  appCompany,
  variantId ? `${appId}-${variantId}` : appId
);

config.getRoutingKey = () => {
  const {tribe} = config.appArgs();
  return tribe ? `${appId}-${tribe}` : appId;
};

config.getTribeFromId = (id) => {
  if (id.indexOf('@') === -1) {
    return 0;
  }

  const totalTribes = config.appArgs()['total-tribes'];
  const tokens = id.split('@');
  return totalTribes > 1
    ? (tokens[tokens.length - 1].charCodeAt(0) % (totalTribes - 1)) + 1
    : 1;
};

/* The masterAppId makes sens is case of hordes like Thrall servers */
const [masterAppId] = (
  process.env.GOBLINS_APP_MASTER ??
  process.env.GOBLINS_APP ??
  process.env.WESTEROS_APP ??
  _appId
).split('@');

config.appMasterId = masterAppId;

const resPath = path.resolve(
  config.projectPath,
  'app',
  masterAppId,
  'resources'
);
config.resourcesPath = fs.existsSync(resPath)
  ? resPath
  : path.resolve(process.resourcesPath || config.projectPath);

const packageDef = JSON.parse(
  fs.readFileSync(path.join(config.projectPath, 'package.json')).toString()
);

/* FIXME: use the real app version (main goblin version) */
config.appVersion = `${packageDef.version}${
  initialConfig.appCommit ? `-${initialConfig.appCommit}` : ''
}`;

config.appEnv = initialConfig.appEnv;
if (process.env.XCRAFT_APPENV) {
  config.appEnv = process.env.XCRAFT_APPENV;
} else {
  process.env.XCRAFT_APPENV = config.appEnv;
}

module.exports = config;

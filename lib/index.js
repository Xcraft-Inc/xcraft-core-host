'use strict';

const fs = require('fs');
const path = require('path');
const xUtils = require('xcraft-core-utils');

const config = {
  appConfigPath: null,
  projectPath: path.join(__dirname, '../../../'), // FIXME
};

const initialConfig = JSON.parse(
  fs.readFileSync(path.join(config.projectPath, 'westeros.json')).toString()
);

const appData = initialConfig.appConfigPath || xUtils.os.getAppData();

const {appCompany, appId: _appId} = initialConfig;

const [appId, variantId] = (process.env.WESTEROS_APP || _appId).split('@');
config.appArgs = require('./args-parsing.js');
config.appId = appId;
config.appCompany = appCompany;
config.variantId = variantId;
config.appData = appData;
config.appConfigPath = path.join(
  appData,
  appCompany,
  variantId ? `${appId}-${variantId}` : appId
);

/* The masterAppId makes sens is case of hordes like Thrall servers */
const [masterAppId] = (
  process.env.WESTEROS_APP_MASTER ||
  process.env.WESTEROS_APP ||
  _appId
).split('@');

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

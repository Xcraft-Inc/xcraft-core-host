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

const {appCompany, appId} = initialConfig;

config.appId = process.env.WESTEROS_APP || appId;
config.appConfigPath = path.join(
  appData,
  appCompany,
  process.env.WESTEROS_APP || appId
);

config.appEnv = initialConfig.appEnv;
if (process.env.XCRAFT_APPENV) {
  config.appEnv = process.env.XCRAFT_APPENV;
} else {
  process.env.XCRAFT_APPENV = config.appEnv;
}

module.exports = config;

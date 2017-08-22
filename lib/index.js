'use strict';

const os = require ('os');
const fs = require ('fs');
const path = require ('path');

const config = {
  appConfigPath: null,
  projectPath: path.join (__dirname, '../../../'), // FIXME
};

const initialConfig = JSON.parse (
  fs.readFileSync (path.join (config.projectPath, 'westeros.json')).toString ()
);

const appData =
  (process.platform === 'win32' && process.env.APPDATA) ||
  (process.platform === 'darwin'
    ? path.join (os.homedir (), 'Library/Application Support')
    : path.join (os.homedir (), '.local/share'));

const {appCompany, appId} = initialConfig;
config.appConfigPath = path.join (
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

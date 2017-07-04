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
const {appCompany, appId} = initialConfig;

if (process.versions.electron) {
  const {app} = require ('electron');
  const appData = app.getPath ('appData');
  config.appConfigPath = path.join (appData, appCompany, appId);
} else {
  const appData =
    process.env.APPDATA ||
    (process.platform === 'darwin'
      ? path.join (os.homedir (), 'Library/Preferences')
      : path.join (os.homedir (), '.config'));
  config.appConfigPath = path.join (appData, appCompany, appId);
}

module.exports = config;

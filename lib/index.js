'use strict';

const os = require ('os');
const path = require ('path');

const config = {
  appConfigPath: null,
  projectPath: null,
};

const appName = process.env.XCRAFT_APPNAME || 'xcraft';

if (process.versions.electron) {
  const {app} = require ('electron');
  config.appConfigPath = path.join (app.getPath ('appData'), appName);
} else {
  const appData =
    process.env.APPDATA ||
    (process.platform === 'darwin'
      ? path.join (os.homedir (), 'Library/Preferences')
      : path.join (os.homedir (), '.config'));
  config.appConfigPath = path.join (appData, appName);
}

config.projectPath = path.join (__dirname, '../../../'); // FIXME

module.exports = config;

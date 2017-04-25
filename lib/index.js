'use strict';

const path = require ('path');

const config = {
  appConfigPath: null,
  projectPath: null,
};

if (process.versions.electron) {
  const {app} = require ('electron');
  config.appConfigPath = path.join (app.getPath ('appData'), app.getName ());
} else if (process.env.XCRAFT_APPNAME) {
  const appData =
    process.env.APPDATA ||
    (process.platform === 'darwin'
      ? process.env.HOME + 'Library/Preferences'
      : '/var/local');
  config.appConfigPath = path.join (appData, process.env.XCRAFT_APPNAME);
}

config.projectPath = path.join (__dirname, '../../../'); // FIXME

module.exports = config;

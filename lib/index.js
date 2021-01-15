'use strict';

const fs = require('fs');
const path = require('path');
const xUtils = require('xcraft-core-utils');
const yargs = require('yargs').parserConfiguration({
  'camel-case-expansion': false,
});
const {hideBin} = require('yargs/helpers');

const config = {
  appConfigPath: null,
  projectPath: path.join(__dirname, '../../../'), // FIXME
};

let appArgs = process.argv;

const electronArgs = [
  '--allow-file-access-from-files',
  '--original-process-start-time',
  '--no-sandbox',
  '--inspect',
  '--inspect-brk',
  '--remote-debugging-port',
];

// Remove args destinated to Electron
appArgs = appArgs.filter(
  (arg) => !electronArgs.some((electronArg) => arg.startsWith(electronArg))
);

appArgs = yargs.parse(hideBin(appArgs));

// named args are stored by their name and unamed args into "_" key.
// For example: node ./cli -l=fr_CH test_potato
// appArgs = { "_": ["test_potato"], "l": "fr_CH"};

const envOverridable = {
  WESTEROS_APP: true,
  WESTEROS_DEVTOOLS: true,
  XCRAFT_ROOT: true,
  XCRAFT_DEBUG: true,
  XCRAFT_PROBE: true,
  XCRAFT_LOG: true,
  XCRAFT_LOGS: true,
  XCRAFT_LOG_MODS: true,
};

// Override of ENV variable if namedAppArgs match
const {_: unamedAppArgs, ...namedAppArgs} = appArgs;
for (const argName of Object.keys(namedAppArgs)) {
  const parsedArgName = argName.toUpperCase().replace('-', '_');
  if (envOverridable[parsedArgName]) {
    process.env[parsedArgName] = namedAppArgs[argName];
  }
}

const initialConfig = JSON.parse(
  fs.readFileSync(path.join(config.projectPath, 'westeros.json')).toString()
);

const appData = initialConfig.appConfigPath || xUtils.os.getAppData();

const {appCompany, appId: _appId} = initialConfig;

const [appId, variantId] = (process.env.WESTEROS_APP || _appId).split('@');
config.appArgs = appArgs;
config.appId = appId;
config.appCompany = appCompany;
config.variantId = variantId;
config.appData = appData;
config.appConfigPath = path.join(
  appData,
  appCompany,
  variantId ? `${appId}-${variantId}` : appId
);

const resPath = path.resolve(config.projectPath, 'app', appId, 'resources');
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

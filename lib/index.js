'use strict';

const applyOverrides = require('./applyOverrides.js');
const configBuilder = require('./configBuilder.js');

let xHostConfig;
if (globalThis.xHostConfig) {
  xHostConfig = globalThis.xHostConfig;
} else {
  const moduleName = 'xcraft-core-host';
  const xLog = require('xcraft-core-log')(moduleName);
  xLog.warn('Using minimal xcraft-core-host config!!!');
  const {loadInitialConfig} = require('./helpers.js');
  const path = require('path');
  //FIXME: UGLY RELATIVE JOIN
  const projectPath = path.join(__dirname, '../../../');
  const initialConfig = loadInitialConfig(projectPath);
  const preConfig = applyOverrides(projectPath, initialConfig);
  xHostConfig = configBuilder(preConfig);
}

module.exports = xHostConfig;

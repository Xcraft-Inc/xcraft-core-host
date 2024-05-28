let xHostConfig;
if (globalThis.xHostConfig) {
  xHostConfig = globalThis.xHostConfig;
} else {
  const moduleName = 'xcraft-core-host';
  const xLog = require('xcraft-core-log')(moduleName);
  xLog.warn('Using minimal xcraft-core-host config!!!');
  const {loadInitialConfig} = require('./helpers.js');
  const path = require('path');
  const xUtils = require('xcraft-core-utils');

  //FIX ME: UGLY RELATIVE JOIN
  const projectPath = path.join(__dirname, '../../../');
  const initialConfig = loadInitialConfig(projectPath);
  const {appCompany} = initialConfig;
  const appData =
    process.env.XCRAFT_APP_CONFIG_PATH ||
    initialConfig.appConfigPath ||
    xUtils.os.getAppData();

  const [appId, variantId] = (
    process.env.GOBLINS_APP ??
    process.env.WESTEROS_APP ??
    initialConfig.appId
  ).split('@');

  const appConfigPath = path.join(
    appData,
    appCompany,
    variantId ? `${appId}-${variantId}` : appId
  );
  xHostConfig = {projectPath, appConfigPath};
}

module.exports = xHostConfig;

const path = require('path');
const xUtils = require('xcraft-core-utils');
module.exports = (projectPath, initialConfig) => {
  const appData =
    process.env.XCRAFT_APP_CONFIG_PATH ||
    initialConfig.appConfigPath ||
    xUtils.os.getAppData();

  const realmsStorePath = path.join(appData, appCompany, 'xcraft-realms');
  const fullAppId = initialConfig.appId;
  const {appCompany, appDate, useRealms} = initialConfig;
  const [appId, variantId] = (
    process.env.GOBLINS_APP ??
    process.env.WESTEROS_APP ??
    initialConfig.appId
  ).split('@');

  /* The masterAppId makes sens is case of hordes like Thrall servers */
  const [masterAppId] = (
    process.env.GOBLINS_APP_MASTER ??
    process.env.GOBLINS_APP ??
    process.env.WESTEROS_APP ??
    initialConfig.appId
  ).split('@');

  return {
    projectPath,
    fullAppId,
    appCompany,
    appDate,
    appId,
    variantId,
    masterAppId,
    appData,
    useRealms,
    realmsStorePath,
  };
};

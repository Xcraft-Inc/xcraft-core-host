'use strict';

const path = require('node:path');
const xUtils = require('xcraft-core-utils');

const isProd = process.env.NODE_ENV !== 'development';

module.exports = (projectPath, initialConfig) => {
  const appData =
    process.env.XCRAFT_APP_CONFIG_PATH ||
    initialConfig.appConfigPath ||
    xUtils.os.getAppData();

  const fullAppId = initialConfig.appId;
  const {appCompany, appDate, useRealms, splashWindowOptions} = initialConfig;

  const [appId, variantId] = (
    process.env.GOBLINS_APP ??
    process.env.WESTEROS_APP ??
    fullAppId
  ).split('@');

  /* The masterAppId makes sense in case of hordes like Thrall servers */
  const [masterAppId] = (
    process.env.GOBLINS_APP_MASTER ??
    process.env.GOBLINS_APP ??
    process.env.WESTEROS_APP ??
    fullAppId
  ).split('@');

  const realmsStorePath = path.join(
    appData,
    appCompany,
    isProd ? 'xcraft-realms' : 'xcraft-realms-dev',
    appId
  );

  return {
    projectPath,
    appCompany,
    appDate,
    appId,
    variantId,
    masterAppId,
    appData,
    useRealms,
    realmsStorePath,
    realmFiles: [],
    splashWindowOptions,
  };
};

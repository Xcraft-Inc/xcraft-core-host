'use strict';

const path = require('path');
const xUtils = require('xcraft-core-utils');

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
    'xcraft-realms',
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
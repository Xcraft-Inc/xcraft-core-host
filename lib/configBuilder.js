'use strict';

const fs = require('fs');
const path = require('path');

module.exports = (initialConfig) => {
  const {
    appData,
    appCompany,
    appId,
    variantId,
    masterAppId,
    appDate,
    projectPath,
    useRealms,
    realmFiles,
    realmsStorePath,
  } = initialConfig;

  const config = {
    appConfigPath: null,
    projectPath,
  };

  config.appArgs = require('./args-parsing.js');
  config.appId = appId;
  config.appCompany = appCompany;
  config.appDate = appDate;
  config.variantId = variantId;
  config.appData = appData;
  config.appConfigPath = path.join(
    appData,
    appCompany,
    variantId ? `${appId}-${variantId}` : appId
  );

  config.useRealms = useRealms;
  config.realmFiles = realmFiles;
  config.realmsStorePath = realmsStorePath;

  config.getRoutingKey = () => {
    const {tribe} = config.appArgs();
    return tribe ? `${appId}-${tribe}` : appId;
  };

  config.getTribeFromId = (id, totalTribes = null) => {
    if (id.indexOf('@') === -1) {
      return 0;
    }

    totalTribes = totalTribes || config.appArgs()['total-tribes'];
    const tokens = id.split('@');
    if (totalTribes <= 1) {
      return 1;
    }

    let acc;
    const lastToken = tokens[tokens.length - 1];

    switch (lastToken.length) {
      case 0:
        return 0;
      case 1:
        acc = lastToken.charCodeAt(0);
        break;
      case 2:
        acc = lastToken.charCodeAt(0) + lastToken.charCodeAt(1);
        break;
      default:
        acc =
          lastToken.charCodeAt(0) +
          lastToken.charCodeAt(lastToken.length / 2) +
          lastToken.charCodeAt(lastToken.length - 1);
        break;
    }

    return (acc % (totalTribes - 1)) + 1;
  };

  config.appMasterId = masterAppId;

  const resPath = path.resolve(
    config.projectPath,
    'app',
    masterAppId,
    'resources'
  );
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
  return config;
};

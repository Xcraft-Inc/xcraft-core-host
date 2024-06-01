'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
    splashWindowOptions,
  } = initialConfig;

  const appArgs = require('./args-parsing.js');
  const resPath = path.resolve(projectPath, 'app', masterAppId, 'resources');
  const packageDef = JSON.parse(
    fs.readFileSync(path.join(projectPath, 'package.json')).toString()
  );

  const config = {
    projectPath,
    appArgs,
    appId,
    variantId,
    appMasterId: masterAppId,
    appCompany,
    appDate,
    /* FIXME: use the real app version (main goblin version) */
    appVersion: `${packageDef.version}${
      initialConfig.appCommit ? `-${initialConfig.appCommit}` : ''
    }`,
    appData,
    appConfigPath: path.join(
      appData,
      appCompany,
      variantId ? `${appId}-${variantId}` : appId
    ),
    useRealms,
    splashWindowOptions,
    realmFiles,
    realmsStorePath,
    resourcesPath: fs.existsSync(resPath)
      ? resPath
      : path.resolve(process.resourcesPath || projectPath),
  };

  if (config.useRealms) {
    config.leaveRealm = () => {
      const {topology} = require('xcraft-core-etc')().load('xcraft-core-horde');
      for (const [server, {gatekeeper}] of Object.entries(topology)) {
        if (!gatekeeper) {
          continue;
        }
        const keyPath = path.join(
          config.realmsStorePath,
          `${server}@${config.variantId}-key.pem`
        );
        const certPath = path.join(
          config.realmsStorePath,
          `${server}@${config.variantId}-cert.pem`
        );

        const fse = require('fs-extra');
        fse.unlinkSync(keyPath);
        fse.unlinkSync(certPath);
      }
    };
  }

  config.getRoutingKey = () => {
    const {tribe} = appArgs();
    return tribe ? `${appId}-${tribe}` : appId;
  };

  config.getTribeFromId = (id, totalTribes = null) => {
    if (id.indexOf('@') === -1) {
      return 0;
    }

    totalTribes = totalTribes || appArgs()['total-tribes'];
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

  config.appEnv = initialConfig.appEnv;
  if (process.env.XCRAFT_APPENV) {
    config.appEnv = process.env.XCRAFT_APPENV;
  } else {
    process.env.XCRAFT_APPENV = config.appEnv;
  }

  return config;
};

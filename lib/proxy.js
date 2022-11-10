'use strict';

const watt = require('gigawatts');

function getInternetSettingsKeys(registry) {
  return [
    {
      hive: registry.HKEY_CURRENT_USER,
      keyName:
        'Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
    },
    {
      hive: registry.HKEY_LOCAL_MACHINE,
      keyName:
        'Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
    },
  ];
}

function tryInitializeNetworkStackFromEnvironment(xLog) {
  try {
    const {HTTP_PROXY, HTTPS_PROXY, NO_PROXY} = process.env;
    if (HTTP_PROXY || HTTPS_PROXY) {
      process.env['GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE'] = ''; // this will erase the namespace for setting global-agent library env variables
      process.env['NO_PROXY'] = `127.0.0.1,localhost${
        NO_PROXY ? `,${NO_PROXY}` : ''
      }`; // avoid proxy for loopback communication

      if (HTTP_PROXY && !HTTP_PROXY.startsWith('http://')) {
        process.env['HTTP_PROXY'] = `http://${HTTP_PROXY}`;
      }
      if (HTTPS_PROXY && !HTTPS_PROXY.startsWith('https://')) {
        process.env['HTTPS_PROXY'] = `https://${HTTPS_PROXY}`;
      }

      return true;
    }
  } catch (err) {
    xLog.warn(
      `cannot initialize network stack for proxy from environment: ${
        err.message || err
      }`
    );
  }

  return false;
}

const tryInitializeNetworkStackFromInternetSettings = watt(function* (
  xLog,
  next
) {
  try {
    const os = require('os');
    if (os.platform() === 'win32') {
      const registry = require('node-windows-registry');

      for (let key of getInternetSettingsKeys(registry)) {
        try {
          const internetSettingsKey = yield registry.openKey(
            key.keyName,
            {
              hive: key.hive,
              view: registry.x64,
            },
            next
          );

          let proxyEnabled = false;
          let proxyServer = '';

          try {
            proxyEnabled = yield internetSettingsKey.getValue(
              'ProxyEnable',
              next
            );
          } catch (err3) {
            internetSettingsKey.dispose();
            if (registry.isNotFoundError(err3)) {
              continue;
            } else {
              throw err3;
            }
          }

          if (proxyEnabled === 1) {
            try {
              proxyServer = yield internetSettingsKey.getValue(
                'ProxyServer',
                next
              );
              if (proxyServer) {
                process.env['GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE'] = ''; // this will erase the namespace for setting global-agent library env variables
                process.env['NO_PROXY'] = '127.0.0.1,localhost'; // avoid proxy for loopback communication

                if (proxyServer.startsWith('http://')) {
                  process.env['HTTP_PROXY'] = proxyServer;
                  process.env['HTTPS_PROXY'] = proxyServer.replace(
                    /http:\/\//g,
                    'https://'
                  );
                } else if (proxyServer.startsWith('https://')) {
                  process.env['HTTP_PROXY'] = proxyServer.replace(
                    /https:\/\//g,
                    'http://'
                  );
                  process.env['HTTPS_PROXY'] = proxyServer;
                } else {
                  process.env['HTTP_PROXY'] = `http://${proxyServer}`;
                  process.env['HTTPS_PROXY'] = `https://${proxyServer}`;
                }

                internetSettingsKey.dispose();
                return true;
              }
            } catch (err3) {
              internetSettingsKey.dispose();
              if (registry.isNotFoundError(err3)) {
                continue;
              } else {
                throw err3;
              }
            }
          } else {
            internetSettingsKey.dispose();
          }
        } catch (err2) {
          if (registry.isNotFoundError(err2)) {
            continue;
          } else {
            throw err2;
          }
        }
      }
    }
  } catch (err) {
    xLog.warn(
      `cannot initialize network stack for proxy from internet settings: ${
        err.message || err
      }`
    );
  }

  return false;
});

const tryInitializeNetworkStackFromPacFile = watt(function* (xLog, next) {
  try {
    const os = require('os');
    if (os.platform() === 'win32') {
      const registry = require('node-windows-registry');

      for (let key of getInternetSettingsKeys(registry)) {
        try {
          const internetSettingsKey = yield registry.openKey(
            key.keyName,
            {
              hive: key.hive,
              view: registry.x64,
            },
            next
          );

          let autoConfigURL = '';

          try {
            autoConfigURL = yield internetSettingsKey.getValue(
              'AutoConfigURL',
              next
            );
          } catch (err3) {
            internetSettingsKey.dispose();
            if (registry.isNotFoundError(err3)) {
              continue;
            } else {
              throw err3;
            }
          }

          if (autoConfigURL) {
            // TODO: support
            // add env variable so that above layers can maybe show a message about
            process.env['PROXY_AUTOCONFIG_URL'] = autoConfigURL;
            xLog.warn(
              `proxy autoconfig file at path ${autoConfigURL} has been detected but is currently unsupported`
            );
          }
          internetSettingsKey.dispose();
          return false;
        } catch (err2) {
          if (registry.isNotFoundError(err2)) {
            continue;
          } else {
            throw err2;
          }
        }
      }
    }
  } catch (err) {
    xLog.warn(
      `cannot initialize network stack for proxy from pac file: ${
        err.message || err
      }`
    );
  }

  return false;
});

const initializeNetworkStackForProxy = watt(function* (xLog, next) {
  try {
    if (
      tryInitializeNetworkStackFromEnvironment(xLog) ||
      (yield tryInitializeNetworkStackFromInternetSettings(xLog, next)) ||
      (yield tryInitializeNetworkStackFromPacFile(xLog, next))
    ) {
      const {bootstrap} = require('epsitec-global-agent');
      bootstrap();
    }
  } catch (err) {
    xLog.warn(
      `cannot initialize network stack for proxy: ${err.message || err}`
    );
  }
});

module.exports = {
  initializeNetworkStackForProxy,
};

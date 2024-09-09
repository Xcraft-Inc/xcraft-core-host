'use strict';

class HttpProxy {
  #log;

  constructor() {
    const watt = require('gigawatts');

    this.#log = require('xcraft-core-log')('http-proxy');
    watt.wrapAll(this);
  }

  _getInternetSettingsKeys(registry) {
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

  _shouldFilterProxyUrl(url) {
    const invalidProxies = [
      {url: 'http://http=localhost', port: '*'},
      {url: 'http=localhost', port: '*'},
    ];

    for (const proxy of invalidProxies) {
      if (proxy.port === '*') {
        // any port
        if (url.startsWith(proxy.url)) {
          return true;
        }
      } else {
        // specific port
        const invalidUrl = `${proxy.url}:${proxy.port}`;
        if (url === invalidUrl) {
          return true;
        }
      }
    }

    return false;
  }

  _tryInitFromEnv() {
    try {
      const {HTTP_PROXY, HTTPS_PROXY, NO_PROXY} = process.env;
      if (!HTTP_PROXY && !HTTPS_PROXY) {
        return false;
      }

      // this will erase the namespace for setting global-agent library env variables
      process.env['GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE'] = '';
      // avoid proxy for loopback communication
      process.env['NO_PROXY'] = `127.0.0.1,localhost${
        NO_PROXY ? `,${NO_PROXY}` : ''
      }`;

      if (HTTP_PROXY && !HTTP_PROXY.startsWith('http://')) {
        process.env['HTTP_PROXY'] = `http://${HTTP_PROXY}`;
      }
      if (HTTPS_PROXY && !HTTPS_PROXY.startsWith('https://')) {
        process.env['HTTPS_PROXY'] = `https://${HTTPS_PROXY}`;
      }
      return true;
    } catch (ex) {
      this.#log.warn(
        `cannot initialize network stack for proxy from environment: ${
          ex.stack || ex.message || ex
        }`
      );
    }

    return false;
  }

  *_getRegistryProxyServer(registry, key, next) {
    const internetSettingsKey = yield registry.openKey(
      key.keyName,
      {hive: key.hive, view: registry.x64},
      next
    );

    try {
      const proxyEnabled = yield internetSettingsKey.getValue(
        'ProxyEnable',
        next
      );
      if (proxyEnabled !== 1) {
        return false;
      }

      const proxyServer = yield internetSettingsKey.getValue(
        'ProxyServer',
        next
      );
      if (!proxyServer || this._shouldFilterProxyUrl(proxyServer)) {
        return false;
      }
      return proxyServer;
    } catch (ex) {
      if (registry.isNotFoundError(ex)) {
        return false;
      }
      throw ex;
    } finally {
      internetSettingsKey.dispose();
    }
  }

  *_tryInitFromInternetSettingsWindows() {
    const registry = require('node-windows-registry');

    for (const key of this._getInternetSettingsKeys(registry)) {
      const proxyServer = yield this._getRegistryProxyServer(registry, key);
      if (!proxyServer) {
        continue;
      }

      // this will erase the namespace for setting global-agent library env variables
      process.env['GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE'] = '';
      // avoid proxy for loopback communication
      process.env['NO_PROXY'] = '127.0.0.1,localhost';

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
      return true;
    }

    return false;
  }

  *_tryInitFromInternetSettings() {
    try {
      if (process.platform === 'win32') {
        return yield this._tryInitFromInternetSettingsWindows();
      }
    } catch (ex) {
      this.#log.warn(
        `cannot initialize network stack for proxy from internet settings: ${
          ex.stack || ex.message || ex
        }`
      );
    }

    return false;
  }

  *_getRegistryAutoConfigURL(registry, key, next) {
    const internetSettingsKey = yield registry.openKey(
      key.keyName,
      {hive: key.hive, view: registry.x64},
      next
    );

    try {
      return yield internetSettingsKey.getValue('AutoConfigURL', next);
    } catch (ex) {
      if (registry.isNotFoundError(ex)) {
        return false;
      }
      throw ex;
    } finally {
      internetSettingsKey.dispose();
    }
  }

  // FIXME: this function returns always false
  *_tryInitializeFromPacFileWindows() {
    const registry = require('node-windows-registry');

    for (const key of this._getInternetSettingsKeys(registry)) {
      const autoConfigURL = yield this._getRegistryAutoConfigURL(registry, key);
      if (autoConfigURL === false) {
        continue;
      }

      if (autoConfigURL) {
        // TODO: support
        // add env variable so that above layers can maybe show a message about
        process.env['PROXY_AUTOCONFIG_URL'] = autoConfigURL;
        this.#log.warn(
          `proxy autoconfig file at path ${autoConfigURL} has been detected but is currently unsupported`
        );
      }
      return false;
    }

    return false;
  }

  *_tryInitFromPacFile() {
    try {
      if (process.platform === 'win32') {
        return yield this._tryInitializeFromPacFileWindows();
      }
    } catch (ex) {
      this.#log.warn(
        `cannot initialize network stack for proxy from pac file: ${
          ex.stack || ex.message || ex
        }`
      );
    }

    return false;
  }

  *initNetworkStack() {
    try {
      if (
        this._tryInitFromEnv() ||
        (yield this._tryInitFromInternetSettings()) ||
        (yield this._tryInitFromPacFile()) // FIXME: PAC file not supported
      ) {
        const {bootstrap} = require('epsitec-global-agent');
        bootstrap();
      }
    } catch (ex) {
      this.#log.warn(
        `cannot initialize network stack for proxy: ${
          ex.stack || ex.message || ex
        }`
      );
    }
  }
}

module.exports = new HttpProxy();

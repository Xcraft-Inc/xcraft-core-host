const electron = require('electron');
const MsgBox = require('./msgbox.js');

class Neutron {
  #WM = require('./wm.js');
  #disposers = [];

  // NEW API
  async appOnSecondInstance(cb) {
    electron.app.on('second-instance', async (...args) => {
      await cb(...args);
    });
  }

  // NEW API
  async appOnWindowAllClosed(cb) {
    electron.app.on('window-all-closed', async (...args) => {
      await cb(...args);
    });
  }

  // NEW API
  async appOnOpenFile(cb) {
    electron.app.on('open-file', async (...args) => {
      await cb(...args);
    });
  }

  // NEW API
  async appOnOpenUrl(cb) {
    electron.app.on('open-url', async (...args) => {
      await cb(...args);
    });
  }

  // NEW API
  async appRequestSingleInstanceLock(additionalData) {
    return electron.app.requestSingleInstanceLock(additionalData);
  }

  // NEW API
  async appGetName() {
    return electron.app.getName();
  }

  // NEW API
  async appSetDesktopName(desktopName) {
    electron.app?.setDesktopName(desktopName);
  }

  // NEW API
  async appWhenReady() {
    return await electron.app.whenReady();
  }

  // NEW API
  async appExit(exitCode) {
    electron.app.exit(exitCode);
  }

  // NEW API
  async appQuit() {
    electron.app.quit();
  }

  // NEW API
  async appGetGPUFeatureStatus() {
    return electron.app.getGPUFeatureStatus();
  }

  // NEW API
  async appGetGPUInfo(infoType) {
    return await electron.app.getGPUInfo(infoType);
  }

  // NEW API
  async appGetAppMetrics() {
    return electron.app.getAppMetrics();
  }

  // NEW API
  // FIXME: must be async
  appSetAsDefaultProtocolClient(protocol, path, args) {
    electron.app.setAsDefaultProtocolClient(protocol, path, args);
  }

  // NEW API
  async appSetBadgeCount(count) {
    return electron.app.setBadgeCount(count);
  }

  // NEW API
  async appGetPath(name) {
    return electron.app.getPath(name);
  }

  // NEW API
  async clipboardWriteText(text, type) {
    electron.clipboard.writeText(text, type);
  }

  // NEW API
  async dialogShowMessageBox(options) {
    return await electron.dialog.showMessageBox(options);
  }

  // NEW API
  async dialogShowOpenDialog(options) {
    return await electron.dialog.showOpenDialog(options);
  }

  // NEW API
  async dialogShowErrorBox(title, content) {
    return await electron.dialog.showErrorBox(title, content);
  }

  // NEW API
  async notificationNew(options) {
    let onClick = () => {};
    let onClose = () => {};
    let onFailed = () => {};
    const notif = new electron.Notification(options);
    notif.on('click', (ev) => onClick(ev));
    notif.on('close', (ev) => onClose(ev));
    notif.on('failed', (ev) => onFailed(ev));
    return {
      onClick: async (cb) => {
        onClick = cb;
      },
      onClose: async (cb) => {
        onClose = cb;
      },
      onFailed: async (cb) => {
        onFailed = cb;
      },
      show: async () => {
        notif.show();
      },
    };
  }

  // NEW API
  async notificationIsSupported() {
    return electron.Notification.isSupported();
  }

  // NEW API
  async powerMonitorGetSystemIdleState(idleThreshold) {
    return electron.powerMonitor.getSystemIdleState(idleThreshold);
  }

  // NEW API
  async powerSaveBlockerStart(type) {
    return electron.powerSaveBlocker.start(type);
  }

  // NEW API
  async powerSaveBlockerStop(type) {
    return electron.powerSaveBlocker.stop(type);
  }

  // NEW API
  async protocolHandle(scheme, handler) {
    electron.protocol.handle(scheme, handler);
  }

  // NEW API
  async protocolRegisterSchemesAsPrivileged(customSchemes) {
    electron.protocol.registerSchemesAsPrivileged(customSchemes);
  }

  // NEW API
  async shellOpenPath(filePath) {
    return await electron.shell.openPath(filePath);
  }

  // NEW API
  async shellShowItemInFolder(folderPath) {
    electron.shell.showItemInFolder(folderPath);
  }

  // NEW API
  async isGraphical() {
    return !!process.versions.electron && electron?.app ? true : false;
  }

  // NEW API: FIXME: remove xHost instance from here
  async wmInit(xHost) {
    this.#WM.instance.init(xHost);
  }

  // NEW API
  async wmDisplayAuth(providerUrl, takeWholeScreen, readyCallback, server) {
    const disposer = this.#WM.instance.displayAuth(
      providerUrl,
      takeWholeScreen,
      readyCallback,
      true,
      server,
      this.#disposers[this.#disposers.length - 1]
    );
    this.#disposers.push(disposer);
  }

  // NEW API
  async wmDisplaySplash() {
    this.#WM.instance.displaySplash(
      this.#disposers[this.#disposers.length - 1]
    );
  }

  // NEW API
  async wmPrompt(payload) {
    return await this.#WM.instance.prompt(payload);
  }

  // NEW API
  // FIXME: must be async
  wmFocusApp() {
    this.#WM.instance.focus();
  }

  // NEW API
  async wmLoadConfig() {
    this.#WM.instance.loadConfig();
  }

  // NEW API
  async wmLoadSplash() {
    this.#WM.instance.loadSplash();
  }

  // NEW API
  async wmSetOverlayIcon(iconPath, label) {
    const win = this.#WM.instance.currentWindow;
    win.setOverlayIcon(electron.nativeImage.createFromPath(iconPath), label);
  }

  // NEW API
  async wmSetIcon(iconPath) {
    const win = this.#WM.instance.currentWindow;
    if (process.platform === 'darwin') {
      electron.app.dock?.setIcon(iconPath);
    } else {
      win.setIcon(iconPath);
    }
  }

  // NEW API
  async wmFlashFrame(numberOfSeconds) {
    const win = this.#WM.instance.currentWindow;
    win.flashFrame(true);
    if (numberOfSeconds) {
      setTimeout(() => win.flashFrame(false), numberOfSeconds * 1000);
    }
  }

  // NEW API
  async wmDisposeAll() {
    this.#WM.instance.disposeAll();
  }

  // NEW API
  async hasSafeStorage() {
    const safe = electron.safeStorage;
    return !!safe && safe.isEncryptionAvailable();
  }

  // NEW API
  async safeStorageEncryptString(value) {
    return electron.safeStorage.encryptString(value);
  }

  // NEW API
  async safeStorageDecryptString(pass) {
    return electron.safeStorage.decryptString(pass);
  }

  // NEW API
  async setNativeThemeSource(colorTheme) {
    electron.nativeTheme.themeSource = colorTheme;
  }

  // NEW API
  // FIXME: must be async
  msgBox(message) {
    const msgBox = new MsgBox();
    msgBox.open();
    msgBox.emit(message || '');
    return {
      emit: (message) => msgBox.emit(message),
      close: () => msgBox.close(),
    };
  }
}

module.exports = new Neutron();

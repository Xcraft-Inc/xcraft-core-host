const electron = require('electron');
const MsgBox = require('./msgbox.js');

class Neutron {
  #WM = require('./wm.js');
  #disposers = [];

  constructor() {}

  get app() {
    return electron.app;
  }

  get clipboard() {
    return electron.clipboard;
  }

  get dialog() {
    return electron.dialog;
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
  // FIXME: must be async
  isGraphical() {
    return !!process.versions.electron && electron?.app ? true : false;
  }

  // NEW API
  async appWhenReady() {
    await electron.app.whenReady();
  }

  // NEW API: FIXME: remove xHost instance from here
  async wmInit(xHost) {
    this.#WM.instance.init(this);
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

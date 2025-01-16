const electron = require('electron');
const EventEmitter = require('node:events');
const MsgBox = require('./msgbox.js');

class Shell {
  #shell;

  constructor(shell) {
    this.#shell = shell;
  }

  async openPath() {
    return await this.#shell.openPath.apply(this.#shell, arguments);
  }

  showItemInFolder() {
    return this.#shell.showItemInFolder.apply(this.#shell, arguments);
  }
}

class Neutron {
  #shell;

  #WM = require('./wm.js');
  #disposers = [];

  constructor() {
    this.#shell = new Shell(electron.shell);
  }

  get app() {
    return electron.app;
  }

  get clipboard() {
    return electron.clipboard;
  }

  get dialog() {
    return electron.dialog;
  }

  get Notification() {
    return electron.Notification;
  }

  get powerMonitor() {
    return electron.powerMonitor;
  }

  get powerSaveBlocker() {
    return electron.powerSaveBlocker;
  }

  get protocol() {
    return electron.protocol;
  }

  get screen() {
    return electron.screen;
  }

  get session() {
    return electron.session;
  }

  get shell() {
    return this.#shell;
  }

  get webFrame() {
    return electron.webFrame;
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
      null,
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

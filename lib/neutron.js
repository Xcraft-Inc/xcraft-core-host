const electron = require('electron');
const EventEmitter = require('node:events');
const MsgBox = require('./msgbox.js');

class ContentsSession {
  #session;

  constructor(session) {
    this.#session = session;
  }

  addWordToSpellCheckerDictionary() {
    return this.#session.addWordToSpellCheckerDictionary.apply(
      this.#session,
      arguments
    );
  }
}

class WindowContents extends EventEmitter {
  #contents;
  #session;

  constructor(contents) {
    super();
    this.#contents = contents;
    this.#session = new ContentsSession(contents.session);

    const events = [
      'context-menu',
      'did-frame-finish-load',
      'did-finish-load',
      'prompt',
    ];
    for (const event of events) {
      this.#contents.on(event, (...args) => this.emit(event, ...args));
    }
  }

  get session() {
    return this.#session;
  }

  closeDevTools() {
    return this.#contents.closeDevTools.apply(this.#contents, arguments);
  }

  replaceMisspelling() {
    return this.#contents.replaceMisspelling.apply(this.#contents, arguments);
  }

  send() {
    return this.#contents.send.apply(this.#contents, arguments);
  }

  setWindowOpenHandler() {
    return this.#contents.setWindowOpenHandler.apply(this.#contents, arguments);
  }
}

class BrowserWindow extends EventEmitter {
  #window;
  #contents;

  constructor() {
    super();
    this.#window = new electron.BrowserWindow(...arguments);
    this.#contents = new WindowContents(this.#window.webContents);

    const events = ['ready-to-show', 'page-title-updated'];
    for (const event of events) {
      this.#window.on(event, (...args) => this.emit(event, ...args));
    }
  }

  set autoHideMenuBar(value) {
    this.#window.setMenuBarVisibility = value;
  }

  get autoHideMenuBar() {
    return this.#window.setMenuBarVisibility;
  }

  get webContents() {
    return this.#contents;
  }

  close() {
    return this.#window.close.apply(this.#window, arguments);
  }

  destroy() {
    return this.#window.destroy.apply(this.#window, arguments);
  }

  flashFrame() {
    return this.#window.flashFrame.apply(this.#window, arguments);
  }

  isDestroyed() {
    return this.#window.isDestroyed.apply(this.#window, arguments);
  }

  loadFile() {
    return this.#window.loadFile.apply(this.#window, arguments);
  }

  loadURL() {
    return this.#window.loadURL.apply(this.#window, arguments);
  }

  removeMenu() {
    return this.#window.removeMenu.apply(this.#window, arguments);
  }

  setBounds() {
    return this.#window.setBounds.apply(this.#window, arguments);
  }

  setIcon() {
    return this.#window.setIcon.apply(this.#window, arguments);
  }

  setMenuBarVisibility() {
    return this.#window.setMenuBarVisibility.apply(this.#window, arguments);
  }

  setOverlayIcon() {
    return this.#window.setOverlayIcon.apply(this.#window, arguments);
  }

  show() {
    return this.#window.show.apply(this.#window, arguments);
  }

  static getAllWindows() {
    return electron.BrowserWindow.getAllWindows.apply(
      electron.BrowserWindow,
      arguments
    );
  }
}

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

  get BrowserWindow() {
    return BrowserWindow;
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

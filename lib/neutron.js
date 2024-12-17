const {BrowserWindow} = require('electron');
const EventEmitter = require('node:events');

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

class Window extends EventEmitter {
  #window;
  #contents;

  constructor() {
    super();
    this.#window = new BrowserWindow(...arguments);
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
    return BrowserWindow.getAllWindows.apply(BrowserWindow, arguments);
  }
}

class Neutron {
  #electron;

  constructor() {
    this.#electron = require('electron');
  }

  get app() {
    return this.#electron.app;
  }

  get BrowserWindow() {
    return Window;
  }

  get clipboard() {
    return this.#electron.clipboard;
  }

  get dialog() {
    return this.#electron.dialog;
  }

  get ipcMain() {
    return this.#electron.ipcMain;
  }

  get Menu() {
    return this.#electron.Menu;
  }

  get MenuItem() {
    return this.#electron.MenuItem;
  }

  get nativeTheme() {
    return this.#electron.nativeTheme;
  }

  get nativeImage() {
    return this.#electron.nativeImage;
  }

  get Notification() {
    return this.#electron.Notification;
  }

  get powerMonitor() {
    return this.#electron.powerMonitor;
  }

  get powerSaveBlocker() {
    return this.#electron.powerSaveBlocker;
  }

  get protocol() {
    return this.#electron.protocol;
  }

  get safeStorage() {
    return this.#electron.safeStorage;
  }

  get screen() {
    return this.#electron.screen;
  }

  get session() {
    return this.#electron.session;
  }

  get shell() {
    return this.#electron.shell;
  }

  get webFrame() {
    return this.#electron.webFrame;
  }
}

module.exports = new Neutron();

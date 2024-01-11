'use strict';

const WM_INSTANCE_KEY = Symbol.for('goblin-wm.window-manager');
const IS_DEV = process.env.NODE_ENV === 'development';
const watt = require('gigawatts');
const Screen = require('./screen.js');

class Window {
  constructor(wm, options) {
    const {BrowserWindow} = require('electron');
    //copy config
    this.wm = wm;
    this.winOptions = {...this.wm.config.windowOptions};

    //Override with options
    Object.entries(options).forEach(([option, value]) => {
      if (value !== undefined) {
        this.winOptions[option] = value;
      }
    });

    this.winOptions.webPreferences = {
      nodeIntegration: true,
      contextIsolation: false,
    };

    //VIBRANCY SUPPORT
    /*let vibrancy;
    try {
      vibrancy = require('windows-swca');
    } catch (ex) {
      if (ex.code !== 'MODULE_NOT_FOUND') {
        throw ex;
      } else if (this.wm.config.vibrancyOptions) {
        console.warn(
          'WM: electron-vibrancy not available and vibrancyOptions is set'
        );
      }
    }

    if (vibrancy && this.wm.config.vibrancyOptions !== null) {
      this.winOptions.backgroundColor = '#00000000';
    }*/

    if (options.modal && options.parentId) {
      this.winOptions.parent = wm[options.parentId];
      this.winOptions.modal = true;
    }

    const mustHideWindow = this.winOptions.show === false;
    //avoid display blank page
    this.winOptions.show = false;

    this.win = new BrowserWindow(this.winOptions);

    this.win.setMenuBarVisibility(false);
    this.win.autoHideMenuBar = true;

    this.win.once('ready-to-show', () => {
      if (!mustHideWindow) {
        this.win.show();
      }
    });

    //avoid title change for ex. when navigating
    this.win.on('page-title-updated', (e) => {
      e.preventDefault();
    });

    //ENABLE VIBRANCY
    /*if (vibrancy && this.wm.config.vibrancyOptions !== null) {
      this.win.setMenuBarVisibility(false);
      vibrancy.SetWindowCompositionAttribute(
        this.win.getNativeWindowHandle(),
        vibrancy.ACCENT_STATE.ACCENT_ENABLE_BLURBEHIND,
        0x01000000
      );
    }*/

    if (options.openDevTools) {
      this.win.webContents.on('did-frame-finish-load', () => {
        this.win.webContents.openDevTools();
      });
    }
  }

  setState(windowState) {
    if (windowState) {
      //TODO: invalidate bad bounds
      this.win.setBounds({
        x:windowState.get('bounds.x'),
        y:windowState.get('bounds.y'),
        height:windowState.get('bounds.height'),
        width:windowState.get('bounds.width'),
      },true);
    }
  }

  dispose() {
    this.win.close();
    if (!this.win.isDestroyed()) {
      this.win.destroy();
    }
  }
}

class WindowManager {
  constructor() {
    console.log('WM init...');
    const appArgs = require('../lib/args-parsing.js')();
    const {Menu, app, shell, session} = require('electron');
    if (!app) {
      console.warn('WM init...[DISABLED]');
      return;
    }
    this.app = app;
    this._log = require('xcraft-core-log')('window-manager');
    const wmConfig = require('xcraft-core-etc')().load('goblin-wm');
    this.config = wmConfig;
    this._services = {};
    this._windows = {};
    this._windowIdStack = [];
    this._currentFeeds = {};

    //force User-Agent with only Electron/version
    session.defaultSession.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        details.requestHeaders[
          'User-Agent'
        ] = `Electron/${process.versions.electron}`;
        callback({requestHeaders: details.requestHeaders});
      }
    );

    const defaultMenu = require('electron-default-menu');
    const menu = defaultMenu(app, shell)
      .filter((menu) => menu.role !== 'help')
      .map((menu) => {
        if (menu.label === 'Window') {
          delete menu.submenu[1].role;
          menu.submenu[1].label = 'Close tab';
          menu.submenu[1].click = function (menuItem, window) {
            const busClient = require('xcraft-core-busclient').getGlobal();
            const resp = busClient.newResponse('goblin-vm', 'token');
            resp.events.send(`${window.id}.<close-tab-requested>`);
          };
          menu.submenu.push({
            label: 'Close all tabs',
            accelerator: 'CmdOrCtrl+Shift+W',
            click: function (menuItem, window) {
              const busClient = require('xcraft-core-busclient').getGlobal();
              const resp = busClient.newResponse('goblin-vm', 'token');
              resp.events.send(`${window.id}.<close-all-tabs-requested>`);
            },
          });
        }

        if (process.env.NODE_ENV !== 'development') {
          menu.submenu = menu.submenu.filter(
            (submenu) =>
              !['CmdOrCtrl+R', 'Ctrl+Shift+I', 'Alt+Command+I'].includes(
                submenu.accelerator
              )
          );
        }

        return menu;
      });
    app.applicationMenu = Menu.buildFromTemplate(menu);

    if (appArgs.splash !== false && this.config.disableSplash === false) {
      this.displaySplash();
    }
    watt.wrapAll(this);
  }

  getDefaultWindowState() {
    return {
      bounds: Screen.getDefaultWindowBounds(),
      maximized: false,
      fullscreen: false,
    };
  }

  getWindowState(window) {
    if (window && window.isDestroyed()) {
      return null;
    }
    let bounds = window.getNormalBounds();
    return {
      bounds,
      maximized: window.isMaximized(),
      fullscreen: window.isFullScreen(),
    };
  }

  get currentWindow() {
    const len = this._windowIdStack.length;
    if (len > 0) {
      return this._services[this._windowIdStack[len - 1]].win;
    } else {
      return null;
    }
  }

  displayAuth(authUrl, takeWholeScreen = false, onClose) {
    const existing = this.getWindowInstance('auth');
    if (existing) {
      existing.show();
      return () => {
        this.dispose('auth');
      };
    }
    const parent = this.currentWindow;
    const window = this.create(
      'auth',
      {
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        show: true,
        autoHideMenuBar: true,
        frame: true,
        backgroundColor: '#1e3d5b',
        alwaysOnTop: false,
        modal: false,
        movable: true,
        parent,
      },
      null
    );
    if (onClose) {
      window.win.once('close', onClose);
    }
    const rect = parent.getBounds();
    if (!takeWholeScreen) {
      const height = parseInt((rect.height * 4) / 5);
      const width = parseInt((height * 4) / 5);
      const x = rect.x + parseInt(rect.width / 2 - width / 2);
      const y = rect.y + parseInt(rect.height / 2 - height / 2);
      window.win.setBounds({x, y, width, height});
    } else {
      window.win.setBounds({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
    }
    window.win.loadURL(authUrl);

    //return a disposer
    return () => {
      this.dispose('auth');
    };
  }

  displaySplash() {
    //SPLASH THE MAIN WINDOW
    let options = {
      width: 400,
      height: 220,
      center: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      show: true,
      autoHideMenuBar: true,
      title: this.app.getName(),
      frame: false,
      backgroundColor: '#1e3d5b',
      alwaysOnTop: IS_DEV ? false : true,
    };
    if (this.config.splashWindowOptions) {
      options = {...options, ...this.config.splashWindowOptions};
    }

    const bounds = Screen.getDefaultWindowBounds(options.width, options.height);
    options = {...options, ...bounds};

    const window = this.create('splash', options, null);
    const path = require('path');
    const {resourcesPath} = require('./index.js');
    const fs = require('fs');
    const customSplash = path.join(resourcesPath, 'splash.html');
    if (fs.existsSync(customSplash)) {
      window.win.loadFile(customSplash);
    } else {
      window.win.loadFile(path.join(__dirname, './splash.html'));
    }

    const locale = this.app.getLocale();
    window.win.webContents.on('did-finish-load', () => {
      window.win.webContents.send('progress', {step: 'waiting', locale});
      this._resp.events.subscribe(`*::client.progressed`, (msg) => {
        if (!window.win.isDestroyed()) {
          window.win.webContents.send('progress', {step: msg.data, locale});
        }
      });
    });
  }

  create(windowId, options) {
    const {BrowserWindow} = require('electron');
    //DEVELOPPER STUFF
    const allBrowserWindow = BrowserWindow.getAllWindows();
    // Close devtools in other windows
    // prevent the fact that devtools work in only one window at a time...
    allBrowserWindow.forEach((window) => {
      window.webContents.closeDevTools();
    });

    const window = new Window(this, options);
    this._windowIdStack.push(windowId);
    this._services[windowId] = window;
    //dispose splash when the next created window appear
    if (windowId !== 'splash' && this._services.splash) {
      window.win.once('ready-to-show', () => {
        this.dispose('splash');
      });
    }
    return window;
  }

  setWindowCurrentFeeds(windowId, desktopId, feeds) {
    this._currentFeeds[windowId] = {desktopId, feeds};
  }

  initBus() {
    const busClient = require('xcraft-core-busclient').getGlobal();
    this._resp = busClient.newResponse('goblin-vm', 'token');
  }

  getWindowInstance(windowId) {
    const window = this._services[windowId];
    if (window) {
      return window.win;
    }
    return null;
  }

  getWindowOptions(windowId) {
    return this._services[windowId].winOptions;
  }

  disposeAll() {
    for (const windowId in this._services) {
      this.dispose(windowId);
    }
  }

  dispose(windowId) {
    const window = this._services[windowId];
    if (window) {
      window.dispose();
    }
    delete this._services[windowId];
    delete this._currentFeeds[windowId];
    const idx = this._windowIdStack.indexOf(windowId);
    if (idx !== -1) {
      this._windowIdStack.splice(idx, 1);
    }
  }
}

const globalSymbols = Object.getOwnPropertySymbols(global);
const hasInstance = globalSymbols.indexOf(WM_INSTANCE_KEY) > -1;
if (!hasInstance) {
  global[WM_INSTANCE_KEY] = new WindowManager();
}

const singleton = {};

Object.defineProperty(singleton, 'instance', {
  get: function () {
    return global[WM_INSTANCE_KEY];
  },
});

Object.freeze(singleton);
module.exports = singleton;

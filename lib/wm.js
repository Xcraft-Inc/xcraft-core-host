'use strict';

const WM_INSTANCE_KEY = Symbol.for('goblin-wm.window-manager');
const IS_DEV = process.env.NODE_ENV === 'development';
const Screen = require('./screen.js');
const moduleName = 'xcraft-core-host';
const xLog = require('xcraft-core-log')(moduleName);

class Window {
  constructor(wm, options) {
    const {BrowserWindow} = require('electron');
    //copy config
    this.wm = wm;

    this.winOptions = {};
    if (this.wm?.config?.windowOptions) {
      this.winOptions = {...this.wm.config.windowOptions};
    }

    //Override with options
    Object.entries(options).forEach(([option, value]) => {
      if (value !== undefined) {
        this.winOptions[option] = value;
      }
    });

    // Default args for nodeIntegration and contextIsolation
    this.winOptions.webPreferences = {
      nodeIntegration: true,
      contextIsolation: false,
      // Override default args with options
      ...this.winOptions.webPreferences,
    };

    // Set the pid in the partition if it's defined.
    // This action ensures that a second instance starts without delay,
    // addressing the issue described in https://github.com/electron/electron/issues/22438
    const partition = this.winOptions.webPreferences.partition;
    if (partition) {
      this.winOptions.webPreferences.partition = partition.replaceAll(
        '$PROCESS_PID',
        process.pid
      );
    }

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
      this.win.setBounds(
        {
          x: windowState.get('bounds.x'),
          y: windowState.get('bounds.y'),
          height: windowState.get('bounds.height'),
          width: windowState.get('bounds.width'),
        },
        true
      );
    }
  }

  dispose(clearStorageData = false) {
    this.win.close();
    if (clearStorageData) {
      this.win.webContents.session.clearStorageData();
    }

    if (!this.win.isDestroyed()) {
      this.win.destroy();
    }
  }
}

class WindowManager {
  constructor() {
    console.log('WM init...');

    const {Menu, app, shell} = require('electron');
    if (!app) {
      console.warn('WM init...[DISABLED]');
      return;
    }
    this.app = app;
    this._log = require('xcraft-core-log')('window-manager');

    this._services = {};
    this._windows = {};
    this._windowIdStack = [];
    this._currentFeeds = {};

    const {splashWindowOptions} = require('xcraft-core-host');
    this.config = {
      splashWindowOptions,
    };

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
  }

  loadConfig() {
    const {splashWindowOptions} = require('xcraft-core-host');
    this.config = require('xcraft-core-etc')().load('goblin-wm');
    if (!this.config.splashWindowOptions && splashWindowOptions) {
      this.config.splashWindowOptions = splashWindowOptions;
    }
  }

  loadSplash() {
    const appArgs = require('../lib/args-parsing.js')();
    if (appArgs.splash !== false && this.config.disableSplash === false) {
      this.displaySplash();
    }
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

  displayAuth(
    authUrl,
    takeWholeScreen = false,
    onClose,
    noParent = false,
    windowId = '',
    onLoaded = null,
    windowOptions = null
  ) {
    const authWindowId = `auth${windowId}`;
    const existing = this.getWindowInstance(authWindowId);
    if (existing) {
      existing.show();
      return (clearStorageData = false) => {
        this.dispose(authWindowId, clearStorageData);
      };
    }
    let parent = null;
    if (!noParent) {
      parent = this.currentWindow;
    }

    const {webPreferences, ...otherWindowOptions} = windowOptions || {};
    const window = this.create(
      authWindowId,
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
        webPreferences: {
          nodeIntegration: false,
          ...(webPreferences || {}),
        },
        ...otherWindowOptions,
      },
      null
    );
    if (onClose) {
      window.win.once('close', onClose);
    }
    let rect = Screen.getDefaultWindowBounds(800, 600);
    if (!noParent) {
      rect = parent.getBounds();
    }
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

    window.win.webContents
      .on('did-finish-load', () => {
        if (onLoaded) {
          onLoaded();
        }
      })
      .on(
        'did-fail-load',
        (event, errorCode, errorDescription, validatedURL) => {
          xLog.err(
            `DisplayAuth: renderer load error (code: ${errorCode}, description: ${errorDescription}, url: ${validatedURL})`
          );
          if (onLoaded) {
            onLoaded('did-fail-load', {
              errorCode,
              errorDescription,
              validatedURL,
            });
          }
        }
      )
      .on('render-process-gone', (event, details) => {
        xLog.err(
          `DisplayAuth: renderer process gone (reason: ${details.reason}, code: ${details.exitCode})`
        );
        if (onLoaded) {
          onLoaded('render-process-gone', {details});
        }
      });

    //return a disposer
    return (clearStorageData = false) => {
      this.dispose(authWindowId, clearStorageData);
    };
  }

  async prompt({values}, listener) {
    const getResult = new Promise((resolve, reject) => {
      this.displaySplash(() => {
        const {win} = this._services['splash'];
        const {ipcMain} = require('electron');
        ipcMain.once('prompt-selected', (event, value) => {
          resolve(value);
        });

        win.webContents.send('prompt', {values});
      });
    });

    const value = await getResult;
    return value;
  }

  displaySplash(onLoaded) {
    if (this._services.splash) {
      return;
    }

    const {appVersion} = require('xcraft-core-host');

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

    if (this?.config?.splashWindowOptions) {
      options = {...options, ...this.config.splashWindowOptions};
      if (options.transparent) {
        delete options.backgroundColor;
      }
    }

    const bounds = Screen.getDefaultWindowBounds(options.width, options.height);
    options = {...options, ...bounds};

    const window = this.create('splash', options, null);
    const path = require('path');
    const {resourcesPath} = require('xcraft-core-host');
    const fs = require('fs');
    const customSplash = path.join(resourcesPath, 'splash.html');
    if (fs.existsSync(customSplash)) {
      window.win.loadFile(customSplash);
    } else {
      window.win.loadFile(path.join(__dirname, './splash.html'));
    }

    const locale = this.app.getLocale();
    window.win.webContents
      .on('did-finish-load', () => {
        if (onLoaded) {
          onLoaded();
        }
        window.win.webContents.send('program', {version: appVersion});
        window.win.webContents.send('progress', {step: 'waiting', locale});
        if (this._resp) {
          this._resp.events.subscribe(`*::client.progressed`, (msg) => {
            if (!window.win.isDestroyed()) {
              window.win.webContents.send('progress', {step: msg.data, locale});
            }
          });
        }
      })
      .on(
        'did-fail-load',
        (event, errorCode, errorDescription, validatedURL) => {
          xLog.err(
            `DisplaySplash: renderer load error (code: ${errorCode}, description: ${errorDescription}, url: ${validatedURL})`
          );
          if (onLoaded) {
            onLoaded('did-fail-load', {
              errorCode,
              errorDescription,
              validatedURL,
            });
          }
        }
      )
      .on('render-process-gone', (event, details) => {
        xLog.err(
          `DisplaySplash: renderer process gone (reason: ${details.reason}, code: ${details.exitCode})`
        );
        if (onLoaded) {
          onLoaded('render-process-gone', {details});
        }
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
        setTimeout(() => this.dispose('splash'), this.config?.splashDelay);
      });
    }

    if (this.config?.windowOptions?.openLink === 'external') {
      window.win.webContents.setWindowOpenHandler((details) => {
        if (details.url && this._resp) {
          const {url} = details;
          const internalProtocols = Object.keys(this.xHost._xConfig.protocols);
          const urlInfos = new URL(url);
          const protocol = urlInfos.protocol.slice(0, -1);
          if (internalProtocols.includes(protocol)) {
            this.xHost._notifyProtocol({url}).catch((ex) => xLog.err(ex));
            return {action: 'deny'};
          }
          this._resp.command.send('client.open-external', {url}, (err) => {
            if (err) {
              this._resp.log.err(err);
            }
          });
        }
        return {action: 'deny'};
      });
    }

    if (this.config?.windowOptions?.contextMenu === true) {
      const {Menu, MenuItem, clipboard} = require('electron');

      window.win.webContents.on('context-menu', (event, params) => {
        const menu = new Menu();

        if (params.isEditable) {
          menu.append(new MenuItem({role: 'cut'}));
          menu.append(new MenuItem({role: 'copy'}));
          if (params.linkURL) {
            menu.append(
              new MenuItem({
                label: 'Copy link url',
                click: () => clipboard.writeText(params.linkURL),
              })
            );
          }
          menu.append(new MenuItem({role: 'paste'}));
          menu.append(
            new MenuItem({
              role: 'pasteAndMatchStyle',
            })
          );
          menu.append(new MenuItem({role: 'selectAll'}));
          menu.append(new MenuItem({type: 'separator'}));
          menu.append(
            new MenuItem({
              type: 'checkbox',
              role: 'toggleSpellChecker',
            })
          );
        }

        // Add each spelling suggestion
        for (const suggestion of params.dictionarySuggestions) {
          menu.append(
            new MenuItem({
              label: suggestion,
              click: () =>
                window.win.webContents.replaceMisspelling(suggestion),
            })
          );
        }

        // Allow users to add the misspelled word to the dictionary
        if (params.misspelledWord) {
          menu.append(
            new MenuItem({
              label: 'Add to dictionnary',
              click: () =>
                window.win.webContents.session.addWordToSpellCheckerDictionary(
                  params.misspelledWord
                ),
            })
          );
        }

        if (menu.items.length) {
          menu.popup();
        }
      });
    }

    return window;
  }

  setWindowCurrentFeeds(windowId, desktopId, feeds) {
    this._currentFeeds[windowId] = {desktopId, feeds};
  }

  getWindowIdFromDesktopId(desktopId) {
    return Object.entries(this._currentFeeds).find(
      ([_, ctx]) => ctx.desktopId === desktopId
    )?.[0];
  }

  init(xHost) {
    const {session} = require('electron');

    //force User-Agent with only Electron/version
    session.defaultSession.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        details.requestHeaders[
          'User-Agent'
        ] = `Electron/${process.versions.electron}`;
        callback({requestHeaders: details.requestHeaders});
      }
    );

    this.xHost = xHost;
    const busClient = require('xcraft-core-busclient').getGlobal();
    this._resp = busClient.newResponse('goblin-vm', 'token');
  }

  focus() {
    if (!this.currentWindow) {
      return;
    }

    if (this.currentWindow.isMinimized()) {
      this.currentWindow.restore();
    }
    this.currentWindow.focus();
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

  dispose(windowId, clearStorageData = false) {
    const window = this._services[windowId];
    if (window) {
      window.dispose(clearStorageData);
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

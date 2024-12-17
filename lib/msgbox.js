'use strict';

const Screen = require('./screen.js');

class MsgBox {
  constructor() {
    this._win = null;
  }

  open() {
    const {app, BrowserWindow} = require('xcraft-core-host/lib/neutron.js');
    const path = require('path');

    let options = {
      width: 400,
      height: 200,
      center: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      show: true,
      autoHideMenuBar: true,
      title: app.getName(),
      frame: false,
      backgroundColor: '#1e3d5b',
      alwaysOnTop: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    };

    const bounds = Screen.getDefaultWindowBounds(options.width, options.height);
    options = {...options, ...bounds};

    this._win = new BrowserWindow(options);
    this._win.removeMenu();
    this._win.loadFile(path.join(__dirname, './msgbox.html'));
  }

  emit(message) {
    if (this._win) {
      this._win.webContents.send('progress', {message});
    }
  }

  close() {
    if (this._win && !this._win.isDestroyed()) {
      this._win.close();
    }
  }
}

module.exports = MsgBox;

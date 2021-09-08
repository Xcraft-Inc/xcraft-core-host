'use strict';

class MsgBox {
  constructor() {
    this._win = null;
  }

  open(message) {
    const {app, BrowserWindow} = require('electron');
    const path = require('path');

    this._win = new BrowserWindow({
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
        additionalArguments: [message],
      },
    });
    this._win.removeMenu();
    this._win.loadFile(path.join(__dirname, './msgbox.html'));
  }

  close() {
    if (this._win) {
      this._win.close();
    }
  }
}

module.exports = MsgBox;

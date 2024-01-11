'use strict';

const Screen = require('./screen.js');

class MsgBox {
  constructor() {
    this._win = null;
  }

  open(message) {
    const {app, BrowserWindow} = require('electron');
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
        additionalArguments: [message],
      },
    };

    const bounds = Screen.getDefaultWindowBounds(options.width, options.height);
    options = {...options, ...bounds};

    this._win = new BrowserWindow(options);
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

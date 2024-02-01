'use strict';

/**
 * Retrieve the inquirer definition for xcraft-core-etc
 */
module.exports = [
  {
    type: 'input',
    name: 'mainQuest',
    message: 'main quest to start',
    default: null,
  },
  {
    type: 'input',
    name: 'secondaryQuest',
    message: 'secondary quest to start (electron ready)',
    default: null,
  },
  {
    type: 'list',
    name: 'afterLoadQuests',
    message: 'quest(s) to call after host load',
    default: [],
  },
  {
    type: 'input',
    name: 'openFileQuest',
    message: 'quest called when a file is opened',
    default: null,
  },
  {
    type: 'input',
    name: 'prologModuleLoad',
    message: 'module loaded before the Xcraft server boot',
    default: null,
  },
  {
    type: 'confirm',
    name: 'singleInstance',
    message: 'boolean to makes your application a Single Instance Application',
    default: false,
  },
  {
    type: 'input',
    name: 'newInstanceQuest',
    message: 'quest called when a new Instance is launch',
    default: null,
  },
  {
    type: 'input',
    name: 'appOptions',
    message: 'add custom command line options (yargs format)',
    default: null,
  },
  {
    type: 'confirm',
    name: 'disableGoblinWM',
    message: 'disable goblin-wm (splash) with electron',
    default: false,
  },
  {
    type: 'checkbox',
    name: 'powerSaveBlockers',
    message:
      'power save blockers (electron), [prevent-app-suspension, prevent-display-sleep]',
    default: [],
  },
  {
    type: 'confirm',
    name: 'powerMonitorSweeper',
    message: 'start the sweeper on locking',
    default: false,
  },
];

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
    type: 'input',
    name: 'openFileQuest',
    message: 'quest called when a file is opened',
    default: null,
  },
];

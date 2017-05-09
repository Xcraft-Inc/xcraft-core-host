'use strict';

/**
 * Retrieve the inquirer definition for xcraft-core-etc
 */
module.exports = [
  {
    type: 'input',
    name: 'mainQuest',
    message: 'main quest to start',
    default: 'defaultapp.boot',
  },
  {
    type: 'input',
    name: 'secondaryQuest',
    message: 'secondary quest to start (electron ready)',
    default: 'defaultapp.start',
  },
];

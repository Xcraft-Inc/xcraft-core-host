'use strict';

let appArgs = null;

function parseArgs() {
  if (appArgs) {
    return appArgs;
  }

  const {hideBin} = require('yargs/helpers');
  const xConfigHost = require('xcraft-core-etc')().load('xcraft-core-host');

  const electronArgs = [
    '--allow-file-access-from-files',
    '--original-process-start-time',
    '--no-sandbox',
    '--inspect',
    '--inspect-brk',
    '--remote-debugging-port',
  ];

  // Remove args destinated to Electron
  process.argv = process.argv.filter(
    (arg) => !electronArgs.some((electronArg) => arg.startsWith(electronArg))
  );

  const yargs = require('yargs').parserConfiguration({
    'camel-case-expansion': false,
  });

  appArgs = yargs
    .option('app', {
      alias: 'a',
      describe: 'Choose app name to use',
    })
    .option('devtools', {
      describe: 'Hide/show frontend devtools in app (react and redux devtools)',
      choices: [0, 1],
    })
    .option('root', {
      alias: 'r',
      describe: 'Choose root directory',
    })
    .option('debug', {
      alias: 'd',
      describe: 'Hide/show debugger logs',
      choices: [0, 1],
    })
    .option('probe', {
      describe: 'Activate/desactivate probe',
      choices: [0, 1],
    })
    .option('log', {
      alias: 'l',
      describe: 'Choose log level',
      choices: [0, 1, 2, 3],
    })
    .option('logs', {
      describe: 'Hide/show logs',
      choices: [0, 1],
    })
    // how args are stored, if it's an array as expected
    .option('log-mods', {
      describe: 'Choose modules where logs are active',
    })
    .help()
    .detectLocale(false);

  for (const [key, value] of Object.entries(xConfigHost.appOptions)) {
    appArgs = appArgs.option(key, value);
  }

  // named args are stored by their name and unamed args into "_" key.
  // For example: node ./cli -l=fr_CH test_potato
  // appArgs = { "_": ["test_potato"], "l": "fr_CH"};

  const envOverridable = {
    'app': 'WESTEROS_APP',
    'devtools': 'WESTEROS_DEVTOOLS',
    'root': 'XCRAFT_ROOT',
    'debug': 'XCRAFT_DEBUG',
    'probe': 'XCRAFT_PROBE',
    'log': 'XCRAFT_LOG',
    'logs': 'XCRAFT_LOGS',
    'log-mods': 'XCRAFT_LOG_MODS',
  };

  // Override of ENV variable if namedAppArgs match
  const {_: unamedAppArgs, ...namedAppArgs} = appArgs.argv;
  for (const argName of Object.keys(namedAppArgs)) {
    if (envOverridable[argName]) {
      process.env[envOverridable[argName]] = namedAppArgs[argName];
    }
  }
  return appArgs;
}

module.exports = parseArgs;

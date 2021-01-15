'use strict';

let appArgs = null;

function parseArgs() {
  if (appArgs) {
    return appArgs;
  }

  const {hideBin} = require('yargs/helpers');
  const xHost = require('xcraft-core-host');
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
      describe: 'Start using the specified app name',
    })
    .option('devtools', {
      describe: 'Hide/show frontend devtools in app (react and redux devtools)',
      boolean: true,
    })
    .option('debug', {
      alias: 'd',
      describe: 'Hide/show debugger logs',
      boolean: true,
    })
    .option('probe', {
      describe: 'Activate/desactivate probe',
      boolean: true,
    })
    .option('log', {
      alias: 'l',
      describe: 'Choose log level',
      choices: [0, 1, 2, 3],
    })
    .option('log-mods', {
      describe: 'Choose modules where logs are active',
    })
    .option('locale', {
      describe: 'Start using the specified locale',
    })
    .option('nabu', {
      describe: 'Start using nabu translator',
    })
    .option('relaunch-reason', {
      describe: 'Reason for the relaunch',
      implies: 'relaunch-desktops',
      hidden: true,
      choices: ['server-restart', 'client-connection'],
    })
    .option('relaunch-desktops', {
      describe: 'desktopIds open before the relaunch',
      implies: 'relaunch-reason',
      hidden: true,
    })
    .version(xHost.appVersion)
    .help()
    .detectLocale(false);

  if (xConfigHost.appOptions) {
    for (const [key, value] of Object.entries(xConfigHost.appOptions)) {
      appArgs = appArgs.option(key, value);
    }
  }

  // named args are stored by their name and unamed args into "_" key.
  // For example: node ./cli -l=fr_CH test_potato
  // appArgs = { "_": ["test_potato"], "l": "fr_CH"};

  const envOverridable = {
    'app': 'WESTEROS_APP',
    'devtools': 'WESTEROS_DEVTOOLS',
    'debug': 'XCRAFT_DEBUG',
    'probe': 'XCRAFT_PROBE',
    'log': 'XCRAFT_LOG',
    'log-mods': 'XCRAFT_LOG_MODS',
  };

  // Override of ENV variable if namedAppArgs match
  const {_: unamedAppArgs, ...namedAppArgs} = appArgs.argv;
  for (const argName of Object.keys(namedAppArgs)) {
    if (envOverridable[argName]) {
      if (typeof namedAppArgs[argName] === 'boolean') {
        process.env[envOverridable[argName]] = namedAppArgs[argName] ? 1 : 0;
      } else {
        process.env[envOverridable[argName]] = namedAppArgs[argName];
      }
    }
  }
  return appArgs;
}

module.exports = parseArgs;

'use strict';

let appArgs = null;
let argv = null;

function parseArgs(parse = false, commandLine = process.argv) {
  if (appArgs && argv && !parse) {
    return argv;
  }

  const xHost = require('./configBuilder');
  const xConfigHost = require('xcraft-core-etc')().load('xcraft-core-host');

  const electronArgs = [
    '--allow-file-access-from-files',
    '--original-process-start-time',
    // '--no-sandbox', MS: keep this one otherwise it breaks (on Debian) the daemon spawns
    '--inspect',
    '--inspect-brk',
    '--remote-debugging-port',
  ];

  // Remove args destinated to Electron
  process.argv = commandLine = commandLine.filter(
    (arg) => !electronArgs.some((electronArg) => arg.startsWith(electronArg))
  );

  const {hideBin} = require('yargs/helpers');
  const yargs = require('yargs/yargs')(
    hideBin(process.argv)
  ).parserConfiguration({
    'camel-case-expansion': false,
  });

  appArgs = yargs
    .option('app', {
      alias: 'a',
      describe: 'Start using the specified app name [env:GOBLINS_APP]',
      hidden: process.env.NODE_ENV !== 'development',
    })
    .option('tribe', {
      alias: 't',
      describe: 'Start the specified tribe, 0 is the main',
      hidden: process.env.NODE_ENV !== 'development',
      number: true,
    })
    .option('total-tribes', {
      alias: 'T',
      describe: 'Number of tribes',
      hidden: process.env.NODE_ENV !== 'development',
      number: true,
    })
    .option('devtools', {
      describe:
        'Hide/show frontend devtools in app (react and redux devtools) [env:GOBLINS_DEVTOOLS]',
      boolean: true,
    })
    .option('debug-child', {
      alias: 'd',
      describe:
        'Enable/disable inspector for child processes [env:XCRAFT_DEBUG]',
      boolean: true,
    })
    .option('probe', {
      describe: 'Activate/desactivate probe [env:XCRAFT_PROBE]',
      boolean: true,
    })
    .option('log', {
      alias: 'l',
      describe: 'Choose log level [env:XCRAFT_LOG]',
      choices: [0, 1, 2, 3],
    })
    .option('log-mods', {
      describe: 'Choose modules where logs are active [env:XCRAFT_LOG_MODS]',
    })
    .option('locale', {
      describe: 'Start using the specified locale',
    })
    .option('no-splash', {
      describe: 'Start without spash screen',
      boolean: true,
    })
    .option('nabu', {
      describe: 'Start using nabu translator',
    })
    .option('no-tls', {
      describe: 'Connect on bus without TLS even if a certificate is provided',
      boolean: true,
    })
    .option('relaunch-reason', {
      describe: 'Reason for the relaunch',
      hidden: true,
      choices: ['server-restart', 'client-connection'],
    })
    .option('relaunch-desktops', {
      describe: 'Provide desktopIds to open before the relaunch',
      implies: 'relaunch-reason',
      array: true,
      hidden: true,
    })
    .option('topology', {
      describe: 'Provide a network topology configuration',
    })
    .option('disable-actions-sync', {
      describe: 'Disable actions store syncronization',
      boolean: true,
    })
    .version(xHost.appVersion)
    .alias('version', 'V')
    .help()
    .alias('help', 'h')
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
    'app': 'GOBLINS_APP',
    'devtools': 'GOBLINS_DEVTOOLS',
    'debug-child': 'XCRAFT_DEBUG',
    'probe': 'XCRAFT_PROBE',
    'log': 'XCRAFT_LOG',
    'log-mods': 'XCRAFT_LOG_MODS',
  };

  argv = appArgs.argv;

  // Override of ENV variable if namedAppArgs match
  const {_: unamedAppArgs, ...namedAppArgs} = argv;
  for (const argName of Object.keys(namedAppArgs)) {
    if (envOverridable[argName]) {
      if (typeof namedAppArgs[argName] === 'boolean') {
        process.env[envOverridable[argName]] = namedAppArgs[argName]
          ? '1'
          : '0';
      } else {
        process.env[envOverridable[argName]] = namedAppArgs[argName];
      }
    }
  }

  return argv;
}

module.exports = parseArgs;

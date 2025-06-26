'use strict';

const fse = require('fs-extra');
const path = require('node:path');
const {
  loadProject,
  importRealmFile,
  getResourcesPath,
} = require('./helpers.js');
const applyOverrides = require('./applyOverrides.js');
const moduleName = 'xcraft-core-host';
const xLog = require('xcraft-core-log')(moduleName);

const isProd = process.env.NODE_ENV !== 'development';

async function updateRealmsFromResources(resourcesPath, config) {
  const orkFiles = fse
    .readdirSync(resourcesPath)
    .filter((file) =>
      isProd ? file.endsWith('.ork') : file.endsWith('-dev.ork')
    )
    .map((file) => path.join(resourcesPath, file));
  for (const orkFilePath of orkFiles) {
    await importRealmFile(orkFilePath, config.realmsStorePath);
    const realmFile = path.basename(orkFilePath);
    const updated = config.realmFiles.indexOf(realmFile) !== -1;
    if (!updated) {
      config.realmFiles.push(realmFile);
    }
  }
}

module.exports = async (appArg, isGraphical) => {
  const {projectPath, initialConfig} = loadProject();
  const config = applyOverrides(projectPath, initialConfig);
  const {useRealms, realmsStorePath} = config;

  if (!isGraphical || !useRealms) {
    return config;
  }

  const resourcesPath = getResourcesPath(
    config.projectPath,
    config.masterAppId,
    config.variantId
  );
  await updateRealmsFromResources(resourcesPath, config);

  xLog.dbg(`using realms with storage at: ${realmsStorePath}`);
  let files = null;
  try {
    files = await fse.readdir(realmsStorePath);
  } catch (err) {
    //
  }

  if (!files) {
    const neutron = require('./neutron.js');
    await neutron.appWhenReady();
    xLog.dbg(`asking user for realm key import`);
    const {canceled, filePaths} = await neutron.dialogShowOpenDialog({
      title: 'Select a realm file to import',
      defaultPath: await neutron.appGetPath('home'),
      buttonLabel: 'import',
      filters: [{name: 'Ork Realm File (.ork)', extensions: ['ork']}],
      properties: ['openFile', 'multiSelections', 'dontAddToRecent'],
    });
    if (canceled) {
      xLog.dbg(`user canceled import`);
      await neutron.appExit(0);
      return null;
    }
    for (const filePath of filePaths) {
      await importRealmFile(filePath, realmsStorePath);
    }
    try {
      files = await fse.readdir(realmsStorePath);
    } catch (err) {
      //
    }
  }

  files = files.filter((f) => path.extname(f) === '.ork');
  if (!files) {
    throw new Error('Error during import of ork files');
  }
  xLog.dbg(`found ${files.length} realm(s) files`);
  config.realmFiles = files;

  return config;
};

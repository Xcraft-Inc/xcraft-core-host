'use strict';

const fse = require('fs-extra');
const path = require('node:path');

function loadInitialConfig(projectPath) {
  const configFiles = ['goblins.json', 'westeros.json'].map((fileName) =>
    path.join(projectPath, fileName)
  );
  let error;
  for (const configFile of configFiles) {
    try {
      return fse.readJSONSync(configFile);
    } catch (ex) {
      error = ex;
    }
  }

  if (error) {
    throw error;
  }
}

async function importRealmFile(filePath, storePath) {
  const fileName = path.basename(filePath);
  const destPath = path.join(storePath, fileName);
  await fse.mkdirp(storePath);
  await fse.copy(filePath, destPath);
}

function getResourcesPath(projectPath, masterAppId, variantId = null) {
  const resources = variantId ? `resources@${variantId}` : 'resources';
  const resPath = path.resolve(projectPath, 'app', masterAppId, resources);
  return fse.existsSync(resPath)
    ? resPath
    : path.resolve(process.resourcesPath || projectPath);
}

function loadProject() {
  let error;
  const dirs = path.resolve(__dirname, '../..').split(path.sep);

  for (let i = dirs.length - 1; i >= 0; --i) {
    if (dirs[i] === 'node_modules') {
      continue;
    }

    const projectPath = dirs.slice(0, i + 1).join(path.sep);
    try {
      const initialConfig = loadInitialConfig(projectPath);
      if (initialConfig.appId) {
        return {
          projectPath,
          initialConfig,
        };
      }
    } catch (ex) {
      error = ex;
    }
  }

  if (error) {
    throw error;
  }
  throw new Error('Main projectPath was not found (goblins.json is missing');
}

module.exports = {
  loadInitialConfig,
  importRealmFile,
  getResourcesPath,
  loadProject,
};

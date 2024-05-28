'use strict';

const fse = require('fs-extra');
const path = require('path');

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

function importRealmFile(filePath, storePath) {
  const fileName = path.basename(filePath);
  const destPath = path.join(storePath, fileName);
  fse.mkdirpSync(storePath);
  fse.copyFileSync(filePath, destPath);
}

module.exports = {loadInitialConfig, importRealmFile};

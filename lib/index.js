'use strict';

const applyOverrides = require('./applyOverrides.js');
const configBuilder = require('./configBuilder.js');
const {loadProject} = require('./helpers.js');

const {projectPath, initialConfig} = loadProject();
const preConfig = applyOverrides(projectPath, initialConfig);
preConfig._isMinimalConfig = true;

module.exports = configBuilder(preConfig);

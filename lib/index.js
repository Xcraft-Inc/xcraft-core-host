'use strict';

const path = require('node:path');
const applyOverrides = require('./applyOverrides.js');
const configBuilder = require('./configBuilder.js');
const {loadInitialConfig} = require('./helpers.js');

const projectPath = path.join(__dirname, '../../../'); //FIXME: UGLY RELATIVE JOIN
const initialConfig = loadInitialConfig(projectPath);
const preConfig = applyOverrides(projectPath, initialConfig);
preConfig._isMinimalConfig = true;

module.exports = configBuilder(preConfig);

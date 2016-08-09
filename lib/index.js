'use strict';


if (process.versions.electron) {
  const {app} = require ('electron');
  const appConfigPath = path.join (app.getPath ('appData'), app.getName ());
} else {
}

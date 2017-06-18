const tl = require('vsts-task-lib/task');
const xmlSubstitutionUtility = require('./xmlvariablesubstitutionutility.js');

const folderPath = t1.getPathInput('sourcePath', true)
xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath, true)


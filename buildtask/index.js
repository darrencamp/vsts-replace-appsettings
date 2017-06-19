const tl = require('vsts-task-lib/task');
const xmlSubstitutionUtility = require('./xmlvariablesubstitutionutility.js');

const folderPath = tl.getInput('sourcePath', false)
console.log(`Variable substitution for '${folderPath}'`)
console.log(`should be ${process.env.CUSTOMLOCATION}`)

xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath || process.env.CUSTOMLOCATION, true)

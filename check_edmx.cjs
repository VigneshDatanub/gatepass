const { execSync } = require('child_process');
const out = execSync('node node_modules/@sap/cds-dk/bin/cds.js compile srv --to edmx').toString();
const matches = out.match(/<Action Name="[^"]+"/g);
console.log(matches);

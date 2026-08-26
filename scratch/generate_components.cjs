const fs = require('fs');
const path = require('path');

function createComponent(appId, folderName) {
    const webappPath = path.join(__dirname, '../app', folderName, 'webapp');
    const content = `sap.ui.define(["sap/fe/core/AppComponent"], function(AppComponent) {
    "use strict";
    return AppComponent.extend("${appId}.Component", {
        metadata: {
            manifest: "json"
        }
    });
});`;
    fs.writeFileSync(path.join(webappPath, 'Component.js'), content);
    console.log(`Created Component.js for ${appId}`);
}

createComponent('nub.gatepass.mypasses', 'my-passes');
createComponent('nub.gatepass.gateconsole', 'gate-console');
createComponent('nub.gatepass.reports', 'reports');

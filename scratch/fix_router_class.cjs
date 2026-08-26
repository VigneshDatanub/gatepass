const fs = require('fs');
const path = require('path');

['my-passes', 'gate-console', 'reports'].forEach(app => {
    const manifestPath = path.join(__dirname, '../app', app, 'webapp', 'manifest.json');
    const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Fix routerClass
    if (data["sap.ui5"] && data["sap.ui5"]["routing"] && data["sap.ui5"]["routing"]["config"]) {
        data["sap.ui5"]["routing"]["config"]["routerClass"] = "sap.m.routing.Router";
    }
    
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2));
    console.log(`Updated routerClass in manifest.json for ${app}`);
});

const fs = require('fs');
const path = require('path');

['my-passes', 'gate-console', 'reports'].forEach(app => {
    const manifestPath = path.join(__dirname, '../app', app, 'webapp', 'manifest.json');
    const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Inject sap.cloud property
    data["sap.cloud"] = {
        "public": true,
        "service": "gatepass"
    };
    
    // Inject missing sap.app.id if not set correctly
    if (!data["sap.app"]) data["sap.app"] = {};
    if (!data["sap.app"]["id"]) data["sap.app"]["id"] = `nub.gatepass.${app.replace('-', '')}`;
    
    // Inject mandatory applicationVersion for BTP deployment
    if (!data["sap.app"]["applicationVersion"]) {
        data["sap.app"]["applicationVersion"] = { "version": "1.0.0" };
    }
    
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2));
    console.log(`Updated manifest.json for ${app} with applicationVersion`);
});

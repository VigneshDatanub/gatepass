const fs = require('fs');
const path = require('path');

const xsAppContent = {
  "welcomeFile": "index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^(.*)$",
      "target": "$1",
      "authenticationType": "xsuaa",
      "service": "html5-apps-repo-rt"
    }
  ]
};

['my-passes', 'gate-console', 'reports'].forEach(app => {
    const webappPath = path.join(__dirname, '../app', app, 'webapp');
    fs.writeFileSync(path.join(webappPath, 'xs-app.json'), JSON.stringify(xsAppContent, null, 2));
    console.log(`Created xs-app.json for ${app}`);
});

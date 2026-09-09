import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const apps = [
  'admin-areas',
  'admin-employees',
  'admin-plants',
  'approvals',
  'footfall',
  'gate-console',
  'my-passes',
  'reports'
];

for (const app of apps) {
  const manifestPath = path.join(rootDir, 'app', app, 'webapp', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    // Construct object with sap.cloud after sap.app
    const newManifest = {};
    for (const key of Object.keys(manifest)) {
      newManifest[key] = manifest[key];
      if (key === 'sap.app') {
        newManifest['sap.cloud'] = {
          public: true,
          service: 'gatepass'
        };
      }
    }

    // 2. Change mainService URI to relative
    if (newManifest['sap.app']?.dataSources?.mainService) {
      newManifest['sap.app'].dataSources.mainService.uri = 'odata/v4/gate-pass/';
    }

    fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf8');
    console.log(`Updated manifest.json for ${app}`);
  }

  // Update xs-app.json in webapp and app root
  const xsAppContent = {
    welcomeFile: '/index.html',
    authenticationMethod: 'route',
    routes: [
      {
        source: '^/?odata/(.*)$',
        target: '/odata/$1',
        destination: 'srv-api',
        authenticationType: 'xsuaa',
        csrfProtection: false
      },
      {
        source: '^(.*)$',
        target: '$1',
        service: 'html5-apps-repo-rt',
        authenticationType: 'xsuaa'
      }
    ]
  };

  const xsAppPaths = [
    path.join(rootDir, 'app', app, 'webapp', 'xs-app.json'),
    path.join(rootDir, 'app', app, 'xs-app.json')
  ];

  for (const p of xsAppPaths) {
    fs.writeFileSync(p, JSON.stringify(xsAppContent, null, 2) + '\n', 'utf8');
  }
  console.log(`Updated xs-app.json for ${app}`);
}

// Update app/router/xs-app.json
const routerXsAppPath = path.join(rootDir, 'app', 'router', 'xs-app.json');
const routerXsAppContent = {
  welcomeFile: '/nubgatepassgateconsole/index.html',
  authenticationMethod: 'route',
  routes: [
    {
      source: '^/odata/v4/gate-pass/(.*)$',
      target: '/odata/v4/gate-pass/$1',
      destination: 'srv-api',
      authenticationType: 'xsuaa',
      csrfProtection: false
    },
    {
      source: '^/[^/]+/odata/v4/gate-pass/(.*)$',
      target: '/odata/v4/gate-pass/$1',
      destination: 'srv-api',
      authenticationType: 'xsuaa',
      csrfProtection: false
    },
    {
      source: '^(.*)$',
      target: '$1',
      service: 'html5-apps-repo-rt',
      authenticationType: 'xsuaa'
    }
  ]
};
fs.writeFileSync(routerXsAppPath, JSON.stringify(routerXsAppContent, null, 2) + '\n', 'utf8');
console.log('Updated app/router/xs-app.json');

import http from 'http';

function checkUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });
  });
}

const url = 'http://localhost:4004/reports/webapp/manifest.json';
const res = await checkUrl(url);
console.log('Status Code:', res.statusCode);
const data = JSON.parse(res.body);
console.log('VisitorPassesList settings in manifest:', JSON.stringify(data["sap.ui5"].routing.targets.VisitorPassesList.options.settings, null, 2));
console.log('VisitorPassesObjectPage settings in manifest:', JSON.stringify(data["sap.ui5"].routing.targets.VisitorPassesObjectPage.options.settings, null, 2));

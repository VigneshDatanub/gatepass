const https = require('https');

async function main() {
  const tokenUrl = 'https://3c792fd9trial.authentication.us10.hana.ondemand.com/oauth/token';
  const clientId = 'sb-clonee51df7915ae14f0b802721c448df5aed!b696485|destination-xsappname!b62';
  const clientSecret = '5cf49fd2-e84b-4e02-a111-ed0735d21c90$X6h945aFs06_KjWglh9QZvydOeZaAjivJr-K4Smi1ws=';

  const auth = Buffer.from(clientId + ':' + clientSecret).toString('base64');
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + auth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  console.log('Destination service token status:', res.status);
  const data = await res.json();
  if (data.access_token) {
    console.log('Got destination service access token successfully!');
    const destRes = await fetch('https://destination-configuration.cfapps.us10.hana.ondemand.com/destination-configuration/v1/subaccountDestinations/srv-api', {
      headers: {
        'Authorization': 'Bearer ' + data.access_token
      }
    });
    console.log('GET srv-api status:', destRes.status);
    const destJson = await destRes.json();
    console.log('Current srv-api destination:\n', JSON.stringify(destJson, null, 2));
  } else {
    console.log('Token error:', data);
  }
}

main().catch(console.error);

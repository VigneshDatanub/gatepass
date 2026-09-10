const https = require('https');

async function main() {
  // 1. Get Destination Service token
  const destTokenUrl = 'https://3c792fd9trial.authentication.us10.hana.ondemand.com/oauth/token';
  const destClientId = 'sb-clonee51df7915ae14f0b802721c448df5aed!b696485|destination-xsappname!b62';
  const destClientSecret = '5cf49fd2-e84b-4e02-a111-ed0735d21c90$X6h945aFs06_KjWglh9QZvydOeZaAjivJr-K4Smi1ws=';

  const destAuth = Buffer.from(destClientId + ':' + destClientSecret).toString('base64');
  const res = await fetch(destTokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + destAuth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error('Failed to get destination service access token:', data);
    return;
  }
  console.log('Got destination service token!');

  // 2. Put srv-api destination with OAuth2UserTokenExchange
  const xsuaaClientId = 'sb-gatepass-3c792fd9trial-dev!t696485';
  const xsuaaClientSecret = '49f88d8a-a31a-409f-ae54-69eb68d937c6$cxmyepO_DlAki6avOeGXH2uawN_C5J-lBcxqdz6rfXw=';
  const tokenServiceURL = 'https://3c792fd9trial.authentication.us10.hana.ondemand.com/oauth/token';

  const destinationPayload = {
    Name: 'srv-api',
    Type: 'HTTP',
    URL: 'https://3c792fd9trial-dev-gatepass-srv.cfapps.us10-003.hana.ondemand.com',
    Authentication: 'OAuth2UserTokenExchange',
    ProxyType: 'Internet',
    tokenServiceURL: tokenServiceURL,
    clientId: xsuaaClientId,
    clientSecret: xsuaaClientSecret,
    'HTML5.DynamicDestination': 'true',
    'HTML5.ForwardAuthToken': 'true',
    'sap.cloud.service': 'gatepass',
    Description: 'Gatepass CAP Backend Service'
  };

  const putRes = await fetch('https://destination-configuration.cfapps.us10.hana.ondemand.com/destination-configuration/v1/subaccountDestinations', {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + data.access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(destinationPayload)
  });

  console.log('PUT Destination Status:', putRes.status);
  console.log('PUT Destination Response:', await putRes.text());

  // 3. Verify
  const getRes = await fetch('https://destination-configuration.cfapps.us10.hana.ondemand.com/destination-configuration/v1/subaccountDestinations/srv-api', {
    headers: {
      'Authorization': 'Bearer ' + data.access_token
    }
  });
  console.log('GET srv-api verify status:', getRes.status);
  const verifyJson = await getRes.json();
  console.log('Verified destination configuration:\n', JSON.stringify(verifyJson, null, 2));
}

main().catch(console.error);

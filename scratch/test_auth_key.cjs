const https = require('https');

async function main() {
  const tokenUrl = 'https://3c792fd9trial.authentication.us10.hana.ondemand.com/oauth/token';
  const clientId = 'sb-gatepass-3c792fd9trial-dev!t696485';
  const clientSecret = '49f88d8a-a31a-409f-ae54-69eb68d937c6$cxmyepO_DlAki6avOeGXH2uawN_C5J-lBcxqdz6rfXw=';

  const auth = Buffer.from(clientId + ':' + clientSecret).toString('base64');
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + auth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  console.log('XSUAA token status:', res.status);
  const data = await res.json();
  console.log('XSUAA token received:', !!data.access_token);
}

main().catch(console.error);

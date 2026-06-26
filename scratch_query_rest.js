import fs from 'fs';
import path from 'path';
import os from 'os';

async function main() {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  let token = config.tokens.access_token;
  
  // Refresh if needed or just try using it
  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'v3swm-MgWubCc75D18_Jk4xs',
      grant_type: 'refresh_token',
      refresh_token: config.tokens.refresh_token
    })
  });
  
  const refreshData = await refreshResponse.json();
  token = refreshData.access_token;
  
  const uids = ["cqv0gQ4gikPWxctMdxsEE3Ne9VJ2", "TftLr8WERhVZK0sXfGt6EXWKAZf1", "QSfeSQvurJNNdpFD86Vh7a32Pch2"];
  
  for (const userId of uids) {
    console.log(`\n================= User: ${userId} =================`);
    
    // Query Lots for 009
    const lotsUrl = `https://firestore.googleapis.com/v1/projects/app-vendas-e-producao/databases/(default)/documents/users/${userId}/productionLots`;
    const lotsRes = await fetch(lotsUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    
    if (lotsRes.ok) {
      const lotsData = await lotsRes.json();
      const lot009 = lotsData.documents?.find(d => d.fields.orderNumber?.stringValue === '009');
      if (lot009) {
        console.log('Lot 009 Found:', lot009.name);
        console.log('Lot fields:', JSON.stringify(lot009.fields, null, 2));
      } else {
        console.log('Lot 009 not found in active list. Total lots in this user:', lotsData.documents?.length || 0);
      }
    } else {
      console.log(`Failed to fetch lots: ${lotsRes.status} ${await lotsRes.text()}`);
    }
    
    // Query OS for OS-0031
    const osUrl = `https://firestore.googleapis.com/v1/projects/app-vendas-e-producao/databases/(default)/documents/users/${userId}/serviceOrders`;
    const osRes = await fetch(osUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (osRes.ok) {
      const osData = await osRes.json();
      const os0031 = osData.documents?.find(d => d.fields.osNumber?.stringValue === 'OS-0031');
      if (os0031) {
        console.log('OS-0031 Found:', os0031.name);
        console.log('OS fields:', JSON.stringify(os0031.fields, null, 2));
      } else {
        console.log('OS-0031 not found in active list. Total OS in this user:', osData.documents?.length || 0);
      }
    } else {
      console.log(`Failed to fetch OS: ${osRes.status} ${await osRes.text()}`);
    }
  }
}

main().catch(console.error);

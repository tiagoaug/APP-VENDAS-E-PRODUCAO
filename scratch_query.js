import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log('Querying serviceOrders for OS-0031...');
  const osQuery = query(collection(db, 'serviceOrders'), where('osNumber', '==', 'OS-0031'));
  const osSnap = await getDocs(osQuery);
  
  if (osSnap.empty) {
    console.log('No OS found with number OS-0031.');
  } else {
    osSnap.forEach(doc => {
      const data = doc.data();
      console.log('OS Found:', doc.id);
      console.log('osNumber:', data.osNumber);
      console.log('sectorId:', data.sectorId);
      console.log('status:', data.status);
      console.log('lotId:', data.lotId);
      console.log('lotIds:', data.lotIds);
      console.log('sourceOrderIds:', data.sourceOrderIds);
      console.log('sourceItemKeys:', data.sourceItemKeys);
    });
  }

  console.log('\nQuerying productionLots for orderNumber 009...');
  const lotQuery = query(collection(db, 'productionLots'), where('orderNumber', '==', '009'));
  const lotSnap = await getDocs(lotQuery);

  if (lotSnap.empty) {
    console.log('No lot found with orderNumber 009.');
  } else {
    lotSnap.forEach(doc => {
      const data = doc.data();
      console.log('Lot Found:', doc.id);
      console.log('orderNumber:', data.orderNumber);
      console.log('currentSectorIndex:', data.currentSectorIndex);
      console.log('route:', data.route);
      console.log('sourceItems:', data.metadata?.sourceItems);
      console.log('orderSectors:', data.metadata?.orderSectors);
    });
  }
}

main().catch(console.error).then(() => process.exit(0));

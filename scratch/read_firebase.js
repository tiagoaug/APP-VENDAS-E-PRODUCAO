const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const config = require('../firebase-applet-config.json');

const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  console.log("Fetching data from Firestore...");
  
  // Fetch productionLots
  const lotsSnap = await getDocs(collection(db, 'productionLots'));
  const lots = [];
  lotsSnap.forEach(doc => {
    lots.push({ id: doc.id, ...doc.data() });
  });
  
  // Fetch products
  const productsSnap = await getDocs(collection(db, 'products'));
  const products = [];
  productsSnap.forEach(doc => {
    products.push({ id: doc.id, ...doc.data() });
  });

  // Fetch productionConfigs
  const configsSnap = await getDocs(collection(db, 'productionConfigs'));
  const configs = [];
  configsSnap.forEach(doc => {
    configs.push({ id: doc.id, ...doc.data() });
  });

  const activeLots = lots.filter(l => !l.finishedAt);
  console.log(`\nActive Lots (${activeLots.length}):`);
  activeLots.forEach(l => {
    console.log(`- Lot ID: ${l.id}, Order: ${l.orderNumber}, Product ID: ${l.productId}, Var ID: ${l.variationId || 'empty (multi)'}, Quantity: ${l.quantity}, Pairs:`, l.pairs);
    if (l.metadata && l.metadata.groups) {
      console.log(`  Groups:`, l.metadata.groups.map(g => `Prod: ${g.productId}, Var: ${g.variationId}, Qty: ${g.quantity}`));
    }
  });

  // Find Map 002 and 008
  const mapsOfInterest = activeLots.filter(l => l.orderNumber === '002' || l.orderNumber === '008');
  console.log(`\nMaps of Interest (002 & 008):`);
  mapsOfInterest.forEach(l => {
    console.log(`- Map ${l.orderNumber}: ID ${l.id}, Qty: ${l.quantity}`);
    if (l.metadata && l.metadata.groups) {
      console.log(`  Groups:`, JSON.stringify(l.metadata.groups, null, 2));
    }
  });

  // Let's find materials of type "EMBORRACHADO BOSS"
  const emborrachados = configs.filter(c => c.name && c.name.toLowerCase().includes('emborrachado'));
  console.log(`\nEmborrachado Configs:`);
  emborrachados.forEach(c => {
    console.log(`- Config ID: ${c.id}, Name: ${c.name}, Type: ${c.type}, Unit: ${c.metadata?.unitId}`);
  });

  // Find products used in active lots
  const activeProductIds = new Set(activeLots.map(l => l.productId));
  mapsOfInterest.forEach(l => {
    if (l.metadata && l.metadata.groups) {
      l.metadata.groups.forEach(g => activeProductIds.add(g.productId));
    }
  });

  console.log(`\nProduct Consumptions:`);
  products.forEach(p => {
    if (activeProductIds.has(p.id)) {
      console.log(`- Product: ${p.name} (${p.reference || p.id})`);
      p.variations?.forEach(v => {
        console.log(`  Variation: ${v.colorName} (ID: ${v.id})`);
        v.consumptions?.forEach(c => {
          if (c.name?.toLowerCase().includes('emborrachado') || c.materialId?.includes('emborrachado') || configs.find(co => co.id === c.materialId)?.name?.toLowerCase().includes('emborrachado')) {
            console.log(`    Consumption: ${c.name || 'unnamed'} (Mat: ${c.materialId}), Qty: ${c.quantity}, Unit: ${c.unitValue}, ignoreColor: ${c.ignoreColor}, ignoreQty: ${itemIgnoreQty(c)}, basis: ${c.consumptionBasis}`);
          }
        });
      });
    }
  });
}

function itemIgnoreQty(c) {
  return c.ignoreQuantity || false;
}

run().catch(console.error).then(() => process.exit(0));

/**
 * Initialize occupiedSeats field on existing bus documents.
 * Run this script once to add the occupiedSeats array to all existing buses.
 * 
 * Alternative: Use Firebase Console directly:
 * 1. Go to Firebase Console → Firestore Database
 * 2. Click on the "buses" collection
 * 3. For each bus document, click "Add field" and add:
 *    - Field name: occupiedSeats
 *    - Field type: array
 *    - Value: [] (empty array)
 * 
 * Usage: node scripts/init-occupied-seats.js
 * 
 * Note: You need a service account key. Get it from:
 * Firebase Console → Project Settings → Service Accounts → Generate Private Key
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function initOccupiedSeats() {
  console.log('Fetching all buses...');
  const busesSnap = await db.collection('buses').get();
  
  console.log(`Found ${busesSnap.size} buses`);
  
  const batch = db.batch();
  let updatedCount = 0;
  
  for (const doc of busesSnap.docs) {
    const data = doc.data();
    
    // Only update if occupiedSeats doesn't exist
    if (data.occupiedSeats === undefined) {
      console.log(`Adding occupiedSeats to bus ${doc.id} (${data.plateNumber})`);
      batch.update(doc.ref, { occupiedSeats: [] });
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    console.log(`Committing batch update for ${updatedCount} buses...`);
    await batch.commit();
    console.log('Done!');
  } else {
    console.log('All buses already have occupiedSeats field');
  }
}

initOccupiedSeats().catch(console.error);

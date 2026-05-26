/**
 * One-time script: creates a DotVests settlement venue on the Polymesh testnet.
 * Run once: node scripts/create-venue.js
 * Then add the printed POLYMESH_VENUE_ID to your .env file.
 */
require('dotenv').config();
const { connectPolymesh } = require('../config/polymesh');

(async () => {
  try {
    console.log('Connecting to Polymesh...');
    const polymesh = await connectPolymesh();

    console.log('Creating settlement venue...');
    const tx = await polymesh.settlements.createVenue({
      description: 'DotVests Settlement Venue',
      type: 'Exchange',
    });

    const venue = await tx.run();
    const id = venue.id.toString();

    console.log('\n✅ Venue created successfully');
    console.log('Venue ID:', id);
    console.log('\nAdd this line to your .env file:');
    console.log(`POLYMESH_VENUE_ID=${id}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create venue:', error.message);
    process.exit(1);
  }
})();

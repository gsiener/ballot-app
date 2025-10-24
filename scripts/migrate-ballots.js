#!/usr/bin/env node

/**
 * Migration script to copy ballots from the old production worker
 * to the new production worker using the admin migration endpoint.
 *
 * Usage: ADMIN_KEY=your-key node scripts/migrate-ballots.js
 */

const OLD_API = 'https://ballot-app-server-production.siener.workers.dev/api/ballots';
const NEW_API = 'https://ballot-app-server.siener.workers.dev/api';

async function migrateBallots() {
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    console.error('❌ Error: ADMIN_KEY environment variable is required');
    console.log('\nUsage: ADMIN_KEY=your-key node scripts/migrate-ballots.js');
    process.exit(1);
  }

  console.log('🔍 Fetching ballots from old production...');

  // Fetch old ballots
  const oldResponse = await fetch(OLD_API);
  if (!oldResponse.ok) {
    throw new Error(`Failed to fetch old ballots: ${oldResponse.statusText}`);
  }
  const oldBallots = await oldResponse.json();
  console.log(`✅ Found ${oldBallots.length} ballots to migrate`);

  oldBallots.forEach(b => {
    console.log(`   - ${b.question.substring(0, 50)} (${b.votes.length} votes)`);
  });

  console.log('\n📤 Posting ballots to new production with migration endpoint...');

  // Post to migration endpoint
  const migrateResponse = await fetch(`${NEW_API}/admin/ballots/migrate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ballots: oldBallots })
  });

  if (!migrateResponse.ok) {
    const error = await migrateResponse.text();
    throw new Error(`Migration failed: ${migrateResponse.status} ${error}`);
  }

  const result = await migrateResponse.json();

  console.log('\n✨ Migration completed!');
  console.log(`   - Existing ballots: ${result.existingCount}`);
  console.log(`   - Migrated ballots: ${result.migratedCount}`);
  console.log(`   - Duplicates skipped: ${result.duplicatesSkipped}`);
  console.log(`   - Total ballots: ${result.totalCount}`);
  console.log(`\n${result.message}`);
}

migrateBallots().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

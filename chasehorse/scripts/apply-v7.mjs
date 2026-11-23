import pg from 'pg';
import fs from 'fs';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL.');
  const sql = fs.readFileSync('backend/erp-api/src/main/resources/db/migration/V7__custom_display_identifiers.sql', 'utf8');
  console.log('Applying V7 migration...');
  await client.query(sql);
  console.log('✓ V7 applied successfully!');

  // Check results
  const counters = await client.query('SELECT * FROM id_counters ORDER BY prefix;');
  console.log('\n--- ID COUNTERS ---');
  console.table(counters.rows);

  const sampleTasks = await client.query('SELECT id, display_id, created_by_role, title FROM tasks ORDER BY created_at ASC LIMIT 5;');
  console.log('\n--- SAMPLE TASKS ---');
  console.table(sampleTasks.rows);

  const sampleTickets = await client.query('SELECT id, display_id, ticket_number, subject FROM support_tickets ORDER BY created_at ASC LIMIT 5;');
  console.log('\n--- SAMPLE TICKETS ---');
  console.table(sampleTickets.rows);

  const sampleProfiles = await client.query('SELECT id, display_id, email, display_name FROM app_profiles ORDER BY created_at ASC LIMIT 5;');
  console.log('\n--- SAMPLE PROFILES ---');
  console.table(sampleProfiles.rows);

  await client.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

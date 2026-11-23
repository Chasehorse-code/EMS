import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../backend/erp-api/.env') });

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
  max: 20,
  ssl: { rejectUnauthorized: false }
});

async function nextId(client, prefix) {
  const res = await client.query(`
    INSERT INTO id_counters (prefix, current_value, updated_at)
    VALUES ($1, 1, now())
    ON CONFLICT (prefix)
    DO UPDATE SET current_value = id_counters.current_value + 1, updated_at = now()
    RETURNING current_value
  `, [prefix]);
  const val = res.rows[0].current_value;
  return `${prefix}${String(val).padStart(3, '0')}`;
}

async function runConcurrencyTest() {
  console.log('====================================================');
  console.log('PART 1 CONCURRENCY TEST: 50 parallel creates per prefix');
  console.log('====================================================');

  const prefixes = ['AOFW', 'COFW', 'OOFW', 'MOFW', 'ST', 'EMP'];
  const CONCURRENCY = 50;
  let allPassed = true;

  for (const prefix of prefixes) {
    process.stdout.write(`Testing prefix [${prefix}] with ${CONCURRENCY} parallel requests... `);

    // Launch 50 concurrent ID generation requests
    const tasks = Array.from({ length: CONCURRENCY }, async () => {
      const client = await pool.connect();
      try {
        return await nextId(client, prefix);
      } finally {
        client.release();
      }
    });

    const results = await Promise.all(tasks);

    // Check 1: exactly 50 IDs generated
    if (results.length !== CONCURRENCY) {
      console.log(`FAILED! Expected ${CONCURRENCY} results, got ${results.length}`);
      allPassed = false;
      continue;
    }

    // Check 2: No duplicates (size of Set == 50)
    const uniqueIds = new Set(results);
    if (uniqueIds.size !== CONCURRENCY) {
      console.log(`FAILED! Duplicate IDs detected: ${results.length - uniqueIds.size} collisions!`);
      allPassed = false;
      continue;
    }

    // Check 3: Format regex
    const regex = new RegExp(`^${prefix}\\d{3,}$`);
    const invalidFormats = results.filter(id => !regex.test(id));
    if (invalidFormats.length > 0) {
      console.log(`FAILED! Format mismatch for: ${invalidFormats.slice(0, 3).join(', ')}`);
      allPassed = false;
      continue;
    }

    const minId = results[0];
    const maxId = results[results.length - 1];
    console.log(`PASSED! (50/50 unique, range: ${minId} -> ${maxId})`);
  }

  await pool.end();

  if (allPassed) {
    console.log('\n✓ CONCURRENCY TEST PASSED: All 300 IDs generated atomically with 0 collisions and 0 failures.');
    process.exit(0);
  } else {
    console.error('\n✗ CONCURRENCY TEST FAILED!');
    process.exit(1);
  }
}

runConcurrencyTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

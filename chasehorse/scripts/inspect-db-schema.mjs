import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const tables = ['tasks', 'support_tickets', 'app_profiles'];
  for (const t of tables) {
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `, [t]);
    console.log('\n--- TABLE:', t, '---');
    console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  }

  // Check existing tasks
  const tasksRes = await client.query(`SELECT id, title, created_by, assigned_to FROM tasks LIMIT 5;`);
  console.log('\nSample Tasks:', tasksRes.rows);

  // Check existing tickets
  const ticketsRes = await client.query(`SELECT id, subject, created_by FROM support_tickets LIMIT 5;`);
  console.log('\nSample Tickets:', ticketsRes.rows);

  await client.end();
}

main().catch(console.error);

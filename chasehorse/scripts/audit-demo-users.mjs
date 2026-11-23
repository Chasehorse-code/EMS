import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT p.id, p.email, p.display_name, p.state_code, p.account_status,
           array_agg(r.role) as roles
    FROM app_profiles p
    LEFT JOIN app_role_assignments r ON p.id = r.user_id
    WHERE p.email IN (
      'customerdemo@chasehorse.com',
      'workerdemo@chasehorse.com',
      'opsdemo@chasehorse.com',
      'admindemo@chasehorse.com',
      'managerdemo@chasehorse.com',
      'partnerdemo@chasehorse.com'
    )
    GROUP BY p.id, p.email, p.display_name, p.state_code, p.account_status
    ORDER BY p.email;
  `);
  console.log(JSON.stringify(res.rows, null, 2));

  // Check auth.users for each
  const authRes = await client.query(`
    SELECT id, email, confirmed_at, email_confirmed_at
    FROM auth.users
    WHERE email IN (
      'customerdemo@chasehorse.com',
      'workerdemo@chasehorse.com',
      'opsdemo@chasehorse.com',
      'admindemo@chasehorse.com',
      'managerdemo@chasehorse.com',
      'partnerdemo@chasehorse.com'
    )
    ORDER BY email;
  `);
  console.log('--- AUTH USERS ---');
  console.log(JSON.stringify(authRes.rows, null, 2));

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://phxybimufcrsnxfepiuz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_OKwNl5c5VD_IKZHi7rL_AQ_rciWCKSp';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BASE_URL = 'http://localhost:8080/api/v1';

const rolesToTest = [
  { email: 'customerdemo@chasehorse.com', role: 'customer' },
  { email: 'workerdemo@chasehorse.com', role: 'worker' },
  { email: 'opsdemo@chasehorse.com', role: 'operations manager' },
  { email: 'admindemo@chasehorse.com', role: 'platform admin' },
  { email: 'managerdemo@chasehorse.com', role: 'manager' },
  { email: 'partnerdemo@chasehorse.com', role: 'partner' },
];

async function testRole(email, roleName) {
  console.log(`\n========================================`);
  console.log(`TESTING LOGIN & APIS FOR: ${roleName} (${email})`);
  console.log(`========================================`);

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: 'Password@123'
  });

  if (authError || !authData.session) {
    console.error(`❌ Login failed:`, authError);
    return;
  }

  const token = authData.session.access_token;
  console.log(`✓ Supabase Auth SUCCESS. User ID: ${authData.user.id}`);

  // Test GET /me
  try {
    const meRes = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`GET /me -> Status: ${meRes.status}`);
    const meBody = await meRes.json();
    console.log(`GET /me Body:`, JSON.stringify(meBody, null, 2));
  } catch (err) {
    console.error(`❌ GET /me error:`, err.message);
  }

  // Endpoints mobile calls for roles
  const testEndpoints = [
    { name: 'My Area', url: `${BASE_URL}/areas/my-area` },
    { name: 'Tasks (default)', url: `${BASE_URL}/tasks` },
    { name: 'Employees', url: `${BASE_URL}/employees` },
    { name: 'Pending Approvals', url: `${BASE_URL}/employees/pending` },
    { name: 'Review Tasks', url: `${BASE_URL}/tasks?status=SUBMITTED` },
    { name: 'Wallet', url: `${BASE_URL}/wallets/me` },
    { name: 'Tickets', url: `${BASE_URL}/tickets` },
  ];

  for (const ep of testEndpoints) {
    try {
      const res = await fetch(ep.url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      const preview = typeof parsed === 'object' ? (Array.isArray(parsed) ? `Array(${parsed.length})` : JSON.stringify(parsed).slice(0, 100)) : String(parsed).slice(0, 100);
      console.log(`  ${ep.name} (${ep.url}) -> ${res.status} [${preview}]`);
    } catch (err) {
      console.log(`  ${ep.name} (${ep.url}) -> ERROR: ${err.message}`);
    }
  }
}

async function run() {
  for (const r of rolesToTest) {
    await testRole(r.email, r.role);
  }
}

run().catch(console.error);

const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const SUPABASE_URL = 'https://phxybimufcrsnxfepiuz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_OKwNl5c5VD_IKZHi7rL_AQ_rciWCKSp';
const DB_CONNECTION = process.env.DATABASE_URL;
const PASSWORD = 'Password@123';

const ACCOUNTS = [
  {
    email: 'admindemo@chasehorse.com',
    displayName: 'Admin Demo',
    phone: '+91 98000 00001',
    region: 'Headquarters (HQ)',
    accountType: 'EMPLOYEE',
    subRole: 'admin',
    roles: ['ADMIN', 'OPERATIONS', 'EMPLOYEE'],
  },
  {
    email: 'opsdemo@chasehorse.com',
    displayName: 'Operations Manager Demo',
    phone: '+91 98000 00002',
    region: 'South Region',
    accountType: 'EMPLOYEE',
    subRole: 'manager',
    roles: ['OPERATIONS', 'MANAGER'],
  },
  {
    email: 'managerdemo@chasehorse.com',
    displayName: 'Manager Demo',
    phone: '+91 98000 00003',
    region: 'Central Region',
    accountType: 'EMPLOYEE',
    subRole: 'manager',
    roles: ['OPERATIONS', 'MANAGER'],
  },
  {
    email: 'workerdemo@chasehorse.com',
    displayName: 'Field Worker Demo',
    phone: '+91 98000 00004',
    region: 'Tenali Urban, Chenchupeta',
    accountType: 'EMPLOYEE',
    subRole: 'field_worker',
    roles: ['EMPLOYEE', 'FIELD_WORKER'],
  },
  {
    email: 'employeedemo@chasehorse.com',
    displayName: 'Employee Demo',
    phone: '+91 98000 00005',
    region: 'Vijayawada Central',
    accountType: 'EMPLOYEE',
    subRole: 'field_worker',
    roles: ['EMPLOYEE', 'FIELD_WORKER'],
  },
  {
    email: 'customerdemo@chasehorse.com',
    displayName: 'Customer Demo',
    phone: '+91 98000 00006',
    region: 'Hyderabad Enterprise Hub',
    accountType: 'CUSTOMER',
    subRole: 'customer',
    roles: ['CUSTOMER'],
  },
  {
    email: 'customer@chasehorse.com',
    displayName: 'Enterprise Customer',
    phone: '+91 98000 00016',
    region: 'Hyderabad Enterprise Hub',
    accountType: 'CUSTOMER',
    subRole: 'customer',
    roles: ['CUSTOMER'],
  },
  {
    email: 'manager@chasehorse.com',
    displayName: 'Operations Manager',
    phone: '+91 98000 00012',
    region: 'South Region',
    accountType: 'EMPLOYEE',
    subRole: 'manager',
    roles: ['OPERATIONS', 'MANAGER'],
  },
  {
    email: 'worker@chasehorse.com',
    displayName: 'On-Field Worker',
    phone: '+91 98000 00014',
    region: 'Tenali Urban, Chenchupeta',
    accountType: 'EMPLOYEE',
    subRole: 'field_worker',
    roles: ['EMPLOYEE', 'FIELD_WORKER'],
  },
  {
    email: 'admin@chasehorse.com',
    displayName: 'Platform Admin',
    phone: '+91 98000 00011',
    region: 'Headquarters (HQ)',
    accountType: 'EMPLOYEE',
    subRole: 'admin',
    roles: ['ADMIN', 'OPERATIONS', 'EMPLOYEE'],
  },
  {
    email: 'partnerdemo@chasehorse.com',
    displayName: 'Partner Demo',
    phone: '+91 98000 00007',
    region: 'National Logistics',
    accountType: 'EMPLOYEE',
    subRole: 'partner',
    roles: ['PARTNER'],
  },
];

async function main() {
  console.log('=== CHASEHORSE DEMO USERS PROVISIONING ===\n');

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const pg = new Client({
    connectionString: DB_CONNECTION,
    ssl: { rejectUnauthorized: false },
  });

  await pg.connect();
  console.log('Connected to Supabase PostgreSQL database.\n');

  // Fetch the bcrypt hash and meta template from admindemo@chasehorse.com
  const adminRes = await pg.query('SELECT * FROM auth.users WHERE email = $1', ['admindemo@chasehorse.com']);
  if (adminRes.rows.length === 0) {
    throw new Error('admindemo@chasehorse.com not found in auth.users');
  }
  const adminRow = adminRes.rows[0];
  const passwordHash = adminRow.encrypted_password;
  const instanceId = adminRow.instance_id || '00000000-0000-0000-0000-000000000000';
  console.log(`Reference password hash retrieved for Password@123.\n`);

  const registeredUsers = [];

  for (const acc of ACCOUNTS) {
    console.log(`--- Processing: ${acc.email} (${acc.displayName}) ---`);
    let userId = null;

    // Check if user already exists in auth.users
    const existing = await pg.query('SELECT id, email FROM auth.users WHERE email = $1', [acc.email]);
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      console.log(`  User already exists with ID: ${userId}`);
      // Ensure password is set to Password@123, email is confirmed, and tokens are empty strings (GoTrue requires non-null strings)
      await pg.query(`
        UPDATE auth.users
        SET encrypted_password = $1,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_user_meta_data = $2,
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change = COALESCE(email_change, ''),
            phone_change = COALESCE(phone_change, ''),
            phone_change_token = COALESCE(phone_change_token, ''),
            email_change_token_current = COALESCE(email_change_token_current, ''),
            reauthentication_token = COALESCE(reauthentication_token, ''),
            confirmation_token = COALESCE(confirmation_token, ''),
            email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
            is_sso_user = COALESCE(is_sso_user, false),
            is_anonymous = COALESCE(is_anonymous, false),
            updated_at = NOW()
        WHERE id = $3
      `, [
        passwordHash,
        JSON.stringify({
          full_name: acc.displayName,
          phone: acc.phone,
          region: acc.region,
          account_type: acc.accountType,
          sub_role: acc.subRole,
        }),
        userId,
      ]);
    } else {
      console.log(`  Inserting user directly into auth.users...`);
      const insertRes = await pg.query(`
        INSERT INTO auth.users (
          instance_id,
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          recovery_token,
          email_change_token_new,
          email_change,
          phone_change,
          phone_change_token,
          email_change_token_current,
          reauthentication_token,
          confirmation_token,
          email_change_confirm_status,
          is_sso_user,
          is_anonymous,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at
        ) VALUES (
          $1,
          gen_random_uuid(),
          'authenticated',
          'authenticated',
          $2,
          $3,
          NOW(),
          '', '', '', '', '', '', '', '',
          0, false, false,
          '{"provider":"email","providers":["email"]}'::jsonb,
          $4::jsonb,
          NOW(),
          NOW()
        )
        RETURNING id;
      `, [
        instanceId,
        acc.email,
        passwordHash,
        JSON.stringify({
          full_name: acc.displayName,
          phone: acc.phone,
          region: acc.region,
          account_type: acc.accountType,
          sub_role: acc.subRole,
        }),
      ]);

      userId = insertRes.rows[0].id;
      console.log(`  ✅ Inserted user with ID: ${userId}`);
    }

    // Ensure identity record exists in auth.identities
    const idenData = {
      sub: userId,
      email: acc.email,
      full_name: acc.displayName,
      phone: acc.phone,
      account_type: acc.accountType,
      sub_role: acc.subRole,
      email_verified: true,
      phone_verified: false,
    };

    await pg.query(`
      INSERT INTO auth.identities (
        id,
        provider_id,
        user_id,
        identity_data,
        provider,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        $1::text,
        $1::uuid,
        $2::jsonb,
        'email',
        NOW(),
        NOW()
      )
      ON CONFLICT (provider_id, provider) DO UPDATE
      SET identity_data = EXCLUDED.identity_data,
          updated_at = NOW();
    `, [userId, JSON.stringify(idenData)]);
    console.log(`  ✅ Identity record ensured in auth.identities`);

    // 1. Confirm user in auth.users
    await pg.query(`
      UPDATE auth.users
      SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
      WHERE id = $1
    `, [userId]);
    console.log(`  ✅ Email confirmed in auth.users`);

    // 2. Ensure profile exists and is ACTIVE
    await pg.query(`
      INSERT INTO public.app_profiles (id, display_name, email, phone, region, account_status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          region = EXCLUDED.region,
          account_status = 'ACTIVE',
          updated_at = NOW()
    `, [userId, acc.displayName, acc.email, acc.phone, acc.region]);
    console.log(`  ✅ Profile marked ACTIVE in public.app_profiles`);

    // 3. Assign roles
    for (const r of acc.roles) {
      await pg.query(`
        INSERT INTO public.app_role_assignments (user_id, role)
        VALUES ($1, $2)
        ON CONFLICT (user_id, role) DO NOTHING
      `, [userId, r]);
    }
    console.log(`  ✅ Roles assigned: [${acc.roles.join(', ')}]`);

    registeredUsers.push({ ...acc, userId });
  }

  console.log('\n=== TESTING LOGINS & JWT PROFILE RESOLUTION ===\n');

  for (const user of registeredUsers) {
    console.log(`Authenticating ${user.email} with password "${PASSWORD}" ...`);
    const { data, error } = await sb.auth.signInWithPassword({
      email: user.email,
      password: PASSWORD,
    });

    if (error) {
      console.error(`  ❌ Sign in failed: ${error.message}`);
      continue;
    }

    const token = data.session?.access_token;
    console.log(`  ✅ Supabase session acquired! User ID: ${data.user?.id}`);

    // Call backend API /api/v1/me to verify profile loading
    try {
      const res = await fetch('http://localhost:8080/api/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json();
        console.log(`  ✅ Backend /api/v1/me verified! Roles returned: [${body.roles?.join(', ')}], Status: ${body.accountStatus}`);
      } else {
        console.warn(`  ⚠️ Backend /api/v1/me returned status ${res.status}`);
      }
    } catch (e) {
      console.warn(`  ⚠️ Could not contact backend: ${e.message}`);
    }
  }

  await pg.end();
  console.log('\n=== PROVISIONING COMPLETED SUCCESSFULLY ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

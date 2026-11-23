process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  // 1. Create or replace trigger function
  console.log('Creating trigger function on auth.users...');
  await client.query(`
    CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
    RETURNS trigger AS $$
    DECLARE
        v_account_type TEXT;
        v_sub_role TEXT;
        v_display_name TEXT;
        v_phone TEXT;
        v_region TEXT;
        v_status TEXT;
        v_state_code TEXT;
    BEGIN
        v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'EMPLOYEE');
        v_sub_role := COALESCE(NEW.raw_user_meta_data->>'sub_role', 'field_worker');
        v_display_name := COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'company_name',
            split_part(NEW.email, '@', 1)
        );
        v_phone := NEW.raw_user_meta_data->>'phone';
        v_region := COALESCE(NEW.raw_user_meta_data->>'region', 'Andhra Pradesh');
        v_state_code := 'AP';
        
        -- Customers are auto-approved; employees/field workers start in PENDING
        IF UPPER(v_account_type) = 'CUSTOMER' THEN
            v_status := 'ACTIVE';
        ELSE
            v_status := 'PENDING';
        END IF;

        -- Insert into app_profiles
        INSERT INTO public.app_profiles (id, display_name, email, phone, region, state_code, account_status, created_at, updated_at)
        VALUES (NEW.id, v_display_name, NEW.email, v_phone, v_region, v_state_code, v_status, now(), now())
        ON CONFLICT (id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            email = EXCLUDED.email,
            phone = COALESCE(public.app_profiles.phone, EXCLUDED.phone),
            region = COALESCE(public.app_profiles.region, EXCLUDED.region),
            state_code = COALESCE(public.app_profiles.state_code, EXCLUDED.state_code),
            updated_at = now();

        -- Assign primary role
        IF UPPER(v_account_type) = 'CUSTOMER' THEN
            INSERT INTO public.app_role_assignments (user_id, role)
            VALUES (NEW.id, 'CUSTOMER')
            ON CONFLICT (user_id, role) DO NOTHING;
        ELSE
            INSERT INTO public.app_role_assignments (user_id, role)
            VALUES (NEW.id, 'EMPLOYEE')
            ON CONFLICT (user_id, role) DO NOTHING;

            IF v_sub_role IN ('field_worker', 'on_field', 'FIELD_WORKER') THEN
                INSERT INTO public.app_role_assignments (user_id, role)
                VALUES (NEW.id, 'FIELD_WORKER')
                ON CONFLICT (user_id, role) DO NOTHING;
            END IF;
        END IF;

        -- Ensure email is confirmed so approved users can log in
        NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);

  console.log('Attaching trigger to auth.users...');
  await client.query(`
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        BEFORE INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
  `);
  console.log('✓ Automatic sync trigger installed on auth.users.');

  // Alter column phone to VARCHAR(50) to prevent overflow
  await client.query('ALTER TABLE public.app_profiles ALTER COLUMN phone TYPE VARCHAR(50)').catch(() => {});

  // 2. Backfill all existing auth.users missing from app_profiles
  console.log('Backfilling existing auth.users into app_profiles...');
  const usersRes = await client.query(`
    SELECT id, email, email_confirmed_at, raw_user_meta_data, created_at
    FROM auth.users
  `);

  for (const u of usersRes.rows) {
    const meta = u.raw_user_meta_data || {};
    const accountType = (meta.account_type || 'EMPLOYEE').toUpperCase();
    const subRole = meta.sub_role || 'field_worker';
    const displayName = meta.full_name || meta.name || meta.company_name || u.email.split('@')[0];
    const rawPhone = meta.phone || null;
    const phone = rawPhone ? rawPhone.slice(0, 50) : null;
    const region = meta.region || 'Andhra Pradesh';
    const stateCode = 'AP';
    
    // Check if profile already exists
    const existing = await client.query('SELECT id, account_status FROM public.app_profiles WHERE id = $1', [u.id]);
    
    let status = accountType === 'CUSTOMER' ? 'ACTIVE' : 'PENDING';
    if (existing.rows.length > 0) {
      status = existing.rows[0].account_status; // preserve existing status
    }

    // Auto confirm email in auth.users
    await client.query('UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = $1', [u.id]);

    // Insert or update profile
    await client.query(`
      INSERT INTO public.app_profiles (id, display_name, email, phone, region, state_code, account_status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      ON CONFLICT (id) DO UPDATE SET
        display_name = COALESCE(public.app_profiles.display_name, EXCLUDED.display_name),
        phone = COALESCE(public.app_profiles.phone, EXCLUDED.phone),
        region = COALESCE(public.app_profiles.region, EXCLUDED.region),
        state_code = COALESCE(public.app_profiles.state_code, EXCLUDED.state_code),
        updated_at = now()
    `, [u.id, displayName, u.email, phone, region, stateCode, status, u.created_at]);

    // Role assignments
    if (accountType === 'CUSTOMER') {
      await client.query(`
        INSERT INTO public.app_role_assignments (user_id, role)
        VALUES ($1, 'CUSTOMER')
        ON CONFLICT (user_id, role) DO NOTHING
      `, [u.id]);
    } else {
      await client.query(`
        INSERT INTO public.app_role_assignments (user_id, role)
        VALUES ($1, 'EMPLOYEE')
        ON CONFLICT (user_id, role) DO NOTHING
      `, [u.id]);
      if (['field_worker', 'on_field', 'FIELD_WORKER'].includes(subRole)) {
        await client.query(`
          INSERT INTO public.app_role_assignments (user_id, role)
          VALUES ($1, 'FIELD_WORKER')
          ON CONFLICT (user_id, role) DO NOTHING
        `, [u.id]);
      }
    }
  }

  console.log('✓ All auth users synchronized with app_profiles and roles.');

  // 3. Query Pending workers for Manager / Admin
  const pending = await client.query(`
    SELECT p.id, p.display_name, p.email, p.phone, p.region, p.state_code, p.account_status,
           COALESCE((SELECT string_agg(r.role, ',') FROM app_role_assignments r WHERE r.user_id = p.id), '') as roles
    FROM public.app_profiles p
    WHERE p.account_status = 'PENDING'
    ORDER BY p.created_at DESC
  `);

  console.log('\n--- Current PENDING Workers waiting for Approval ---');
  console.table(pending.rows);

  await client.end();
}

run().catch(err => {
  console.error('Sync error:', err);
  process.exit(1);
});

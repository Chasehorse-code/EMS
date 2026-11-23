import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Updating handle_new_auth_user trigger with EMP ID generation...');
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
        v_seq BIGINT;
        v_display_id TEXT;
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
        
        IF UPPER(v_account_type) = 'CUSTOMER' THEN
            v_status := 'ACTIVE';
        ELSE
            v_status := 'PENDING';
        END IF;

        -- Generate EMP display ID atomically
        UPDATE id_counters
        SET current_value = current_value + 1, updated_at = now()
        WHERE prefix = 'EMP'
        RETURNING current_value INTO v_seq;

        IF v_seq IS NULL THEN
            INSERT INTO id_counters (prefix, current_value, updated_at)
            VALUES ('EMP', 1, now())
            ON CONFLICT (prefix) DO UPDATE SET current_value = id_counters.current_value + 1, updated_at = now()
            RETURNING current_value INTO v_seq;
        END IF;
        v_display_id := 'EMP' || LPAD(v_seq::TEXT, 3, '0');

        -- Insert into app_profiles with display_id
        INSERT INTO public.app_profiles (id, display_id, display_name, email, phone, region, state_code, account_status, created_at, updated_at)
        VALUES (NEW.id, v_display_id, v_display_name, NEW.email, v_phone, v_region, v_state_code, v_status, now(), now())
        ON CONFLICT (id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            email = EXCLUDED.email,
            phone = COALESCE(public.app_profiles.phone, EXCLUDED.phone),
            region = COALESCE(public.app_profiles.region, EXCLUDED.region),
            state_code = COALESCE(public.app_profiles.state_code, EXCLUDED.state_code),
            display_id = COALESCE(public.app_profiles.display_id, EXCLUDED.display_id),
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

        NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
  console.log('✓ Trigger updated successfully with atomic EMP display ID generation.');
  await client.end();
}

run().catch(console.error);

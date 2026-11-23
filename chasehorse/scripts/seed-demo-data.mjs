process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  // 1. Apply V3 standard checklists
  console.log('Applying V3 standard checklists...');
  const v3Sql = fs.readFileSync('backend/erp-api/src/main/resources/db/migration/V3__standard_checklists.sql', 'utf8');
  await client.query(v3Sql);
  console.log('✓ V3 applied.');

  // 2. Apply V4 support tickets
  console.log('Applying V4 support tickets schema...');
  const v4Sql = fs.readFileSync('backend/erp-api/src/main/resources/db/migration/V4__support_tickets.sql', 'utf8');
  await client.query(v4Sql);
  console.log('✓ V4 applied.');

  // 3. Apply V5 manager assignment and feedback
  console.log('Applying V5 manager assignment and feedback...');
  const v5Sql = fs.readFileSync('backend/erp-api/src/main/resources/db/migration/V5__manager_assignment_and_feedback.sql', 'utf8');
  // Handle policy conflicts gracefully in V5 if policies already exist
  try {
    await client.query(v5Sql);
    console.log('✓ V5 applied.');
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('✓ V5 already partially applied, continuing...');
    } else {
      console.warn('V5 warning:', err.message);
    }
  }

  // 4. Apply V6 area based manager access
  console.log('Applying V6 area based manager access...');
  const v6Sql = fs.readFileSync('backend/erp-api/src/main/resources/db/migration/V6__area_based_manager_access.sql', 'utf8');
  try {
    await client.query(v6Sql);
    console.log('✓ V6 applied.');
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('✓ V6 already partially applied, continuing...');
    } else {
      console.warn('V6 warning:', err.message);
    }
  }

  // Demo user IDs
  const adminId = '458b3def-3938-4075-bcdd-deb4b0e8755d';      // admindemo@chasehorse.com
  const opsId = 'e341c66d-86ca-49f0-8925-6939f7cc0d36';        // opsdemo@chasehorse.com
  const workerId = 'ca9cbb61-edb0-4004-98e0-d2dc6e5b16d9';     // workerdemo@chasehorse.com
  const customerId = '82f6f07e-b78b-4bde-bf87-6999498e49e6';   // customerdemo@chasehorse.com

  // Set manager area for opsdemo to AP
  await client.query(`
    INSERT INTO manager_areas (manager_id, state_code, assigned_by)
    VALUES ($1, 'AP', $2)
    ON CONFLICT (manager_id) DO UPDATE SET state_code = 'AP'
  `, [opsId, adminId]).catch(e => console.log('manager_areas notice:', e.message));

  // Set state_code on demo profiles
  await client.query(`UPDATE app_profiles SET state_code = 'AP' WHERE id IN ($1, $2, $3, $4)`,
    [adminId, opsId, workerId, customerId]
  ).catch(e => console.log('state_code notice:', e.message));

  // Ensure customer has manager or region set
  await client.query(`UPDATE app_profiles SET manager_id = $1 WHERE id = $2`, [opsId, workerId])
    .catch(e => console.log('worker manager notice:', e.message));

  console.log('Seeding 3 realistic demo tasks...');

  const task1Id = 'a1111111-1111-4000-8000-000000000001';
  const task2Id = 'a2222222-2222-4000-8000-000000000002';
  const task3Id = 'a3333333-3333-4000-8000-000000000003';

  // Task 1: Retail Shelf Audit (OPEN)
  await client.query(`
    INSERT INTO tasks (
      id, title, description, category, status, priority,
      created_by, assigned_to, customer_id, checklist_template_id,
      location_lat, location_lng, location_area, location_address,
      due_at, reward_amount, currency, state_code, created_at, updated_at
    ) VALUES (
      $1,
      'Retail Shelf Audit & Planogram Verification',
      'Conduct complete audit of consumer beverage shelf placement, count SKU facings, verify price tags, and document endcap display compliance.',
      'Shelf audit',
      'OPEN',
      'HIGH',
      $2, NULL, $3, '11111111-1111-1111-1111-111111111111',
      16.2437000, 80.6400000,
      'Tenali Market Road, Guntur',
      'Shop #14, Main Bazaar Rd, Tenali, Andhra Pradesh 522201',
      now() + interval '2 days',
      450.00, 'INR', 'AP', now() - interval '2 hours', now()
    ) ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      priority = EXCLUDED.priority,
      reward_amount = EXCLUDED.reward_amount,
      updated_at = now()
  `, [task1Id, adminId, customerId]);

  // Task 2: Cold Storage Temperature & Equipment (IN_PROGRESS, Assigned to worker)
  await client.query(`
    INSERT INTO tasks (
      id, title, description, category, status, priority,
      created_by, assigned_to, customer_id, checklist_template_id,
      location_lat, location_lng, location_area, location_address,
      due_at, reward_amount, currency, state_code, created_at, updated_at
    ) VALUES (
      $1,
      'Cold Storage Temperature Log & Equipment Inspection',
      'Inspect cold storage unit #3 compressor valves, scan asset barcode, record digital temperature gauge reading, and verify door gasket air seal.',
      'Equipment inspection',
      'IN_PROGRESS',
      'URGENT',
      $2, $3, $4, '44444444-4444-4444-4444-444444444444',
      16.5062000, 80.6480000,
      'Autonagar Logistics Park, Vijayawada',
      'Plot 42, Block C, Autonagar Industrial Area, Vijayawada, AP 520007',
      now() + interval '1 day',
      750.00, 'INR', 'AP', now() - interval '1 day', now()
    ) ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      priority = EXCLUDED.priority,
      assigned_to = EXCLUDED.assigned_to,
      reward_amount = EXCLUDED.reward_amount,
      updated_at = now()
  `, [task2Id, adminId, workerId, customerId]);

  // Task 2 Assignment history
  await client.query(`
    INSERT INTO task_assignments (id, task_id, employee_id, action, created_at)
    VALUES (gen_random_uuid(), $1, $2, 'ACCEPTED', now() - interval '18 hours')
    ON CONFLICT DO NOTHING
  `, [task2Id, workerId]);

  // Task 3: Consignment Delivery Proof (SUBMITTED / IN_REVIEW)
  await client.query(`
    INSERT INTO tasks (
      id, title, description, category, status, priority,
      created_by, assigned_to, customer_id, checklist_template_id,
      location_lat, location_lng, location_area, location_address,
      due_at, reward_amount, currency, state_code, created_at, updated_at
    ) VALUES (
      $1,
      'Consignment Delivery Proof & Signage Verification',
      'Verify pharmaceutical cold-chain consignment parcel condition, capture doorstep photos, confirm tamper-evident seal, and obtain warehouse receiver signature.',
      'Delivery proof',
      'SUBMITTED',
      'NORMAL',
      $2, $3, $4, '55555555-5555-5555-5555-555555555555',
      16.5193000, 80.6305000,
      'MG Road Commercial Hub, Vijayawada',
      'Distribution Hub 3, MG Road, Vijayawada, Andhra Pradesh 520010',
      now() + interval '6 hours',
      500.00, 'INR', 'AP', now() - interval '2 days', now()
    ) ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      priority = EXCLUDED.priority,
      assigned_to = EXCLUDED.assigned_to,
      reward_amount = EXCLUDED.reward_amount,
      updated_at = now()
  `, [task3Id, adminId, workerId, customerId]);

  // Task 3 Assignment history
  await client.query(`
    INSERT INTO task_assignments (id, task_id, employee_id, action, created_at)
    VALUES (gen_random_uuid(), $1, $2, 'ACCEPTED', now() - interval '30 hours')
    ON CONFLICT DO NOTHING
  `, [task3Id, workerId]);

  // Task 3 Checklist item results & Evidence
  const checklistItems = await client.query(
    `SELECT id, label FROM checklist_items WHERE template_id = '55555555-5555-5555-5555-555555555555' ORDER BY sort_order`
  );
  for (const item of checklistItems.rows) {
    await client.query(`
      INSERT INTO task_checklist_results (id, task_id, checklist_item_id, completed, photo_attached, completed_at)
      VALUES (gen_random_uuid(), $1, $2, true, true, now() - interval '2 hours')
      ON CONFLICT (task_id, checklist_item_id) DO UPDATE SET completed = true, photo_attached = true
    `, [task3Id, item.id]);
  }

  // Task 3 Evidence photo
  const evidenceRes = await client.query(`
    INSERT INTO task_evidence (
      id, task_id, submitted_by, storage_path, file_name, content_type,
      file_size_bytes, caption, location_lat, location_lng, verification_status, created_at
    ) VALUES (
      gen_random_uuid(), $1, $2,
      'evidence/consignment_dock_3.jpg', 'consignment_dock_3.jpg', 'image/jpeg',
      245890, 'Consignment delivered at Loading Dock 3 with intact tamper seal',
      16.5193000, 80.6305000, 'PENDING', now() - interval '2 hours'
    ) RETURNING id
  `, [task3Id, workerId]);

  // AI Verification for the evidence
  if (evidenceRes.rows.length > 0) {
    await client.query(`
      INSERT INTO ai_verifications (evidence_id, status, confidence, summary, run_at)
      VALUES ($1, 'PASSED', 0.942, 'AI scan detected shipping container barcode, intact blue security seal, and warehouse dock background with 94.2% match confidence.', now() - interval '1 hour')
      ON CONFLICT DO NOTHING
    `, [evidenceRes.rows[0].id]);
  }

  console.log('✓ 3 Tasks seeded successfully.');

  // Seeding Support Tickets
  console.log('Seeding demo support tickets...');

  const ticket1Id = 'b1111111-1111-4000-8000-000000000001';
  const ticket2Id = 'b2222222-2222-4000-8000-000000000002';
  const ticket3Id = 'b3333333-3333-4000-8000-000000000003';

  // Ticket 1: GPS Geofence delay (OPEN, HIGH, linked to Task 1)
  await client.query(`
    INSERT INTO support_tickets (
      id, ticket_number, customer_id, assigned_to, related_task_id,
      subject, category, urgency, status, region, state_code, created_at, updated_at
    ) VALUES (
      $1, 'TICK-1001', $2, $3, $4,
      'GPS Geofence sync delay on Tenali Site #14',
      'OPERATIONS', 'HIGH', 'OPEN', 'South Region', 'AP',
      now() - interval '5 hours', now() - interval '1 hour'
    ) ON CONFLICT (id) DO UPDATE SET
      subject = EXCLUDED.subject,
      status = EXCLUDED.status,
      urgency = EXCLUDED.urgency,
      assigned_to = EXCLUDED.assigned_to,
      updated_at = now()
  `, [ticket1Id, customerId, opsId, task1Id]);

  await client.query(`
    INSERT INTO support_ticket_comments (id, ticket_id, author_id, author_name, message, is_internal, created_at)
    VALUES (
      gen_random_uuid(), $1, $2, 'Customer Demo',
      'Field worker reported that GPS coordinates had a 15m drift near the sheltered storefront. Please confirm if 20m tolerance is acceptable for check-in.',
      false, now() - interval '5 hours'
    ) ON CONFLICT DO NOTHING
  `, [ticket1Id, customerId]);

  await client.query(`
    INSERT INTO support_ticket_comments (id, ticket_id, author_id, author_name, message, is_internal, created_at)
    VALUES (
      gen_random_uuid(), $1, $2, 'Operations Manager Demo',
      'Investigating satellite signal interference in Tenali Main Bazaar. We have adjusted geofence radius to 25m for this location.',
      false, now() - interval '1 hour'
    ) ON CONFLICT DO NOTHING
  `, [ticket1Id, opsId]);

  // Ticket 2: Photo upload timeout (IN_PROGRESS, NORMAL, linked to Task 2)
  await client.query(`
    INSERT INTO support_tickets (
      id, ticket_number, customer_id, assigned_to, related_task_id,
      subject, category, urgency, status, region, state_code, created_at, updated_at
    ) VALUES (
      $1, 'TICK-1002', $2, $3, $4,
      'Checklist photo upload timeout on low bandwidth 4G',
      'TECHNICAL', 'NORMAL', 'IN_PROGRESS', 'South Region', 'AP',
      now() - interval '1 day', now() - interval '3 hours'
    ) ON CONFLICT (id) DO UPDATE SET
      subject = EXCLUDED.subject,
      status = EXCLUDED.status,
      urgency = EXCLUDED.urgency,
      assigned_to = EXCLUDED.assigned_to,
      updated_at = now()
  `, [ticket2Id, customerId, adminId, task2Id]);

  await client.query(`
    INSERT INTO support_ticket_comments (id, ticket_id, author_id, author_name, message, is_internal, created_at)
    VALUES (
      gen_random_uuid(), $1, $2, 'Customer Demo',
      'Compressor inspection high-resolution photo took over 30s to upload in the warehouse basement.',
      false, now() - interval '1 day'
    ) ON CONFLICT DO NOTHING
  `, [ticket2Id, customerId]);

  await client.query(`
    INSERT INTO support_ticket_comments (id, ticket_id, author_id, author_name, message, is_internal, created_at)
    VALUES (
      gen_random_uuid(), $1, $2, 'Platform Admin',
      'Offline sync cache enabled in mobile app v0.1.0 with automatic background retry and WebP image compression.',
      false, now() - interval '3 hours'
    ) ON CONFLICT DO NOTHING
  `, [ticket2Id, adminId]);

  // Ticket 3: Payout settlement query (RESOLVED, LOW, linked to Task 3)
  await client.query(`
    INSERT INTO support_tickets (
      id, ticket_number, customer_id, assigned_to, related_task_id,
      subject, category, urgency, status, region, state_code, created_at, updated_at, resolved_at
    ) VALUES (
      $1, 'TICK-1003', $2, $3, $4,
      'Payout settlement query for consignment delivery',
      'ACCOUNT', 'LOW', 'RESOLVED', 'South Region', 'AP',
      now() - interval '2 days', now() - interval '4 hours', now() - interval '4 hours'
    ) ON CONFLICT (id) DO UPDATE SET
      subject = EXCLUDED.subject,
      status = EXCLUDED.status,
      urgency = EXCLUDED.urgency,
      assigned_to = EXCLUDED.assigned_to,
      resolved_at = now() - interval '4 hours',
      updated_at = now()
  `, [ticket3Id, customerId, opsId, task3Id]);

  await client.query(`
    INSERT INTO support_ticket_comments (id, ticket_id, author_id, author_name, message, is_internal, created_at)
    VALUES (
      gen_random_uuid(), $1, $2, 'Customer Demo',
      'Can you confirm when the ₹500 task reward will be reconciled in the wallet balance?',
      false, now() - interval '2 days'
    ) ON CONFLICT DO NOTHING
  `, [ticket3Id, customerId]);

  await client.query(`
    INSERT INTO support_ticket_comments (id, ticket_id, author_id, author_name, message, is_internal, created_at)
    VALUES (
      gen_random_uuid(), $1, $2, 'Operations Manager Demo',
      'Settlement verified. Reward of ₹500 credited to ledger ID WLT-7829 upon task approval. Ticket marked resolved.',
      false, now() - interval '4 hours'
    ) ON CONFLICT DO NOTHING
  `, [ticket3Id, opsId]);

  console.log('✓ 3 Support tickets seeded successfully.');

  // Verify counts
  const finalTasks = await client.query('SELECT id, title, status, priority, reward_amount FROM tasks');
  console.log('--- Final Tasks in Database ---');
  console.table(finalTasks.rows);

  const finalTickets = await client.query('SELECT ticket_number, subject, status, urgency, category FROM support_tickets');
  console.log('--- Final Tickets in Database ---');
  console.table(finalTickets.rows);

  await client.end();
  console.log('Database seeding complete!');
}

run().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});

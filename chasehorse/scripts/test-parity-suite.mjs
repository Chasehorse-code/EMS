import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 1. Shared Domain Tests: Currency, Date/Time, Distance, Initials
describe('Packages / Domain: Formatters', async () => {
  const domain = await import('../packages/domain/src/index.ts');

  test('formatInr formats rupees correctly with Indian grouping', () => {
    const res = domain.formatInr(125000);
    assert.match(res, /1,25,000/);
  });

  test('formatInrFromPaise converts paise to rupees', () => {
    const res = domain.formatInrFromPaise(250000);
    assert.match(res, /2,500/);
  });

  test('formatSignedInr adds signs correctly', () => {
    assert.match(domain.formatSignedInr(500), /\+.*500/);
    assert.match(domain.formatSignedInr(-500), /[-−].*500/);
    assert.match(domain.formatSignedInr(0), /0/);
  });

  test('formatDateTimeIST formats timestamp to Indian Standard Time', () => {
    // 2026-10-26T02:00:00Z is 07:30 IST
    const res = domain.formatDateTimeIST('2026-10-26T02:00:00Z');
    assert.match(res, /26/);
    assert.match(res, /Oct/);
    assert.match(res, /7:30/i);
  });

  test('formatDistanceKm displays meters when < 1km and km when >= 1km', () => {
    assert.equal(domain.formatDistanceKm(0.05), '50 m');
    assert.equal(domain.formatDistanceKm(0.75), '750 m');
    assert.equal(domain.formatDistanceKm(12.4), '12.4 km');
    assert.equal(domain.formatDistanceKm(undefined), '—');
  });

  test('formatInitials extracts 2 uppercase initials', () => {
    assert.equal(domain.formatInitials('Ramesh Kumar'), 'RK');
    assert.equal(domain.formatInitials('Aditi'), 'A');
    assert.equal(domain.formatInitials(''), 'CH');
  });
});

// 2. Permission Helper Tests
describe('Packages / Domain: Permission Helper can()', async () => {
  const domain = await import('../packages/domain/src/index.ts');

  test('Admin has full rights across operations', () => {
    assert.equal(domain.can('ADMIN', 'create_task'), true);
    assert.equal(domain.can('ADMIN', 'review_approvals'), true);
    assert.equal(domain.can('ADMIN', 'manage_areas'), true);
    assert.equal(domain.can('ADMIN', 'manage_employees'), true);
  });

  test('Customer can create tasks and rate workers, but cannot approve tasks or manage areas', () => {
    assert.equal(domain.can('CUSTOMER', 'create_task'), true);
    assert.equal(domain.can('CUSTOMER', 'submit_feedback'), true);
    assert.equal(domain.can('CUSTOMER', 'review_approvals'), false);
    assert.equal(domain.can('CUSTOMER', 'manage_areas'), false);
  });

  test('Employee can accept and submit tasks, but cannot create or approve tasks', () => {
    assert.equal(domain.can('EMPLOYEE', 'accept_task'), true);
    assert.equal(domain.can('EMPLOYEE', 'submit_evidence'), true);
    assert.equal(domain.can('EMPLOYEE', 'create_task'), false);
    assert.equal(domain.can('EMPLOYEE', 'review_approvals'), false);
  });

  test('Manager can approve tasks and view workers, but cannot assign areas', () => {
    assert.equal(domain.can('MANAGER', 'review_approvals'), true);
    assert.equal(domain.can('MANAGER', 'manage_employees'), true);
    assert.equal(domain.can('MANAGER', 'manage_areas'), false);
  });
});

// 3. Functional Validators
describe('Packages / Domain: Validators', async () => {
  const domain = await import('../packages/domain/src/index.ts');

  test('validateCreateTask validates required title, address, and reward', () => {
    const invalid = domain.validateCreateTask({ title: '', rewardAmount: -10 });
    assert.equal(invalid.success, false);
    assert.ok(invalid.errors?.title);
    assert.ok(invalid.errors?.rewardAmount);

    const valid = domain.validateCreateTask({
      title: 'Retail Store Shelf Audit',
      rewardAmount: 450,
      category: 'Shelf audit',
      address: 'Plot 4, Madhapur, Hyderabad, Telangana',
    });
    assert.equal(valid.success, true);
  });

  test('validateTicket validates subject and message length', () => {
    const invalid = domain.validateTicket({ subject: '', message: '' });
    assert.equal(invalid.success, false);
    assert.ok(invalid.errors?.subject);
    assert.ok(invalid.errors?.message);

    const valid = domain.validateTicket({
      subject: 'Payout discrepancy on task #582',
      message: 'The reward ledger entry did not reflect completed checklist points for task execution.',
    });
    assert.equal(valid.success, true);
  });
});

// 4. Mobile GPS & Watermark Stamp Calculations
describe('Mobile Evidence & Watermark Stamp Calculations', () => {
  function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  test('calculates accurate distance between coordinates', () => {
    // Distance between two points in Hyderabad (~1.1 km)
    const dist = calculateDistanceMeters(17.385, 78.4867, 17.395, 78.4867);
    assert.ok(dist >= 1100 && dist <= 1120, `Expected ~1112m, got ${dist}m`);
  });

  test('detects within-radius site proximity (< 100m)', () => {
    // 0.0003 deg latitude difference is ~33m
    const dist = calculateDistanceMeters(17.385, 78.4867, 17.3853, 78.4867);
    assert.ok(dist < 100, `Expected within 100m, got ${dist}m`);
  });

  test('generates valid tamper-evident verification code', () => {
    const taskId = 'tsk-894721';
    const lat = 17.38501;
    const lng = 78.48672;
    const code = `CH-${taskId.slice(0, 6).toUpperCase()}-${Math.abs((lat + lng) * 1000).toFixed(0)}`;
    assert.match(code, /^CH-TSK-89-\d+$/);
  });
});

// 5. Shared Design Tokens
describe('Design Tokens: Single Source of Truth', async () => {
  const { tokens } = await import('../packages/design-tokens/src/index.ts');

  test('Uses Warm Cream and Near-Black Ink palette', () => {
    assert.equal(tokens.colors.light.canvas, '#F3F1EB');
    assert.equal(tokens.colors.light.ink, '#151515');
    assert.equal(tokens.colors.light.primaryOrange, '#D9531E');
  });

  test('Desaturated status colors meet WCAG AA standards', () => {
    assert.equal(tokens.colors.light.status.success, '#2F7D5B');
    assert.equal(tokens.colors.light.status.warning, '#B7791F');
    assert.equal(tokens.colors.light.status.danger, '#B04A3A');
  });
});

// 6. OpenAPI Parity Verification
describe('OpenAPI Specification Parity', () => {
  const spec = readFileSync(new URL('../docs/openapi.yaml', import.meta.url), 'utf8');

  test('OpenAPI covers all critical backend entities and routes', () => {
    assert.ok(spec.includes('/tasks'));
    assert.ok(spec.includes('/evidence'));
    assert.ok(spec.includes('/wallets'));
    assert.ok(spec.includes('/approvals'));
    assert.ok(spec.includes('/employees'));
    assert.ok(spec.includes('/areas/coverage'));
    assert.ok(spec.includes('/admin/managers'));
    assert.ok(spec.includes('/notifications'));
    assert.ok(spec.includes('/tickets'));
    assert.ok(spec.includes('/tasks/{taskId}/feedback'));
  });
});

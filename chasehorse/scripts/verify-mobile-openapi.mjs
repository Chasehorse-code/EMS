import { readFileSync } from 'node:fs';

const spec = readFileSync(new URL('../docs/openapi.yaml', import.meta.url), 'utf8');

// These are the normalized route templates used by apps/mobile/src/api/restApi.ts.
// Parameter names may differ between the client and OpenAPI; only path shape
// matters for this guard.
const requiredRoutes = [
  '/employees/me/location',
  '/tickets',
  '/tickets/{id}/comments',
  '/tasks',
  '/tasks/{id}/accept',
  '/tasks/{id}/status',
  '/tasks/{taskId}/feedback',
  '/evidence',
  '/evidence/{id}/manager-decision',
  '/wallets/{employeeId}',
  '/wallets/{employeeId}/transactions',
  '/tms/tracking/{bookingRef}',
  '/tms/plans',
  '/tms/shipments',
  '/dashboard/stats',
  '/checklist-templates',
  '/checklist-templates/{id}',
  '/approvals',
  '/approvals/{id}/decision',
  '/employees',
  '/employees/{id}/approval',
  '/employees/{employeeId}/feedback',
  '/profiles/me',
  '/notifications',
  '/notifications/{id}/read',
  '/notifications/mark-all-read',
  '/areas/my-area',
  '/areas/states',
  '/areas/coverage',
  '/admin/managers',
  '/admin/managers/{managerId}/area',
];

const toShape = (route) => route.replace(/\{[^}]+\}/g, '{}');
const documented = [...spec.matchAll(/^  (\/[^:]+):$/gm)].map((match) => toShape(match[1]));
const missing = requiredRoutes.filter((route) => !documented.includes(toShape(route)));

if (missing.length) {
  throw new Error(`Mobile API routes missing from docs/openapi.yaml: ${missing.join(', ')}`);
}

console.log(`Verified ${requiredRoutes.length} mobile API route templates against docs/openapi.yaml.`);

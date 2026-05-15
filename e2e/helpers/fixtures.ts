/**
 * Test fixtures — stable test accounts expected to exist in the test DB.
 * These should be seeded before running E2E tests.
 */

export const TEST_USERS = {
  pm: {
    username: 'test_pm',
    password: 'password123',
    name: 'Test PM',
    role: 'pm',
  },
  contributor: {
    username: 'test_contributor',
    password: 'password123',
    name: 'Test Contributor',
    role: 'contributor',
  },
  admin: {
    username: 'test_admin',
    password: 'password123',
    name: 'Test Admin',
    role: 'contributor', // registered as contributor, promoted to admin separately
  },
};

// Unique suffix to avoid collisions between parallel test runs
export function uniqueSuffix(): string {
  return Date.now().toString(36);
}

export function testProjectName(suffix?: string): string {
  return `E2E Project ${suffix ?? uniqueSuffix()}`;
}

export function testDeliverableTitle(suffix?: string): string {
  return `E2E Deliverable ${suffix ?? uniqueSuffix()}`;
}

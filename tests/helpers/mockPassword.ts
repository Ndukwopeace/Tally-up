/**
 * The password every mock user has during a test run.
 *
 * WHY:  Tests sign in to the mock backend, so they need its password, but no
 *       password should be written in the code (SonarCloud hard-coded
 *       credential rule, SEC-3 spirit).
 * HOW:  A new random value each time the test process starts.
 * WHEN: Imported by tests that build a MockAuthService or sign in.
 * SECURITY: Test-only and random; it protects nothing real.
 */
export const MOCK_PASSWORD = crypto.randomUUID();

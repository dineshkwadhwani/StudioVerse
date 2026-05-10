/**
 * Emulator connection constants & helpers.
 * Tests assume the Firebase emulator suite is running locally
 * (start with `npm run emulator`).
 */

export const EMULATOR_HOST = "127.0.0.1";
export const FIRESTORE_EMULATOR_PORT = 8080;
export const AUTH_EMULATOR_PORT = 9099;
export const STORAGE_EMULATOR_PORT = 9199;
export const FUNCTIONS_EMULATOR_PORT = 5001;

export const TEST_PROJECT_ID = "studioverse-test-local";

export function isEmulatorReachable(): Promise<boolean> {
  return fetch(`http://${EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}/`)
    .then((r) => r.ok || r.status === 200 || r.status === 404)
    .catch(() => false);
}

/**
 * Test data seed helpers — populated as tests are added.
 *
 * Each helper is idempotent: calling it twice with the same args
 * should produce the same result. This lets tests share fixtures
 * without fighting over state.
 *
 * Phase 0: skeleton only. Real implementations land in Phase 1
 * when the first wallet/auth tests are written.
 */

import type { Firestore } from "firebase/firestore";

export interface SeedTenantArgs {
  tenantId: string;
  slug: string;
  name: string;
}

export async function seedTenant(_db: Firestore, _args: SeedTenantArgs): Promise<void> {
  throw new Error("seedTenant: not yet implemented (Phase 1)");
}

export interface SeedUserArgs {
  uid: string;
  tenantId: string;
  userType: "superadmin" | "company" | "professional" | "individual";
  associatedCompanyId?: string;
  associatedProfessionalId?: string;
}

export async function seedUser(_db: Firestore, _args: SeedUserArgs): Promise<void> {
  throw new Error("seedUser: not yet implemented (Phase 1)");
}

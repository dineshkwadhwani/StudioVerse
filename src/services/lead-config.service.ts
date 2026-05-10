import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { LeadKind } from "@/types/lead";

export type TenantLeadConfig = {
  enableCompanyLead: boolean;
  enableCoachLead: boolean;
  enableIndividualLead: boolean;
  companyLeadFee: number;
  coachLeadFee: number;
  individualLeadFee: number;
};

const DEFAULT_LEAD_CONFIG: TenantLeadConfig = {
  enableCompanyLead: false,
  enableCoachLead: false,
  enableIndividualLead: false,
  companyLeadFee: 0,
  coachLeadFee: 0,
  individualLeadFee: 0,
};

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export async function getTenantLeadConfig(tenantId: string): Promise<TenantLeadConfig> {
  const trimmed = tenantId.trim();
  if (!trimmed) return DEFAULT_LEAD_CONFIG;

  const snap = await getDoc(doc(db, "tenants", trimmed));
  const cfg = snap.data()?.leadConfig as Partial<TenantLeadConfig> | undefined;
  if (!cfg) return DEFAULT_LEAD_CONFIG;

  return {
    enableCompanyLead: Boolean(cfg.enableCompanyLead),
    enableCoachLead: Boolean(cfg.enableCoachLead),
    enableIndividualLead: Boolean(cfg.enableIndividualLead),
    companyLeadFee: toSafeNumber(cfg.companyLeadFee),
    coachLeadFee: toSafeNumber(cfg.coachLeadFee),
    individualLeadFee: toSafeNumber(cfg.individualLeadFee),
  };
}

// Resolves the unlock fee for a viewer paying to unlock a target lead within a tenant.
// Toggle OFF => fee is 0 (always unlocked / free).
export function resolveLeadUnlockFee(
  config: TenantLeadConfig,
  leadKind: LeadKind,
): number {
  if (leadKind === "individual") {
    return config.enableIndividualLead ? config.individualLeadFee : 0;
  }
  if (leadKind === "coach") {
    return config.enableCoachLead ? config.coachLeadFee : 0;
  }
  return config.enableCompanyLead ? config.companyLeadFee : 0;
}

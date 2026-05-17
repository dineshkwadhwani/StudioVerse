// Static config for available seed scripts per tenant

export type SeedScriptConfig = {
  id: string;
  displayName: string;
  description: string;
  tenants: string[]; // e.g. ["coaching-studio", "training-studio"]
  callableName: string; // Firebase function name
};

export const SEED_SCRIPTS: SeedScriptConfig[] = [
  {
    id: "languages",
    displayName: "Languages",
    description: "Seed 30 major languages for dropdowns.",
    tenants: ["coaching-studio", "training-studio", "recruitment-studio"],
    callableName: "seedLanguages",
  },
  {
    id: "taxonomy",
    displayName: "Taxonomy",
    description: "Seed categories, subcategories, and topics.",
    tenants: ["coaching-studio", "training-studio"],
    callableName: "seedTaxonomyFromXlsx",
  },
  {
    id: "earningPackages",
    displayName: "Credit Packages",
    description: "Seed credit packages (coins) for the tenant.",
    tenants: ["coaching-studio"],
    callableName: "seedCreditPackages",
  },
  {
    id: "listingPackages",
    displayName: "Listing Packages",
    description: "Seed free listing packages for program, assessment, and event.",
    tenants: ["coaching-studio"],
    callableName: "seedListingPackages",
  },
  {
    id: "promotionPackages",
    displayName: "Promotion Packages",
    description: "Seed free promotion packages for program, assessment, and event.",
    tenants: ["coaching-studio"],
    callableName: "seedPromotionPackages",
  },
  {
    id: "botPackages",
    displayName: "Bot Hero Packages",
    description: "Seed free bot hero packages for the tenant.",
    tenants: ["coaching-studio"],
    callableName: "seedBotPackages",
  },
  {
    id: "leadPackages",
    displayName: "Lead Packages",
    description: "Seed lead packages (company, coach, individual) for the tenant.",
    tenants: ["coaching-studio"],
    callableName: "seedLeadPackages",
  },
];

export const SEED_TENANTS = [
  { id: "coaching-studio", label: "Coaching Studio" },
  { id: "training-studio", label: "Training Studio" },
  { id: "recruitment-studio", label: "Recruitment Studio" },
];

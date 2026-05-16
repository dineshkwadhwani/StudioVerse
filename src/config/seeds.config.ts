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
    displayName: "Earning Packages",
    description: "Seed credit, listing, and bot hero packages.",
    tenants: ["coaching-studio"],
    callableName: "seedEarningPackages",
  },
  // Add more scripts as needed
];

export const SEED_TENANTS = [
  { id: "coaching-studio", label: "Coaching Studio" },
  { id: "training-studio", label: "Training Studio" },
  { id: "recruitment-studio", label: "Recruitment Studio" },
];

export const INDIAN_LANGUAGES = [
  "Hindi",
  "Bengali",
  "Telugu",
  "Marathi",
  "Tamil",
  "Gujarati",
  "Urdu",
  "Kannada",
  "Odia",
  "Malayalam",
] as const;

export const INTERNATIONAL_LANGUAGES = [
  "English",
  "Mandarin Chinese",
  "Spanish",
  "French",
  "Arabic",
  "Portuguese",
  "Russian",
  "German",
  "Japanese",
  "Korean",
] as const;

export const LANGUAGE_OPTIONS = [
  ...INDIAN_LANGUAGES,
  ...INTERNATIONAL_LANGUAGES,
  "Other",
] as const;

export const COMPETENCY_OPTIONS = [
  "Leadership",
  "Executive Presence",
  "Communication",
  "Strategic Thinking",
  "People Management",
  "Conflict Resolution",
  "Decision Making",
  "Emotional Intelligence",
  "Career Transitions",
  "Change Management",
  "Stakeholder Management",
  "Productivity",
  "Resilience",
  "Public Speaking",
  "Negotiation",
  "Other",
] as const;

export const INDUSTRY_OPTIONS = [
  "Technology",
  "Banking & Financial Services",
  "Healthcare & Pharma",
  "Manufacturing",
  "Retail & E-commerce",
  "Education",
  "Consulting",
  "Media & Entertainment",
  "Telecom",
  "Energy & Utilities",
  "Public Sector / Government",
  "Non-Profit / Social Impact",
  "Hospitality & Travel",
  "Real Estate",
  "Other",
] as const;

export const TARGET_AUDIENCE_OPTIONS = [
  "Students",
  "Early Career Professionals",
  "Individual Contributors",
  "First-time Managers",
  "Mid-level Managers",
  "Senior Leaders",
  "Executives / CXOs",
  "Entrepreneurs / Founders",
  "Career Returnees",
  "Women Leaders",
  "Sales Professionals",
  "Tech Professionals",
  "HR / People Managers",
  "Cross-functional Teams",
  "Other",
] as const;

export const COACHING_METHOD_OPTIONS = [
  "GROW Model",
  "Solution-Focused Coaching",
  "Cognitive Behavioral Coaching",
  "Strengths-Based Coaching",
  "Transformational Coaching",
  "Behavioral Coaching",
  "Design Thinking Coaching",
  "Mindfulness-Based Coaching",
  "Narrative Coaching",
  "Systems Coaching",
  "Positive Psychology Coaching",
  "Neuro-Linguistic Programming (NLP)",
  "Other",
] as const;

export const SERVICE_PROVIDED_OPTIONS = [
  "1-1 Coaching",
  "Online Coaching",
  "Offline Coaching",
  "Group Coaching",
  "Cohort Coaching",
  "Other",
] as const;

export const PURPOSE_OPTIONS = [
  "Career Growth",
  "Leadership Development",
  "Role Transition",
  "Performance Improvement",
  "Confidence Building",
  "Communication Improvement",
  "Work-life Balance",
  "Entrepreneurial Growth",
  "Team Management",
  "Other",
] as const;

export const EXPERIENCE_LEVEL_OPTIONS = [
  "Entry Level (0-2 years)",
  "Early Professional (3-5 years)",
  "Mid Professional (6-10 years)",
  "Senior Professional (11-15 years)",
  "Leadership (16+ years)",
] as const;

export const EXPERTISE_LEVEL_OPTIONS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;

export const HIGHEST_DEGREE_OPTIONS = [
  "High School",
  "Diploma",
  "Bachelor's",
  "Master's",
  "MBA",
  "Doctorate (PhD)",
  "Professional Degree",
  "Other",
] as const;

export const FIELD_OF_STUDY_OPTIONS = [
  "Business & Management",
  "Computer Science / IT",
  "Engineering",
  "Finance & Accounting",
  "Economics",
  "Psychology",
  "Human Resources",
  "Education",
  "Healthcare",
  "Arts & Humanities",
  "Law",
  "Other",
] as const;

export const EXPERIENCE_YEARS_OPTIONS = [
  "0-2 years",
  "3-5 years",
  "6-10 years",
  "11-15 years",
  "16-20 years",
  "20+ years",
] as const;

export const AVAILABILITY_OPTIONS = [
  "IST (UTC+5:30) Morning",
  "IST (UTC+5:30) Afternoon",
  "IST (UTC+5:30) Evening",
  "US Eastern Time (ET) Morning",
  "US Eastern Time (ET) Afternoon",
  "US Eastern Time (ET) Evening",
  "US Pacific Time (PT) Morning",
  "US Pacific Time (PT) Afternoon",
  "Europe Central Time (CET) Morning",
  "Europe Central Time (CET) Evening",
  "UK Time (GMT/BST) Morning",
  "UK Time (GMT/BST) Evening",
  "Weekend Availability",
  "Other",
] as const;

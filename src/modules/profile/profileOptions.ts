export const INDIAN_LANGUAGES = [
  "Bengali",
  "Gujarati",
  "Kannada",
  "Hindi",
  "Malayalam",
  "Marathi",
  "Odia",
  "Tamil",
  "Telugu",
  "Urdu",
] as const;

export const INTERNATIONAL_LANGUAGES = [
  "Arabic",
  "English",
  "French",
  "German",
  "Japanese",
  "Korean",
  "Mandarin Chinese",
  "Portuguese",
  "Russian",
  "Spanish",
] as const;

export const LANGUAGE_OPTIONS = [
  "Arabic",
  "Bengali",
  "English",
  "French",
  "German",
  "Gujarati",
  "Hindi",
  "Japanese",
  "Kannada",
  "Korean",
  "Malayalam",
  "Mandarin Chinese",
  "Marathi",
  "Odia",
  "Portuguese",
  "Russian",
  "Spanish",
  "Tamil",
  "Telugu",
  "Urdu",
  "Other",
] as const;

export const COMPETENCY_OPTIONS = [
  "Career Transitions",
  "Change Management",
  "Communication",
  "Conflict Resolution",
  "Decision Making",
  "Emotional Intelligence",
  "Executive Presence",
  "Leadership",
  "Negotiation",
  "People Management",
  "Productivity",
  "Public Speaking",
  "Resilience",
  "Stakeholder Management",
  "Strategic Thinking",
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
  "Career Returnees",
  "Cross-functional Teams",
  "Early Career Professionals",
  "Entrepreneurs / Founders",
  "Executives / CXOs",
  "First-time Managers",
  "HR / People Managers",
  "Individual Contributors",
  "Mid-level Managers",
  "Sales Professionals",
  "Senior Leaders",
  "Students",
  "Tech Professionals",
  "Women Leaders",
  "Other",
] as const;

export const COACHING_METHOD_OPTIONS = [
  "Behavioral Coaching",
  "Cognitive Behavioral Coaching",
  "Design Thinking Coaching",
  "GROW Model",
  "Mindfulness-Based Coaching",
  "Narrative Coaching",
  "Neuro-Linguistic Programming (NLP)",
  "Positive Psychology Coaching",
  "Solution-Focused Coaching",
  "Strengths-Based Coaching",
  "Systems Coaching",
  "Transformational Coaching",
  "Other",
] as const;

export const COACH_OUTCOME_FOCUS_GROUPS = [
  {
    title: "Performance & Career",
    options: [
      "Leadership development",
      "Executive presence building",
      "Career transition support",
      "High-potential acceleration",
      "Succession readiness",
      "Mindset & Psychology",
    ],
  },
  {
    title: "Confidence and self-efficacy building",
    options: [
      "Resilience and stress management",
      "Growth mindset cultivation",
      "Overcoming limiting beliefs",
      "Emotional regulation",
    ],
  },
  {
    title: "Relationships & Communication",
    options: [
      "Interpersonal effectiveness",
      "Conflict resolution skills",
      "Stakeholder influence and persuasion",
      "Active listening and empathy",
      "Team dynamics and collaboration",
    ],
  },
  {
    title: "Productivity & Execution",
    options: [
      "Goal clarity and accountability",
      "Time and energy management",
      "Decision-making quality",
      "Focus and priority alignment",
      "Habit formation",
    ],
  },
  {
    title: "Identity & Purpose",
    options: [
      "Values clarification",
      "Life purpose alignment",
      "Work-life integration",
      "Personal brand development",
      "Self-awareness deepening",
    ],
  },
  {
    title: "Organizational & Role-Specific",
    options: [
      "New manager/leader onboarding",
      "Cross-cultural effectiveness",
      "Change adaptability",
      "Diversity and inclusion awareness",
      "Innovation and creative thinking",
    ],
  },
] as const;

export const SERVICE_PROVIDED_OPTIONS = [
  "1-1 Coaching",
  "Online Coaching",
  "Offline Coaching",
  "Group Coaching",
  "Cohort Coaching",
  "Other",
] as const;

export const INDIVIDUAL_PURPOSE_OPTIONS = [
  "Career Growth",
  "Leadership Development",
  "Role Transition",
  "Performance Improvement",
  "Confidence Building",
  "Communication Improvement",
  "Work-life Balance",
  "Entrepreneurial Growth",
  "Team Management",
  "Learn Specialized Programs",
  "Find Relevant Events",
  "Other",
] as const;

export const COACH_PURPOSE_OPTIONS = [
  "Building Coaching Practice",
  "Finding New Clients / Leads",
  "Selling Programs / Services",
  "Coachees Assessment",
  "Building Professional Network",
  "Personal Development",
  "Branding and Visibility",
  "Research / Data Insights",
  "Other",
] as const;

export const COMPANY_PURPOSE_OPTIONS = [
  "Coaching Services for Employees",
  "Leadership Development Programs",
  "Sales / Revenue Generation",
  "Employee Assessment",
  "Recruitment / Talent Acquisition",
  "Building Internal Coaching Culture",
  "Partnering for Program Delivery",
  "Research / Benchmarking",
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

export const INDIVIDUAL_CHALLENGES_OPTIONS = [
  "Career stagnation or plateau",
  "Unclear career direction",
  "Lack of confidence / self-doubt",
  "Imposter syndrome",
  "Poor work-life balance",
  "Difficulty managing stress and pressure",
  "Struggling with a leadership transition",
  "Communication and influence gaps",
  "Conflict in the workplace",
  "Low motivation or disengagement",
  "Difficulty prioritising and managing time",
  "Fear of failure or risk aversion",
  "Limited visibility or recognition at work",
  "Navigating organisational change",
  "Building resilience under pressure",
  "Difficult stakeholder relationships",
  "Other",
] as const;

export const INDIVIDUAL_IDENTITY_OPTIONS = [
  "Student",
  "Early Career Professional",
  "Individual Contributor",
  "First-time Manager",
  "Mid-level Manager",
  "Senior Leader",
  "Executive / CXO",
  "Entrepreneur / Founder",
  "Career Returnee",
  "Woman Leader",
  "Sales Professional",
  "Tech Professional",
  "HR / People Manager",
  "Cross-functional Team Member",
  "Other",
] as const;

export const AVAILABILITY_OPTIONS = [
  "Regular Hours",
  "Weekends Available",
  "Weekends Only",
  "Customized",
  "International Hours",
] as const;

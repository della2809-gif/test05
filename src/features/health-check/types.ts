export type RiskLevel = "good" | "attention" | "warning" | "risk";
export type Gender = "female" | "male" | "other";
export type EvidenceConfidence = "낮음" | "보통" | "높음";

export interface Question {
  code: string;
  text: string;
  genderText?: Partial<Record<Gender, string>>;
}

export interface HealthDomain {
  code: string;
  name: string;
  icon: string;
  consumerDescription: string;
  functionalDescription: string;
  questions: Question[];
}

export interface ProfileSummary {
  name: string;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  waistCm?: number;
  occupation?: string;
  healthGoal?: string;
  diagnoses?: string;
  medications?: string;
  surgeries?: string;
  familyHistory?: string;
  recentCheckup?: string;
  notes?: string;
}

export interface LifestyleProfile {
  regularMeals: number;
  vegetables: number;
  fruit: number;
  protein: number;
  hydration: number;
  caffeine: number;
  exercise: number;
  sleep: number;
  sunlight: number;
  monitoring: number;
}

export interface DomainResult {
  code: string;
  name: string;
  rawScore: number;
  maxScore: number;
  normalizedRisk: number;
  level: RiskLevel;
  rank: number;
  summary: string;
  priorityScore?: number;
  priorityReasons?: string[];
}

export interface RootCauseResult {
  code: string;
  name: string;
  score: number;
  level: RiskLevel;
  evidenceDomains: string[];
  explanation: string;
  confidence?: EvidenceConfidence;
  elevatedDomainCount?: number;
  flowLabels?: string[];
  consumerExplanation?: string;
}

export interface RoadmapStep {
  week: number;
  title: string;
  goal: string;
  actions: string[];
  expected: string;
}

export interface HealthReport {
  assessmentId: string;
  profile: ProfileSummary;
  lifestyle: LifestyleProfile;
  healthScore: number;
  healthGrade: string;
  lifestyleScore: number;
  lifestyleGrade: string;
  lifestyleAdherence: number;
  totalRiskScore: number;
  topPriorities: DomainResult[];
  topAssets: DomainResult[];
  domains: DomainResult[];
  rootCauses: RootCauseResult[];
  overallAssessment: string;
  causeAnalysis: string;
  roadmap: RoadmapStep[];
  coachMessage: string;
  safetyWarning: boolean;
  algorithmVersion: string;
  assessmentBasis: string[];
  createdAt: string;
}

export interface AssessmentPayload {
  profile: ProfileSummary;
  lifestyle: LifestyleProfile;
  answers: Record<string, number>;
}

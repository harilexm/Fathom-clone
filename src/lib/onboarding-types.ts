export type CalendarStatus = "pending" | "connected" | "skipped" | "denied";
export type UsageType = "individual" | "team";
export type MeetingPreference = "manual" | "automatic";
export type SharingPreference = "private" | "team";
export type JobFunction = "engineering" | "product" | "sales" | "customer-success" | "operations" | "other";

export type UserProfile = {
  plan: string;
  trial_ends_at: string;
  onboarding_completed: boolean;
  calendar_connected: boolean;
  calendar_status: CalendarStatus;
  onboarding_step: number;
  usage_type: UsageType | null;
  meeting_preference: MeetingPreference | null;
  sharing_preference: SharingPreference | null;
  job_function: JobFunction | null;
  credits_balance: number;
};

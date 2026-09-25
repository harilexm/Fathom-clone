"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { FathomLogo } from "@/components/fathom-logo";
import { finishOnboarding, saveOnboardingStep, type FinishState, type SaveState } from "./actions";
import type { CalendarStatus, UserProfile } from "@/lib/onboarding-types";

const steps = [
  { title: "Connect Calendar", description: "Choose a calendar preference for your setup." },
  { title: "Individual / Team use", description: "Tell us how you plan to use your workspace." },
  { title: "Meeting preferences", description: "Choose how you would like to capture meetings." },
  { title: "Sharing preference", description: "Choose your preferred sharing default." },
  { title: "Optional job function", description: "Add a little context about your work, if you like." },
];
const stepNames = ["calendar", "usage", "meeting", "sharing", "job"] as const;
const calendarMessages: Record<string, string> = {
  connected: "Google Calendar connected with read-only access.",
  denied: "Calendar access was declined. You can continue without a connection.",
  skipped: "Calendar connection skipped. You can continue setup.",
  unavailable: "Google Calendar connection is not configured yet. You can skip for now.",
  invalid: "Calendar authorization expired or was invalid. Please try again or skip.",
  "connect-error": "Could not connect Google Calendar. Please try again or skip.",
  "save-error": "Could not save your Calendar choice. Please try again or skip.",
};

type ChoiceCardProps = { name: string; value: string; selected: string; onSelect: (value: string) => void; title: string; description: string };
function ChoiceCard({ name, value, selected, onSelect, title, description }: ChoiceCardProps) {
  const checked = selected === value;
  return <label className={"flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-[#4b83ff] " + (checked ? "border-[#4b83ff] bg-[#15233b]" : "border-[#253345] bg-[#0d1420] hover:border-[#3a5273]")}>
    <input type="radio" name={name} value={value} checked={checked} onChange={() => onSelect(value)} className="sr-only" />
    <span className={"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " + (checked ? "border-[#4b83ff] bg-[#4b83ff] text-white" : "border-[#63758e]")}>{checked && <Check size={13} strokeWidth={3} aria-hidden="true" />}</span>
    <span><span className="block text-sm font-semibold text-[#e8eef8]">{title}</span><span className="mt-1 block text-xs leading-5 text-[#8e9bac]">{description}</span></span>
  </label>;
}

function SubmitButton({ finish = false, disabled = false, label, variant = "primary" }: { finish?: boolean; disabled?: boolean; label?: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  
  const baseStyle = "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const primaryStyle = "bg-[#4b83ff] text-white hover:bg-[#3b62db]";
  const secondaryStyle = "bg-transparent text-[#8e9bac] hover:bg-[#1a2433] hover:text-[#c0cce0]";

  return <button type="submit" disabled={pending || disabled} className={`${baseStyle} ${variant === "primary" ? primaryStyle : secondaryStyle}`}>
    {pending ? "Saving..." : label ?? (finish ? "Finish setup" : "Continue")}{!pending && variant === "primary" && <ArrowRight size={16} aria-hidden="true" />}
  </button>;
}

export function OnboardingFlow({ profile, calendarConfigured, calendarFeedback }: { profile: UserProfile; calendarConfigured: boolean; calendarFeedback?: string }) {
  const [step, setStep] = useState(Math.min(profile.onboarding_step, 4));
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>(profile.calendar_status);
  const [usage, setUsage] = useState(profile.usage_type ?? "");
  const [meeting, setMeeting] = useState(profile.meeting_preference ?? "");
  const [sharing, setSharing] = useState(profile.sharing_preference ?? "");
  const [jobFunction, setJobFunction] = useState(profile.job_function ?? "");
  const [saveState, saveAction] = useActionState<SaveState, FormData>(saveOnboardingStep, { error: null, savedStep: null });
  const [finishState, finishAction] = useActionState<FinishState, FormData>(finishOnboarding, { error: null });

  useEffect(() => {
    if (saveState.savedStep === null) return;
    if (saveState.calendarStatus) setCalendarStatus(saveState.calendarStatus);
    setStep(Math.min(saveState.savedStep, 4));
  }, [saveState]);

  const values = ["skip", usage, meeting, sharing, jobFunction];
  const canContinue = step === 4 || Boolean(values[step]);
  return <main className="min-h-screen bg-[#0a0e17] px-5 py-6 text-[#e8eef8] sm:px-8">
    <div className="mx-auto max-w-2xl">
      <header className="flex items-center justify-center pt-8">
        <FathomLogo href="/" size="md" />
      </header>
      <div className="mt-16 sm:mt-24">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-[#f3f6fc] sm:text-3xl">{steps[step].title}</h1>
          <span className="text-sm font-medium text-[#8e9bac]">Step {step + 1} of {steps.length}</span>
        </div>
        <div role="progressbar" aria-label="Onboarding progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} className="mt-7 flex gap-2">
          {steps.map(({ title }, index) => <span key={title} title={title} className={"h-1.5 flex-1 rounded-full " + (index <= step ? "bg-[#4b83ff]" : "bg-[#1e2a3a]")} />)}
        </div>
      </div>
      {calendarFeedback && calendarMessages[calendarFeedback] && <p role="status" className="mt-5 text-sm text-[#b7cfff]">{calendarMessages[calendarFeedback]}</p>}
      <div className="mt-7 flex min-h-[220px] flex-col justify-center rounded-xl border border-[#253345] bg-[#101824] p-5 shadow-lg sm:p-7">
        {step === 0 && <section aria-label="Connect Calendar">
          {calendarStatus === "connected" && <p className="mb-4 text-sm text-[#b7cfff]">Google Calendar is connected with read-only access.</p>}
          {calendarStatus === "denied" && !calendarFeedback && <p className="mb-4 text-sm text-[#b7cfff]">Calendar access was declined. You can continue without a connection.</p>}
          {calendarConfigured && <a href="/onboarding/calendar/start" className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-transparent bg-[#15233b] px-4 py-3 text-sm font-semibold text-[#e8eef8] transition-colors hover:bg-[#1a2b4a]">{calendarStatus === "connected" ? "Reconnect Google Calendar" : "Connect Google Calendar"}<ArrowRight size={16} aria-hidden="true" /></a>}
          {!calendarConfigured && <p className="text-sm text-[#8e9bac]">Google Calendar connection is currently unavailable. You can continue setup.</p>}
          <p className="mt-4 text-xs leading-5 text-[#8e9bac]">Calendar access is read-only. You can skip this step and continue setup.</p>
        </section>}
        {step === 1 && <section aria-label="Individual or Team use"><fieldset className="space-y-3"><legend className="sr-only">How will you use Fathom?</legend>
          <ChoiceCard name="usage" value="individual" selected={usage} onSelect={setUsage} title="By Myself" description="Use a personal meeting workspace." />
          <ChoiceCard name="usage" value="team" selected={usage} onSelect={setUsage} title="With My Team" description="Plan to collaborate with teammates later." />
        </fieldset></section>}
        {step === 2 && <section aria-label="Meeting preferences"><fieldset className="space-y-3"><legend className="sr-only">Meeting preference</legend>
          <ChoiceCard name="meeting" value="manual" selected={meeting} onSelect={setMeeting} title="Choose meetings manually" description="Decide which meetings to capture when recording is available." />
          <ChoiceCard name="meeting" value="automatic" selected={meeting} onSelect={setMeeting} title="Capture meetings automatically" description="Save this as a future preference; automatic capture is not active in this preview." />
        </fieldset></section>}
        {step === 3 && <section aria-label="Sharing preference"><fieldset className="space-y-3"><legend className="sr-only">Sharing preference</legend>
          <ChoiceCard name="sharing" value="private" selected={sharing} onSelect={setSharing} title="Keep meetings private" description="Prefer access limited to your own workspace." />
          <ChoiceCard name="sharing" value="team" selected={sharing} onSelect={setSharing} title="Share with my team" description="Save this as a future preference; team sharing is not active in this preview." />
        </fieldset></section>}
        {step === 4 && <section aria-label="Optional job function">
          <label htmlFor="job-function" className="block text-sm font-semibold text-[#e8eef8]">Job function <span className="font-normal text-[#8e9bac]">(optional)</span></label>
          <select id="job-function" value={jobFunction} onChange={(event) => setJobFunction(event.target.value)} className="mt-3 h-11 w-full rounded-lg border border-[#253345] bg-[#0d1420] px-3 text-sm text-[#e8eef8] focus:border-[#4b83ff]">
            <option value="">Prefer not to say</option><option value="engineering">Engineering</option><option value="product">Product</option><option value="sales">Sales</option><option value="customer-success">Customer Success</option><option value="operations">Operations</option><option value="other">Other</option>
          </select>
          <p className="mt-3 text-xs leading-5 text-[#8e9bac]">You can finish setup without choosing a job function.</p>
        </section>}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className="inline-flex h-11 items-center gap-2 px-2 text-sm font-medium text-[#c0cce0] hover:text-white disabled:invisible"><ChevronLeft size={16} aria-hidden="true" /> Back</button>
        {step === 0 && calendarStatus !== "pending" && <button type="button" onClick={() => setStep(1)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#4b78ff] px-5 text-sm font-semibold text-white hover:bg-[#3b62db]">Continue <ArrowRight size={16} aria-hidden="true" /></button>}
        {step === 0 && calendarStatus === "pending" && <form action={saveAction}><input type="hidden" name="step" value="calendar" /><input type="hidden" name="value" value="skip" /><SubmitButton label="Skip for now" variant="secondary" /></form>}
        {step > 0 && step < 4 && <form action={saveAction} key={step}><input type="hidden" name="step" value={stepNames[step]} /><input type="hidden" name="value" value={values[step]} /><SubmitButton disabled={!canContinue} /></form>}
        {step === 4 && <form action={finishAction}><input type="hidden" name="job_function" value={jobFunction} /><SubmitButton finish /></form>}
      </div>
      {saveState.error && <p role="alert" className="mt-3 text-sm text-[#ff6b7e]">{saveState.error}</p>}
      {finishState.error && <p role="alert" className="mt-3 text-sm text-[#ff6b7e]">{finishState.error}</p>}
    </div>
  </main>;
}

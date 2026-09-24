"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Check, ChevronLeft } from "lucide-react";
import { finishOnboarding, type FinishState } from "./actions";

const steps = [
  { title: "Connect Calendar", description: "Choose a calendar preference for your setup." },
  { title: "Individual / Team use", description: "Tell us how you plan to use your workspace." },
  { title: "Meeting preferences", description: "Choose how you would like to capture meetings." },
  { title: "Sharing preference", description: "Choose your preferred sharing default." },
  { title: "Optional job function", description: "Add a little context about your work, if you like." },
];

type ChoiceCardProps = {
  name: string;
  value: string;
  selected: string;
  onSelect: (value: string) => void;
  title: string;
  description: string;
};

function ChoiceCard({ name, value, selected, onSelect, title, description }: ChoiceCardProps) {
  const checked = selected === value;
  return <label className={"flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-[#4b83ff] " + (checked ? "border-[#4b83ff] bg-[#15233b]" : "border-[#253345] bg-[#0d1420] hover:border-[#3a5273]")}>
    <input type="radio" name={name} value={value} checked={checked} onChange={() => onSelect(value)} className="sr-only" />
    <span className={"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " + (checked ? "border-[#4b83ff] bg-[#4b83ff] text-white" : "border-[#63758e]")}>{checked && <Check size={13} strokeWidth={3} aria-hidden="true" />}</span>
    <span><span className="block text-sm font-semibold text-[#e8eef8]">{title}</span><span className="mt-1 block text-xs leading-5 text-[#8e9bac]">{description}</span></span>
  </label>;
}

function FinishButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#4b78ff] px-5 text-sm font-semibold text-white hover:bg-[#3b62db] disabled:opacity-60">
    {pending ? "Finishing..." : "Finish setup"}{!pending && <ArrowRight size={16} aria-hidden="true" />}
  </button>;
}

export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [calendar, setCalendar] = useState("skip");
  const [usage, setUsage] = useState("individual");
  const [meeting, setMeeting] = useState("manual");
  const [sharing, setSharing] = useState("private");
  const [jobFunction, setJobFunction] = useState("");
  const [finishState, finishAction] = useActionState<FinishState, FormData>(finishOnboarding, { error: null });

  return <main className="min-h-screen bg-canvas px-5 py-6 text-[#e8eef8] sm:px-8">
    <div className="mx-auto max-w-2xl">
      <header className="flex items-center justify-between gap-4">
        <span className="text-[17px] font-black tracking-[.13em] text-ink">FATHOM<span className="text-brand">.</span></span>
        <span className="text-xs font-medium text-[#8e9bac]">Step {step + 1} of {steps.length}</span>
      </header>

      <div className="mt-12 sm:mt-16">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#7badff]">Set up your workspace</p>
        <h1 className="mt-3 text-2xl font-semibold text-[#f3f6fc] sm:text-3xl">{steps[step].title}</h1>
        <p className="mt-2 text-sm text-[#8e9bac]">{steps[step].description}</p>
        <div role="progressbar" aria-label="Onboarding progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} className="mt-7 flex gap-2">
          {steps.map(({ title }, index) => <span key={title} title={title} className={"h-1.5 flex-1 rounded-full " + (index <= step ? "bg-[#4b83ff]" : "bg-[#253345]")} />)}
        </div>
      </div>

      <div className="surface mt-7 min-h-[290px] rounded-2xl p-5 sm:p-7">
        <section hidden={step !== 0} aria-label="Connect Calendar">
          <p className="mb-4 text-xs leading-5 text-[#8e9bac]">Calendar connections are not available in this preview. Your choice here will not connect an account.</p>
          <fieldset className="space-y-3"><legend className="sr-only">Calendar preference</legend>
            <ChoiceCard name="calendar" value="google" selected={calendar} onSelect={setCalendar} title="Google Calendar" description="Choose this as your future calendar preference." />
            <ChoiceCard name="calendar" value="outlook" selected={calendar} onSelect={setCalendar} title="Microsoft Outlook" description="Choose this as your future calendar preference." />
            <ChoiceCard name="calendar" value="skip" selected={calendar} onSelect={setCalendar} title="Skip for now" description="Continue without a calendar connection." />
          </fieldset>
        </section>
        <section hidden={step !== 1} aria-label="Individual or Team use">
          <fieldset className="space-y-3"><legend className="sr-only">How will you use Fathom?</legend>
            <ChoiceCard name="usage" value="individual" selected={usage} onSelect={setUsage} title="Individual" description="Use a personal meeting workspace." />
            <ChoiceCard name="usage" value="team" selected={usage} onSelect={setUsage} title="Team" description="Plan to collaborate with teammates later." />
          </fieldset>
        </section>
        <section hidden={step !== 2} aria-label="Meeting preferences">
          <fieldset className="space-y-3"><legend className="sr-only">Meeting preference</legend>
            <ChoiceCard name="meeting" value="manual" selected={meeting} onSelect={setMeeting} title="Choose meetings manually" description="Decide which meetings to capture when recording is available." />
            <ChoiceCard name="meeting" value="automatic" selected={meeting} onSelect={setMeeting} title="Capture meetings automatically" description="Save this as a future preference; automatic capture is not active in this preview." />
          </fieldset>
        </section>
        <section hidden={step !== 3} aria-label="Sharing preference">
          <fieldset className="space-y-3"><legend className="sr-only">Sharing preference</legend>
            <ChoiceCard name="sharing" value="private" selected={sharing} onSelect={setSharing} title="Keep meetings private" description="Prefer access limited to your own workspace." />
            <ChoiceCard name="sharing" value="team" selected={sharing} onSelect={setSharing} title="Share with my team" description="Save this as a future preference; team sharing is not active in this preview." />
          </fieldset>
        </section>
        <section hidden={step !== 4} aria-label="Optional job function">
          <label htmlFor="job-function" className="block text-sm font-semibold text-[#e8eef8]">Job function <span className="font-normal text-[#8e9bac]">(optional)</span></label>
          <select id="job-function" value={jobFunction} onChange={(event) => setJobFunction(event.target.value)} className="mt-3 h-11 w-full rounded-lg border border-[#253345] bg-[#0d1420] px-3 text-sm text-[#e8eef8] focus:border-[#4b83ff]">
            <option value="">Prefer not to say</option><option value="engineering">Engineering</option><option value="product">Product</option><option value="sales">Sales</option><option value="customer-success">Customer Success</option><option value="operations">Operations</option><option value="other">Other</option>
          </select>
          <p className="mt-3 text-xs leading-5 text-[#8e9bac]">You can finish setup without choosing a job function.</p>
        </section>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className="inline-flex h-11 items-center gap-2 px-2 text-sm font-medium text-[#c0cce0] hover:text-white disabled:invisible"><ChevronLeft size={16} aria-hidden="true" /> Back</button>
        <button type="button" hidden={step === steps.length - 1} onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#4b78ff] px-5 text-sm font-semibold text-white hover:bg-[#3b62db]">Continue <ArrowRight size={16} aria-hidden="true" /></button>
        <form action={finishAction} hidden={step !== steps.length - 1}><FinishButton /></form>
      </div>
      {finishState.error && <p role="alert" className="mt-3 text-sm text-[#ff6b7e]">{finishState.error}</p>}
      <p className="mt-7 text-xs leading-5 text-[#718399]">Your selections stay on this screen for now. Finishing setup saves only your completion status.</p>
    </div>
  </main>;
}

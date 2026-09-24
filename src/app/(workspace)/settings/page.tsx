import { Bell, LockKeyhole, UserRound } from "lucide-react";

export default function SettingsPage() {
  return <section aria-label="Settings" className="fade-in max-w-3xl">
    <div className="surface divide-y divide-[#253345]">
      <div className="flex items-start gap-3 p-4"><UserRound size={17} className="mt-0.5 text-brand" /><div className="min-w-0"><p className="text-xs font-semibold text-ink">Profile</p><p className="mt-1 text-[11px] text-muted">Jamie Davis · Demo profile</p></div></div>
      <div className="flex items-start gap-3 p-4"><Bell size={17} className="mt-0.5 text-brand" /><div><p className="text-xs font-semibold text-ink">Notifications</p><p className="mt-1 text-[11px] text-muted">Preferences will be available when accounts are connected.</p></div></div>
      <div className="flex items-start gap-3 p-4"><LockKeyhole size={17} className="mt-0.5 text-brand" /><div><p className="text-xs font-semibold text-ink">Privacy and access</p><p className="mt-1 text-[11px] text-muted">Private meeting access will be enforced in a later step.</p></div></div>
    </div>
  </section>;
}

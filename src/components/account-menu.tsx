"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Coins } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/login/actions";

export type AccountDetails = {
  email: string | null;
  isAnonymous: boolean;
  plan: string;
  trialEndsAt: string;
  credits: number;
};

const links = [
  { href: "/pricing", label: "Pricing" },
  { href: "/faqs", label: "FAQs" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/security-compliance", label: "Security & Compliance" },
];

export function AccountMenu({ account }: { account: AccountDetails }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const email = account.isAnonymous ? "Demo guest" : (account.email ?? "Email unavailable");
  const initials = account.isAnonymous ? "DG" : (account.email?.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "AC");
  const plan = account.plan.charAt(0).toUpperCase() + account.plan.slice(1);
  const trialActive = new Date(account.trialEndsAt).getTime() > Date.now();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <div ref={container} className="relative">
    <button ref={trigger} type="button" aria-label="Account" aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen(!open)} className="flex items-center gap-2 hover:opacity-80 focus-visible:rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3b82f6]">
      <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#1d4ed8] text-[13px] font-bold text-white shadow-none">{initials}</span>
      <ChevronDown size={15} className="text-[#64748b]" aria-hidden="true" />
    </button>
    <div id="account-menu" hidden={!open} className="absolute right-0 top-full z-50 mt-2.5 w-[min(288px,calc(100vw-24px))] rounded-lg border border-[#151e2b] bg-[#080c14] py-2 text-[13px] text-[#cbd5e1] shadow-[0_12px_36px_rgba(0,0,0,.65)]">
      <div className="border-b border-[#131b26] px-4 pb-3 pt-2">
        <p className="break-all font-semibold text-[#f1f5f9]">{email}</p>
        <div className="mt-2.5 flex items-center justify-between gap-3 text-xs"><span className="text-[#64748b]">Current access</span><span className="font-medium text-[#e2e8f0]">{trialActive ? "Pro trial" : plan}</span></div>
        <div className="mt-1 flex items-center justify-between gap-3 text-xs"><span className="text-[#64748b]">Pro Trial</span><span className={trialActive ? "font-medium text-[#3b82f6]" : "text-[#64748b]"}>{trialActive ? "Active" : "Ended"}</span></div>
        <div className="mt-1 flex items-center justify-between gap-3 text-xs">
          <span className="text-[#64748b]">Credit balance</span>
          <span className="flex items-center gap-1 font-semibold text-[#fbbf24]">
            <Coins size={13} className="text-[#fbbf24]" />
            <span>{account.credits ?? 0} credit{account.credits === 1 ? "" : "s"}</span>
          </span>
        </div>
      </div>
      <nav aria-label="Account links" className="py-1">
        {links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setOpen(false)} className="block px-4 py-2 text-xs font-medium text-[#cbd5e1] hover:bg-[#0e1420] hover:text-white transition-colors focus-visible:bg-[#0e1420] focus-visible:text-white">{label}</Link>)}
      </nav>
      <form action={signOut} className="border-t border-[#131b26] pt-1">
        <button type="submit" className="block w-full px-4 py-2 text-left text-xs font-medium text-[#cbd5e1] hover:bg-[#0e1420] hover:text-white transition-colors focus-visible:bg-[#0e1420] focus-visible:text-white">Logout</button>
      </form>
    </div>
  </div>;
}

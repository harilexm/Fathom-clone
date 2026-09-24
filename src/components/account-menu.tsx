"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/login/actions";

export type AccountDetails = {
  email: string | null;
  isAnonymous: boolean;
  plan: string;
  trialEndsAt: string;
};

const links = [
  { href: "/pricing", label: "Pricing" },
  { href: "/faqs", label: "FAQs" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
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
    <button ref={trigger} type="button" aria-label="Account" aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen(!open)} className="flex items-center gap-2 hover:opacity-80 focus-visible:rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4b83ff]">
      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#2563eb] text-[14px] font-bold text-white">{initials}</span>
      <ChevronDown size={16} className="text-[#8e9bac]" aria-hidden="true" />
    </button>
    <div id="account-menu" hidden={!open} className="absolute right-0 top-full z-50 mt-3 w-[min(288px,calc(100vw-24px))] rounded-lg border border-[#253345] bg-[#101824] py-2 text-[13px] text-[#c0cce0] shadow-[0_12px_32px_rgba(0,0,0,.45)]">
      <div className="border-b border-[#253345] px-4 pb-3 pt-2">
        <p className="break-all font-medium text-[#f3f6fc]">{email}</p>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-[#8e9bac]">Current plan</span><span className="font-medium text-[#e8eef8]">{plan}</span></div>
        <div className="mt-1 flex items-center justify-between gap-3 text-xs"><span className="text-[#8e9bac]">Pro Trial</span><span className={trialActive ? "font-medium text-[#7badff]" : "text-[#8e9bac]"}>{trialActive ? "Active" : "Ended"}</span></div>
      </div>
      <nav aria-label="Account links" className="py-1">
        {links.map(({ href, label }) => <Link key={href} href={href} onClick={() => setOpen(false)} className="block px-4 py-2 hover:bg-[#1a2433] hover:text-white focus-visible:bg-[#1a2433] focus-visible:text-white">{label}</Link>)}
      </nav>
      <form action={signOut} className="border-t border-[#253345] pt-1">
        <button type="submit" className="block w-full px-4 py-2 text-left hover:bg-[#1a2433] hover:text-white focus-visible:bg-[#1a2433] focus-visible:text-white">Logout</button>
      </form>
    </div>
  </div>;
}

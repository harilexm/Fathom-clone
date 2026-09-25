"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChartNoAxesColumnIncreasing, Play, Search, Settings, Sparkles, Coins } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AskFathomPanel } from "@/components/ask-fathom-panel";
import { AccountMenu, type AccountDetails } from "@/components/account-menu";
import { FathomLogo } from "@/components/fathom-logo";

const tabs = [
  { href: "/my-calls", label: "My Calls", icon: Play },
  { href: "/insights", label: "Insights", icon: ChartNoAxesColumnIncreasing }
];

export function AppShell({ children, account }: { children: React.ReactNode; account: AccountDetails }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentQuery = searchParams.get("q") || "";
  const [globalQuery, setGlobalQuery] = useState(currentQuery);
  const [askCollapsed, setAskCollapsed] = useState(false);
  const [mobileAskOpen, setMobileAskOpen] = useState(false);

  useEffect(() => {
    setGlobalQuery(currentQuery);
  }, [currentQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(globalQuery.trim())}`);
    } else {
      router.push(`/search`);
    }
  };
  const mobilePanel = useRef<HTMLElement>(null);
  const askButton = useRef<HTMLButtonElement>(null);
  const closeMobileAsk = useCallback(() => {
    setMobileAskOpen(false);
    requestAnimationFrame(() => askButton.current?.focus());
  }, []);

  const [credits, setCredits] = useState<number>(account.credits ?? 0);

  useEffect(() => {
    if (typeof account.credits === "number") {
      setCredits(account.credits);
    }
  }, [account.credits]);

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      if (res.ok) {
        const data = await res.json();
        if (typeof data.credits === "number") {
          setCredits(data.credits);
        }
      }
    } catch {
      // Ignore network errors
    }
  }, []);

  useEffect(() => {
    refreshCredits();

    const handleCreditsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ credits?: number; balance?: number }>;
      if (typeof customEvent.detail?.credits === "number") {
        setCredits(customEvent.detail.credits);
      } else if (typeof customEvent.detail?.balance === "number") {
        setCredits(customEvent.detail.balance);
      } else {
        refreshCredits();
      }
    };

    window.addEventListener("fathom:credits-updated", handleCreditsUpdated);
    window.addEventListener("focus", refreshCredits);

    return () => {
      window.removeEventListener("fathom:credits-updated", handleCreditsUpdated);
      window.removeEventListener("focus", refreshCredits);
    };
  }, [refreshCredits]);

  useEffect(() => { setMobileAskOpen(false); }, [pathname]);
  useEffect(() => {
    if (!mobileAskOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => mobilePanel.current?.querySelector("select")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileAsk();
      if (event.key !== "Tab" || !mobilePanel.current) return;
      const focusable = Array.from(mobilePanel.current.querySelectorAll<HTMLElement>('button:not([disabled]), select, textarea, input, a'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKeyDown); };
  }, [mobileAskOpen, closeMobileAsk]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <header inert={mobileAskOpen} className="shrink-0 z-30 border-b border-[#131b26] bg-[#06080d]/95 backdrop-blur-sm">
        <div className="flex h-[70px] items-center gap-6 border-b border-[#131b26] px-6 lg:px-10">
          <FathomLogo href="/my-calls" size="md" />
          <form onSubmit={handleSearch} className="ml-2 flex h-[38px] w-[340px] shrink-0 items-center gap-2.5 rounded-md border border-[#151e2b] bg-[#080c14] px-3 text-[13px] text-[#5e7087] focus-within:border-[#2563eb] focus-within:ring-1 focus-within:ring-[#2563eb]/20 focus-within:text-[#f1f5f9] transition-all sm:ml-4">
            <Search size={15} className="shrink-0" />
            <input
              type="text"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Search call recordings, people, topics..."
              className="w-full bg-transparent text-[#f1f5f9] outline-none placeholder:text-[#52637a]"
            />
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-6 text-[14px] font-medium text-[#94a3b8]">
            <Link href="/settings" aria-label="Settings" aria-current={pathname === "/settings" ? "page" : undefined} className="flex items-center gap-2 hover:text-[#f1f5f9] transition-colors">
              <Settings size={18} />
              <span className="hidden sm:inline text-xs font-semibold">Settings</span>
            </Link>
            <span
              id="credits-balance-display"
              className="hidden cursor-default items-center gap-1.5 rounded-md border border-[#172232] bg-[#0a0f18] px-2.5 py-1 text-xs font-semibold text-[#e2e8f0] sm:flex"
              title={`${credits} credits available`}
              data-credits={credits}
            >
              <Coins size={14} className="text-[#fbbf24]" />
              <span>{credits}</span>
            </span>
            <span aria-hidden="true" className="h-[20px] w-px bg-[#131b26]" />
            <AccountMenu account={{ ...account, credits }} />
          </div>
        </div>
        <nav aria-label="Meeting navigation" className="flex h-[52px] items-stretch gap-8 overflow-x-auto px-6 lg:px-10">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/my-calls" && pathname.startsWith("/meeting/"));
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={"relative flex shrink-0 items-center gap-2 text-[14px] font-medium transition-colors " + (active ? "text-[#3b82f6]" : "text-[#64748b] hover:text-[#cbd5e1]")}>
                <Icon size={17} strokeWidth={2} aria-hidden="true" />
                {label}
                {active && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-t-full bg-[#2563eb]" />}
              </Link>
            );
          })}
        </nav>
      </header>

      <div inert={mobileAskOpen} className="flex min-w-0 flex-1 overflow-hidden">
        <main id="main-content" className="min-w-0 flex-1 overflow-y-auto px-6 pb-20 pt-4 xl:pr-6 xl:pb-4">{children}</main>
        <aside aria-label="Ask Fathom" className={"hidden shrink-0 xl:block " + (askCollapsed ? "w-[40px]" : "w-[380px] 2xl:w-[456px]")}>
          <div className="h-full"><AskFathomPanel collapsed={askCollapsed} onToggle={() => setAskCollapsed(!askCollapsed)} /></div>
        </aside>
      </div>

      <button ref={askButton} type="button" onClick={() => setMobileAskOpen(true)} aria-label="Open Ask Fathom" aria-controls="mobile-ask-panel" aria-expanded={mobileAskOpen} inert={mobileAskOpen} className="fixed bottom-4 right-4 z-20 flex h-10 items-center gap-2 rounded-lg border border-[#172232] bg-[#0a0f18] px-3.5 text-xs font-semibold text-[#cbd5e1] hover:bg-[#101726] hover:text-white hover:border-[#1e2b3e] transition-colors shadow-sm xl:hidden"><Sparkles size={14} className="text-[#3b82f6]" />Ask Fathom</button>
      {mobileAskOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button type="button" aria-label="Close Ask Fathom overlay" className="absolute inset-0 bg-black/80" onClick={closeMobileAsk} />
          <aside ref={mobilePanel} id="mobile-ask-panel" role="dialog" aria-modal="true" aria-label="Ask Fathom" className="absolute inset-y-0 right-0 w-[min(360px,94vw)] border-l border-[#131b26] bg-[#06080d] shadow-dropdown">
            <AskFathomPanel collapsed={false} onToggle={closeMobileAsk} toggleLabel="Close Ask Fathom" />
          </aside>
        </div>
      )}
    </div>
  );
}

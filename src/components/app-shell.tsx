"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChartNoAxesColumnIncreasing, Folder, Play, Search, Settings, Sparkles, UsersRound, Video, Coins } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AskFathomPanel } from "@/components/ask-fathom-panel";
import { AccountMenu, type AccountDetails } from "@/components/account-menu";

const tabs = [
  { href: "/my-calls", label: "My Calls", icon: Play },
  { href: "/team-calls", label: "Team Calls", icon: UsersRound },
  { href: "/playlists", label: "Playlists", icon: Folder },
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
      <header inert={mobileAskOpen} className="shrink-0 z-30 border-b border-[#1a2433] bg-[#0a0e17]/95 backdrop-blur">
        <div className="flex h-[72px] items-center gap-6 border-b border-[#1a2433] px-6 lg:px-10">
          <Link href="/my-calls" className="flex shrink-0 items-center gap-3 text-[18px] font-bold tracking-[.2em] text-white" aria-label="Fathom home">
            <span aria-hidden="true" className="flex h-8 items-center gap-[3px]">
              <span className="h-[16px] w-[4px] rounded-full bg-[#4b83ff]" />
              <span className="h-[28px] w-[4px] rounded-full bg-[#7badff]" />
              <span className="h-[20px] w-[4px] rounded-full bg-[#4b83ff]" />
              <span className="h-[14px] w-[4px] rounded-full bg-[#4b83ff]" />
            </span>
            <span>FATHOM</span>
          </Link>
          <form onSubmit={handleSearch} className="ml-2 flex h-[38px] w-[340px] shrink-0 items-center gap-2.5 rounded-md border border-[#1e2a3a] bg-[#0f1520] px-3 text-[13px] text-[#7b8da3] focus-within:border-[#2c3d52] focus-within:text-[#d1d9e5] sm:ml-4">
            <Search size={16} className="shrink-0" />
            <input
              type="text"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Search call recordings, people, topics..."
              className="w-full bg-transparent text-[#e8eef8] outline-none placeholder:text-[#7b8da3]"
            />
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-6 text-[14px] font-medium text-[#c0cce0]">
            <Link href="/settings" aria-label="Settings" aria-current={pathname === "/settings" ? "page" : undefined} className="flex items-center gap-2 hover:text-white">
              <Settings size={20} />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            <button type="button" disabled title="Test calls will be available later" aria-label="Start Test Call unavailable in this preview" className="flex items-center gap-2 opacity-80 hover:text-white">
              <Video size={20} />
              <span className="hidden sm:inline">Start Test Call</span>
            </button>
            <span className="hidden cursor-default items-center gap-1.5 rounded-full bg-[#1e2a3a] px-3 py-1 text-[13px] font-semibold text-[#f3f6fc] sm:flex" title={`${account.credits ?? 0} credits available`}>
              <Coins size={16} className="text-[#fbbf24]" />
              <span>{account.credits ?? 0}</span>
            </span>
            <span aria-hidden="true" className="h-[24px] w-px bg-[#1e2a3a]" />
            <AccountMenu account={account} />
          </div>
        </div>
        <nav aria-label="Meeting navigation" className="flex h-[56px] items-stretch gap-8 overflow-x-auto px-6 lg:px-10">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/my-calls" && pathname.startsWith("/meeting/"));
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={"relative flex shrink-0 items-center gap-2.5 text-[15px] font-medium transition-colors " + (active ? "text-[#4b83ff]" : "text-[#8e9bac] hover:text-[#d1d9e5]")}>
                <Icon size={20} strokeWidth={2} aria-hidden="true" />
                {label}
                {active && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-[#4b83ff]" />}
              </Link>
            );
          })}
        </nav>
      </header>

      <div inert={mobileAskOpen} className="flex min-w-0 flex-1 overflow-hidden">
        <main id="main-content" className="min-w-0 flex-1 overflow-y-auto px-6 pb-20 pt-3 sm:pt-4 xl:pr-6 xl:pb-4">{children}</main>
        <aside aria-label="Ask Fathom" className={"hidden shrink-0 xl:block " + (askCollapsed ? "w-[40px]" : "w-[380px] 2xl:w-[456px]")}>
          <div className="h-full"><AskFathomPanel collapsed={askCollapsed} onToggle={() => setAskCollapsed(!askCollapsed)} /></div>
        </aside>
      </div>

      <button ref={askButton} type="button" onClick={() => setMobileAskOpen(true)} aria-label="Open Ask Fathom" aria-controls="mobile-ask-panel" aria-expanded={mobileAskOpen} inert={mobileAskOpen} className="fixed bottom-4 right-4 z-20 flex h-11 items-center gap-2 rounded-full border border-[#1e3350] bg-[#0f1f33] px-4 text-xs font-semibold text-[#cce7ff] shadow-[0_6px_18px_rgba(0,0,0,.35)] xl:hidden"><Sparkles size={15} />Ask Fathom</button>
      {mobileAskOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button type="button" aria-label="Close Ask Fathom overlay" className="absolute inset-0 bg-black/70" onClick={closeMobileAsk} />
          <aside ref={mobilePanel} id="mobile-ask-panel" role="dialog" aria-modal="true" aria-label="Ask Fathom" className="absolute inset-y-0 right-0 w-[min(360px,94vw)] bg-[#0c1119] shadow-[0_12px_32px_rgba(0,0,0,.45)]">
            <AskFathomPanel collapsed={false} onToggle={closeMobileAsk} toggleLabel="Close Ask Fathom" />
          </aside>
        </div>
      )}
    </div>
  );
}

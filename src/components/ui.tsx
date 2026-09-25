"use client";

import { ChevronDown, LoaderCircle, X } from "lucide-react";
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, KeyboardEvent, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "dark";
  size?: "sm" | "md";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", className = "", children, type = "button", ...props }, ref) {
  const variants = {
    primary: "bg-[#2563eb] text-white hover:bg-[#1d4ed8] shadow-none focus-visible:outline-[#3b82f6]",
    secondary: "border border-[#151e2b] bg-[#080c14] text-[#cbd5e1] hover:bg-[#0e1420] hover:border-[#1e2a3c] hover:text-white",
    ghost: "text-[#64748b] hover:bg-[#0e1420] hover:text-[#f1f5f9]",
    dark: "border border-[#151e2b] bg-[#0e1420] text-[#cbd5e1] hover:bg-[#131b29] hover:text-white"
  };
  const sizing = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      ref={ref}
      type={type}
      className={"inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 " + sizing + " " + variants[variant] + " " + className}
      {...props}
    >
      {children}
    </button>
  );
});

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={"surface " + className} {...props}>{children}</div>;
}

type TabItem = { id: string; label: string; count?: number };

export function Tabs({ items, value, onChange, idBase, label = "Sections" }: { items: TabItem[]; value: string; onChange: (id: string) => void; idBase: string; label?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="flex min-w-0 gap-5 overflow-x-auto border-b border-[#131b26] sm:gap-6">
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(element) => { refs.current[index] = element; }}
          type="button"
          role="tab"
          id={idBase + "-" + item.id}
          aria-controls={idBase + "-panel"}
          aria-selected={value === item.id}
          tabIndex={value === item.id ? 0 : -1}
          onKeyDown={(event) => onKeyDown(event, index)}
          onClick={() => onChange(item.id)}
          className={"relative shrink-0 pb-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3b82f6] " + (value === item.id ? "text-[#3b82f6]" : "text-[#64748b] hover:text-[#cbd5e1]")}
        >
          {item.label}
          {item.count !== undefined && <span className="ml-1.5 text-xs opacity-70">{item.count}</span>}
          {value === item.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#2563eb]" />}
        </button>
      ))}
    </div>
  );
}

type DropdownItem = { label: string; onClick?: () => void; disabled?: boolean };

export function Dropdown({ label, items, showChevron = true, variant = "secondary", ariaLabel }: { label: ReactNode; items: DropdownItem[]; showChevron?: boolean; variant?: ButtonProps["variant"]; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const first = menu.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
    first?.focus();
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const enabled = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
    if (!enabled.length) return;
    event.preventDefault();
    const current = enabled.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : event.key === "ArrowDown" ? (current + 1) % enabled.length : (current - 1 + enabled.length) % enabled.length;
    enabled[next]?.focus();
  }

  return (
    <div ref={root} className="relative">
      <Button
        ref={trigger}
        variant={variant}
        size="sm"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } if (event.key === "Escape") setOpen(false); }}
      >
        {label}{showChevron && <ChevronDown size={14} />}
      </Button>
      {open && (
        <div ref={menu} id={id} role="menu" onKeyDown={onMenuKeyDown} className="absolute right-0 z-30 mt-1.5 min-w-48 rounded-lg border border-[#151e2b] bg-[#080c14] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,.6)]">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { item.onClick?.(); setOpen(false); trigger.current?.focus(); }}
              className="block w-full rounded-md px-3 py-1.5 text-left text-xs text-[#cbd5e1] hover:bg-[#0e1420] hover:text-white focus:bg-[#0e1420] focus:text-white transition-colors disabled:cursor-not-allowed disabled:text-[#475569]"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Modal({ title, open, onClose, children, footer }: { title: string; open: boolean; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('a, button:not([disabled]), input, textarea, select'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-xl border border-[#151e2b] bg-[#080c14] p-6 shadow-[0_16px_40px_rgba(0,0,0,.7)] text-[#f1f5f9]">
        <div className="mb-5 flex items-center justify-between">
          <h2 id={titleId} className="text-base font-bold text-[#f1f5f9]">{title}</h2>
          <button ref={closeButton} type="button" aria-label="Close dialog" onClick={onClose} className="rounded-md p-1.5 text-[#64748b] hover:bg-[#0e1420] hover:text-white transition-colors"><X size={17} /></button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-xs font-bold uppercase tracking-[.14em] text-[#3b82f6]">{eyebrow}</p>}
        <h1 className="text-xl font-semibold tracking-tight text-[#f1f5f9] sm:text-2xl">{title}</h1>
        {description && <p className="mt-1.5 text-xs text-[#64748b]">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <div role="status" aria-live="polite" className="flex min-h-52 flex-col items-center justify-center gap-3 text-xs text-[#64748b]"><LoaderCircle className="animate-spin text-[#3b82f6]" size={22} />{label}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <Card className="flex min-h-64 flex-col items-center justify-center border-[#131b26] bg-[#070a10] px-6 py-10 text-center"><div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-lg border border-[#17253d] bg-[#0e1726] text-[#3b82f6]">{icon}</div><h2 className="text-base font-bold text-[#f1f5f9]">{title}</h2><p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[#64748b]">{description}</p>{action && <div className="mt-4">{action}</div>}</Card>;
}

export function ErrorState({ title = "Something went wrong", description = "Please try again.", action }: { title?: string; description?: string; action?: ReactNode }) {
  return <Card role="alert" className="border-[#38151c] bg-[#1a0c10] p-6 text-center"><h2 className="font-semibold text-rose-400">{title}</h2><p className="mt-1.5 text-xs text-[#8fa0b5]">{description}</p>{action && <div className="mt-4">{action}</div>}</Card>;
}

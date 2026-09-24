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
    primary: "bg-brand text-[#07111e] hover:bg-[#7bbcff]",
    secondary: "border border-[#1e2a3a] bg-[#0f1520] text-ink hover:bg-[#141c29]",
    ghost: "text-muted hover:bg-[#0f1520] hover:text-ink",
    dark: "bg-[#141c29] text-ink hover:bg-[#1a2535]"
  };
  const sizing = size === "sm" ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm";
  return (
    <button
      ref={ref}
      type={type}
      className={"inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 " + sizing + " " + variants[variant] + " " + className}
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
    <div role="tablist" aria-label={label} className="flex min-w-0 gap-5 overflow-x-auto border-b border-[#1a2433] sm:gap-6">
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
          className={"relative shrink-0 pb-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand " + (value === item.id ? "text-brand" : "text-muted hover:text-ink")}
        >
          {item.label}
          {item.count !== undefined && <span className="ml-1.5 text-xs opacity-70">{item.count}</span>}
          {value === item.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand" />}
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
        <div ref={menu} id={id} role="menu" onKeyDown={onMenuKeyDown} className="absolute right-0 z-30 mt-2 min-w-48 rounded-lg border border-[#1e2a3a] bg-[#0f1520] p-1.5 shadow-[0_12px_24px_rgba(0,0,0,.3)]">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { item.onClick?.(); setOpen(false); trigger.current?.focus(); }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-[#141c29] focus:bg-[#141c29] disabled:cursor-not-allowed disabled:text-[#556376]"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-xl bg-[#0f1520] p-6 shadow-[0_16px_32px_rgba(0,0,0,.4)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button ref={closeButton} type="button" aria-label="Close dialog" onClick={onClose} className="rounded-md p-1.5 hover:bg-[#141c29]"><X size={18} /></button>
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
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-brand">{eyebrow}</p>}
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <div role="status" aria-live="polite" className="flex min-h-52 flex-col items-center justify-center gap-3 text-sm text-muted"><LoaderCircle className="animate-spin text-brand" size={24} />{label}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <Card className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center"><div className="mb-4 rounded-xl bg-[#0d1a2b] p-3 text-brand">{icon}</div><h2 className="text-lg font-bold">{title}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted">{description}</p>{action && <div className="mt-5">{action}</div>}</Card>;
}

export function ErrorState({ title = "Something went wrong", description = "Please try again.", action }: { title?: string; description?: string; action?: ReactNode }) {
  return <Card role="alert" className="border-[#3d1a24] bg-[#1a0e14] p-8 text-center"><h2 className="font-bold text-[#ff9aa6]">{title}</h2><p className="mt-2 text-sm text-muted">{description}</p>{action && <div className="mt-4">{action}</div>}</Card>;
}

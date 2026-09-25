"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { authenticatePassword, signInAsGuest, signInWithGoogle, type AuthState } from "./actions";

function SubmitButton({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex h-11 w-full items-center justify-center rounded-lg font-semibold transition-colors disabled:opacity-50 ${className}`}
    >
      {pending ? "Please wait..." : children}
    </button>
  );
}

function PasswordForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action] = useActionState<AuthState, FormData>(authenticatePassword, { error: null, message: null });
  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <div className="space-y-1.5 text-left">
        <label className="text-[13px] font-medium text-muted" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="h-11 w-full rounded-lg border border-[#151e2b] bg-[#080c14] px-4 text-[14px] text-[#f1f5f9] outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/30" />
      </div>
      <div className="space-y-1.5 text-left">
        <label className="text-[13px] font-medium text-muted" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required className="h-11 w-full rounded-lg border border-[#151e2b] bg-[#080c14] px-4 text-[14px] text-[#f1f5f9] outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/30" />
      </div>
      {state.error && <p role="alert" className="text-[13px] text-[#f87171]">{state.error}</p>}
      {state.message && <p role="status" className="text-[13px] text-brand">{state.message}</p>}
      <SubmitButton className="mt-2 bg-brand text-white hover:bg-brand-hover">
        {mode === "signup" ? "Create Account" : "Continue with Email"}
      </SubmitButton>
    </form>
  );
}

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="w-full rounded-xl border border-[#131b26] bg-[#070a10] px-6 py-10 shadow-2xl sm:px-10">
      <h1 className="text-center text-[24px] font-semibold tracking-tight text-[#f1f5f9]">
        {mode === "login" ? "Sign in to Fathom" : "Create your account"}
      </h1>

      {initialError && <p role="alert" className="mt-4 text-center text-[13px] text-[#f87171]">{initialError}</p>}

      <div className="mt-8 space-y-3">
        <form action={signInWithGoogle}>
          <SubmitButton className="border border-[#151e2b] bg-[#080c14] text-[14px] text-[#cbd5e1] hover:border-[#1e2a3c] hover:bg-[#0d131d] hover:text-[#f1f5f9]">
            <svg viewBox="0 0 24 24" className="mr-3 h-5 w-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </SubmitButton>
        </form>
        <form action={signInAsGuest}>
          <SubmitButton className="border border-[#151e2b] bg-[#080c14] text-[14px] text-[#cbd5e1] hover:border-[#1e2a3c] hover:bg-[#0d131d] hover:text-[#f1f5f9]">
            Continue as Demo guest
          </SubmitButton>
        </form>
      </div>

      <div className="my-6 flex items-center gap-3 text-[12px] font-medium text-muted">
        <span className="h-px flex-1 bg-[#131b26]" />
        or
        <span className="h-px flex-1 bg-[#131b26]" />
      </div>

      <PasswordForm key={mode} mode={mode} />

      <p className="mt-8 text-center text-[13.5px] text-muted">
        {mode === "login" ? "New to Fathom?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="font-medium text-brand hover:underline"
        >
          {mode === "login" ? "Sign up" : "Log in"}
        </button>
      </p>
    </div>
  );
}

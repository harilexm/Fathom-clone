import Link from "next/link";
import { LoginForm } from "./login-form";
import { FathomLogo } from "@/components/fathom-logo";

const errors: Record<string, string> = {
  google: "Google sign-in could not start. Please try again.",
  guest: "Demo sign-in is unavailable. Please try again.",
  callback: "Sign-in could not be completed. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col bg-[#06080d] text-[#f1f5f9]">
      <header className="flex w-full items-center justify-center pt-12">
        <FathomLogo href="/" size="md" />
      </header>

      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-center justify-center gap-12 px-6 pb-12 pt-8 lg:flex-row lg:justify-between lg:gap-24 lg:pb-24 lg:pt-0">

        {/* Left Side: Quote */}
        <div className="hidden max-w-[560px] flex-col lg:flex">
          <div className="relative w-fit">
            <span className="absolute -left-12 -top-12 text-[120px] font-black leading-none text-[#131b26]/50">“</span>
            <h2 className="relative z-10 whitespace-nowrap font-medium leading-[1.3] tracking-tight text-[#f1f5f9]">
              <span className="text-[24px]">Focus on the conversation, not the notes.</span><br/>
              <span className="text-[32px] text-[#60a5fa]">Fathom remembers every detail.</span>
            </h2>
            <span className="absolute -bottom-24 -right-8 text-[120px] font-black leading-none text-[#131b26]/50">”</span>
          </div>
          <div className="mt-10 text-[14px] text-muted">
            <p className="font-semibold text-[#f1f5f9]">Umer Abdullah</p>
            <p>Founder & CEO</p>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full max-w-[400px] shrink-0">
          <LoginForm initialError={error ? errors[error] ?? errors.callback : null} />
          <p className="mt-6 text-center text-[11.5px] text-muted">
            By using Fathom, you agree to the <Link href="/terms-of-service" className="underline hover:text-[#f1f5f9]">Terms of Service</Link> and <Link href="/privacy-policy" className="underline hover:text-[#f1f5f9]">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}

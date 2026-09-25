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
    <main className="flex min-h-screen flex-col bg-[#0a0e17] text-[#e8eef8]">
      <header className="flex w-full items-center justify-center pt-12">
        <FathomLogo href="/" size="md" />
      </header>

      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-center justify-center gap-12 px-6 pb-12 pt-8 lg:flex-row lg:justify-between lg:gap-24 lg:pb-24 lg:pt-0">

        {/* Left Side: Quote */}
        <div className="hidden max-w-[560px] flex-col lg:flex">
          <div className="relative w-fit">
            <span className="absolute -left-12 -top-12 text-[120px] font-black leading-none text-[#1e2a3a]/40">“</span>
            <h2 className="relative z-10 whitespace-nowrap font-medium leading-[1.3] tracking-tight text-[#e8eef8]">
              <span className="text-[24px]">Focus on the conversation, not the notes.</span><br/>
              <span className="text-[32px] text-[#ffab40]">Fathom remembers every detail.</span>
            </h2>
            <span className="absolute -bottom-24 -right-8 text-[120px] font-black leading-none text-[#1e2a3a]/40">”</span>
          </div>
          <div className="mt-10 text-[14px] text-[#8e9bac]">
            <p className="font-semibold text-[#c0cce0]">Umer Abdullah</p>
            <p>Founder & CEO</p>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full max-w-[400px] shrink-0">
          <LoginForm initialError={error ? errors[error] ?? errors.callback : null} />
          <p className="mt-6 text-center text-[11.5px] text-[#7b8da3]">
            By using Fathom, you agree to the <a href="#" className="underline hover:text-[#c0cce0]">Terms of Service</a> and <a href="#" className="underline hover:text-[#c0cce0]">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </main>
  );
}

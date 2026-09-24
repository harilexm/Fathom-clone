import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fathom — Meeting intelligence",
  description: "A thoughtful workspace for every meeting.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="font-sans">{children}</body></html>;
}

"use client";

import Link from "next/link";

interface FathomLogoProps {
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

export function FathomLogo({
  href = "/my-calls",
  className = "",
  size = "md",
  onClick,
}: FathomLogoProps) {
  const barSizes = {
    sm: {
      gap: "gap-[2px]",
      b1: "h-[12px] w-[3px]",
      b2: "h-[20px] w-[3px]",
      b3: "h-[15px] w-[3px]",
      b4: "h-[10px] w-[3px]",
      text: "text-[15px] tracking-[.18em]",
    },
    md: {
      gap: "gap-[3px]",
      b1: "h-[16px] w-[4px]",
      b2: "h-[28px] w-[4px]",
      b3: "h-[20px] w-[4px]",
      b4: "h-[14px] w-[4px]",
      text: "text-[18px] tracking-[.2em]",
    },
    lg: {
      gap: "gap-[4px]",
      b1: "h-[20px] w-[5px]",
      b2: "h-[36px] w-[5px]",
      b3: "h-[26px] w-[5px]",
      b4: "h-[18px] w-[5px]",
      text: "text-[22px] tracking-[.22em]",
    },
  }[size];

  const content = (
    <span className={`inline-flex shrink-0 items-center gap-3 font-bold text-white ${barSizes.text} ${className}`}>
      <span aria-hidden="true" className={`flex items-center ${barSizes.gap}`}>
        <span className={`${barSizes.b1} rounded-full bg-[#2563eb]`} />
        <span className={`${barSizes.b2} rounded-full bg-[#3b82f6]`} />
        <span className={`${barSizes.b3} rounded-full bg-[#2563eb]`} />
        <span className={`${barSizes.b4} rounded-full bg-[#1d4ed8]`} />
      </span>
      <span>FATHOM</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className="flex shrink-0 items-center" aria-label="Fathom home">
        {content}
      </Link>
    );
  }

  return content;
}

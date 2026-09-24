import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";

export default function ShareNotFound() {
  return <div className="mx-auto max-w-xl px-5 py-24"><EmptyState icon={<LockKeyhole size={22} />} title="Link unavailable" description="Private meeting sharing has not been connected. This link is not a live share." action={<Link href="/my-calls"><Button>Go to My Calls</Button></Link>} /></div>;
}

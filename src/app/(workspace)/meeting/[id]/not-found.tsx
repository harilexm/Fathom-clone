import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState, Button } from "@/components/ui";

export default function MeetingNotFound() {
  return <EmptyState icon={<FileQuestion size={22} />} title="Meeting not found" description="This sample meeting doesn't exist in the workspace." action={<Link href="/my-calls"><Button>Back to My Calls</Button></Link>} />;
}

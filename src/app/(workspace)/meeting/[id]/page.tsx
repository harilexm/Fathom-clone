import { notFound } from "next/navigation";
import { MeetingWorkspace } from "@/components/meeting-workspace";
import { findMeeting } from "@/lib/sample-data";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = findMeeting(id);
  if (!meeting) notFound();
  return <MeetingWorkspace key={meeting.id} meeting={meeting} />;
}

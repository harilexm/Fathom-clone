"use client";

import { Button, ErrorState } from "@/components/ui";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState title="We couldn't open this page" description="Please try loading the workspace again." action={<Button onClick={reset}>Try again</Button>} />;
}

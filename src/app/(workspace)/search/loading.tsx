import { Card, LoadingState } from "@/components/ui";

export default function SearchLoading() {
  return <Card><LoadingState label="Opening search…" /></Card>;
}

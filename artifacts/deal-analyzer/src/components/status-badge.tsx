import { Badge } from "@/components/ui/badge";

export function DealStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'new':
      return <Badge variant="secondary">New</Badge>;
    case 'reviewing':
      return <Badge variant="warning">Reviewing</Badge>;
    case 'offer_submitted':
      return <Badge variant="primary">Offer Submitted</Badge>;
    case 'passed':
      return <Badge variant="destructive">Passed</Badge>;
    case 'closed':
      return <Badge variant="success">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function SignalBadge({ signal }: { signal: string | null | undefined }) {
  if (!signal) return null;
  
  switch (signal) {
    case 'strong_candidate':
      return <Badge variant="success" className="animate-pulse">Strong Buy</Badge>;
    case 'close_review_manually':
      return <Badge variant="warning">Review Close</Badge>;
    case 'likely_pass':
      return <Badge variant="destructive">Likely Pass</Badge>;
    default:
      return null;
  }
}

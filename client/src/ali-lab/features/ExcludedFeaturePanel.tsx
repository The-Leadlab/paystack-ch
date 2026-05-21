import { Link } from "wouter";

/** Shown for out-of-scope routes (e.g. /ali/bank-sync). */
export function ExcludedFeaturePanel({ featureId }: { featureId: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm space-y-3">
      <p className="font-medium text-foreground">Not in scope</p>
      <p className="text-muted-foreground">
        <strong>{featureId}</strong> (bank connections, CSV import, Open Banking / bLink) is explicitly
        excluded from Paystack.ch. Document upload + AI extraction remains the supported flow.
      </p>
      <Link href="/ali/budgeting" className="text-brand-red font-bold uppercase text-xs">
        Back to lab features
      </Link>
    </div>
  );
}

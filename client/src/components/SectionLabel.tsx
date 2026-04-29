/*
 * Palette F — "Jet d'Eau" Light Theme
 * SectionLabel: Oversized ordinal number + label for editorial section marking.
 */

interface SectionLabelProps {
  number: string;
  label: string;
}

export default function SectionLabel({ number, label }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <span className="font-data text-xs tracking-widest text-brand-red uppercase">
        {number}
      </span>
      <div className="h-px w-8 bg-brand-red/30" />
      <span className="font-display text-xs tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}

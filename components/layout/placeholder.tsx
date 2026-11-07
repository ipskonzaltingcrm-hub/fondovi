export function Placeholder({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{text}</p>
    </div>
  );
}

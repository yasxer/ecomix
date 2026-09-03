/**
 * En-tête de page de l'admin : même hiérarchie typographique partout, et un
 * emplacement constant pour l'action principale (qui passe sous le titre sur
 * mobile plutôt que de comprimer les deux sur une ligne).
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-500">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

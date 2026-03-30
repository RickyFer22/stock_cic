interface EmptyStateProps {
  icon?: string
  message: string
  sub?: string
}

export default function EmptyState({ icon = '📭', message, sub }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-3">{icon}</span>
      <p className="font-display font-semibold text-slate-600 text-lg uppercase tracking-wide">
        {message}
      </p>
      {sub && <p className="text-slate-400 text-sm mt-1 font-body">{sub}</p>}
    </div>
  )
}

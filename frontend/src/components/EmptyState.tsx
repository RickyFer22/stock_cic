interface EmptyStateProps {
  icon?: string
  message: string
  sub?: string
}

export default function EmptyState({ icon = '📭', message, sub }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-6xl mb-4" aria-hidden="true">{icon}</span>
      <p className="font-display font-black text-slate-400 text-xl uppercase tracking-widest">
        {message}
      </p>
      {sub && <p className="text-slate-500 font-medium text-sm mt-3 max-w-sm leading-relaxed">{sub}</p>}
    </div>
  )
}


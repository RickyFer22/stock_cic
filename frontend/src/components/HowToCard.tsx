type HowToCardProps = {
  title: string
  steps: string[]
}

export default function HowToCard({ title, steps }: HowToCardProps) {
  return (
    <div className="rounded-[--radius-card] border border-state-info-bg bg-state-info-bg/80 px-4 py-3 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-state-info">{title}</div>
      <ol className="mt-2 text-sm text-ink-2 list-decimal list-inside space-y-1">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  )
}

type HowToCardProps = {
  title: string
  steps: string[]
}

export default function HowToCard({ title, steps }: HowToCardProps) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-sky-700">{title}</div>
      <ol className="mt-2 text-sm text-slate-700 list-decimal list-inside space-y-1">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  )
}

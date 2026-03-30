import Modal from './Modal'

type Tab = 'distributions' | 'items' | 'movements' | 'supervisor'

type HelpPanelProps = {
  open: boolean
  onClose: () => void
  currentTab: Tab
  showSupervisorHelp: boolean
}

const HELP_BY_TAB: Record<Tab, { title: string; steps: string[] }> = {
  distributions: {
    title: 'Como usar Egresos',
    steps: [
      'Toca "+ Registrar egreso" para abrir el formulario.',
      'Carga destino, tipo y articulos con sus cantidades.',
      'Confirma y revisa el listado para validar fecha, operador y observaciones.',
    ],
  },
  items: {
    title: 'Como usar Articulos',
    steps: [
      'Usa "+ Nuevo item" para crear un articulo con codigo unico.',
      'Usa "+ Ingresar stock" y "- Egresar stock" para mover inventario.',
      'Filtra por texto y exporta reportes para control mensual.',
    ],
  },
  movements: {
    title: 'Como usar Movimientos',
    steps: [
      'Aplica filtros por tipo y texto para encontrar registros rapido.',
      'Verifica columna tipo y cantidades para detectar errores de carga.',
      'Si algo no coincide, revisa en Egresos o Articulos el movimiento origen.',
    ],
  },
  supervisor: {
    title: 'Como usar Supervisor',
    steps: [
      'Revisa metricas de salud de stock y actividad de los ultimos 30 dias.',
      'Si eres admin, gestiona usuarios desde "Control de usuarios".',
      'Usa este panel para decidir compras, ajustes y prioridades.',
    ],
  },
}

export default function HelpPanel({ open, onClose, currentTab, showSupervisorHelp }: HelpPanelProps) {
  if (!open) return null

  const current = HELP_BY_TAB[currentTab]
  const commonTips = [
    'En celular puedes navegar desde la barra inferior fija.',
    'Si no ves una opcion, abre "Ayuda" y verifica tu rol de usuario.',
    'Ante cualquier duda, primero valida filtros y fechas activas.',
  ]

  return (
    <Modal title="Ayuda Rapida" onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="rounded-2xl border border-brand-green-200 bg-brand-green-50 px-4 py-3">
          <p className="text-sm font-bold text-brand-green-900 uppercase tracking-wide">{current.title}</p>
          <ol className="mt-2 space-y-2 text-sm text-slate-700 list-decimal list-inside">
            {current.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Consejos generales</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {commonTips.map((tip) => (
                <li key={tip}>• {tip}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Modulos disponibles</p>
            <div className="mt-2 text-sm text-slate-700 leading-relaxed">
              Egresos, Articulos y Movimientos para todos los roles.
              {showSupervisorHelp ? ' Supervisor habilitado para admin y supervisor.' : ' Supervisor solo para roles con permiso.'}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-brand-green-900 text-white text-sm font-bold uppercase tracking-wide hover:bg-brand-green-700 transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  )
}

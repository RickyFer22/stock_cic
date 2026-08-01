import Modal from './Modal'

type Tab = 'distributions' | 'items' | 'movements' | 'supervisor' | 'soporte'

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
  soporte: {
    title: 'Como usar Soporte Técnico',
    steps: [
      'Usa "+ Abrir Nuevo Ticket" para reportar problemas.',
      'El equipo de Modernización te responderá a la brevedad.',
      'Puedes revisar el historial de respuestas en cada ticket.',
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
        <div className="rounded-[--radius-card] border border-accent/25 bg-accent-soft px-4 py-3">
          <p className="text-sm font-bold text-accent uppercase tracking-wide">{current.title}</p>
          <ol className="mt-2 space-y-2 text-sm text-ink-2 list-decimal list-inside">
            {current.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[--radius-card] border border-rule bg-paper px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Consejos generales</p>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
              {commonTips.map((tip) => (
                <li key={tip}>• {tip}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-[--radius-card] border border-state-warn/25 bg-state-warn-bg px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-state-warn">Modulos disponibles</p>
            <div className="mt-2 text-sm text-ink-2 leading-relaxed">
              Egresos, Articulos y Movimientos para todos los roles.
              {showSupervisorHelp ? ' Supervisor habilitado para admin y supervisor.' : ' Supervisor solo para roles con permiso.'}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-accent-strong text-white text-sm font-bold uppercase tracking-wide hover:brightness-110 transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  )
}

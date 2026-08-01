import { useEffect, useState } from 'react'

type Tema = 'sistema' | 'claro' | 'oscuro'

const CLAVE = 'stockcic:tema'

/**
 * Interruptor de tema. El depósito puede tener pantallas con poca luz, y la
 * preferencia del sistema no siempre acompaña: quien trabaja de noche en un
 * equipo configurado en claro necesita poder forzarlo.
 *
 * 'sistema' quita el atributo y deja mandar a prefers-color-scheme; 'claro' y
 * 'oscuro' estampan data-theme en :root, que en tokens.css gana sobre la
 * consulta de medios en ambos sentidos.
 */
export default function ThemeToggle() {
  const [tema, setTema] = useState<Tema>(() => {
    const guardado = localStorage.getItem(CLAVE)
    return guardado === 'claro' || guardado === 'oscuro' ? guardado : 'sistema'
  })

  useEffect(() => {
    const raiz = document.documentElement
    if (tema === 'sistema') raiz.removeAttribute('data-theme')
    else raiz.setAttribute('data-theme', tema)
    localStorage.setItem(CLAVE, tema)
  }, [tema])

  const OPCIONES: { v: Tema; etiqueta: string; titulo: string }[] = [
    { v: 'claro', etiqueta: 'Claro', titulo: 'Usar siempre el tema claro' },
    { v: 'sistema', etiqueta: 'Auto', titulo: 'Seguir la preferencia del equipo' },
    { v: 'oscuro', etiqueta: 'Oscuro', titulo: 'Usar siempre el tema oscuro' },
  ]

  return (
    <div
      role="group"
      aria-label="Tema de la interfaz"
      className="inline-flex rounded-xl border border-rule bg-paper-2 p-0.5"
    >
      {OPCIONES.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => setTema(o.v)}
          title={o.titulo}
          aria-pressed={tema === o.v}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide
            transition-colors duration-[--dur-fast]
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus
            ${tema === o.v
              ? 'bg-accent-strong text-accent-ink'
              : 'text-ink-3 hover:text-ink-2'}`}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}

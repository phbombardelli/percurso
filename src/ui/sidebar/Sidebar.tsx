/**
 * Barra de ferramentas de inserção. Cada item é habilitado na fase em que
 * o objeto correspondente passa a existir no modelo.
 */
const TOOLS: { icon: string; label: string; phase: number }[] = [
  { icon: '▭', label: 'Pista', phase: 5 },
  { icon: '🖼', label: 'Imagem de fundo', phase: 6 },
  { icon: '⌗', label: 'Calibrar escala', phase: 6 },
  { icon: '▬', label: 'Obstáculo', phase: 7 },
  { icon: '✎', label: 'Traçado', phase: 8 },
  { icon: 'T', label: 'Texto', phase: 10 },
  { icon: '▤', label: 'Quadro técnico', phase: 10 },
  { icon: '▦', label: 'Tabela de alturas', phase: 10 },
  { icon: '🌳', label: 'Ornamento', phase: 11 },
];

export function Sidebar() {
  return (
    <nav className="sidebar">
      {TOOLS.map((t) => (
        <button key={t.label} disabled title={`${t.label} — fase ${t.phase}`}>
          <span className="icon">{t.icon}</span>
          <span className="label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

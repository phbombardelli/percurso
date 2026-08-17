import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  /** Atalho mostrado à direita. Só rótulo: quem trata é o Canvas. */
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export type MenuEntry = MenuItem | 'separator';

interface Props {
  label: string;
  entries: MenuEntry[];
  title?: string;
}

/**
 * Menu suspenso da barra superior.
 *
 * A barra crescia a cada recurso novo e passou a não caber na tela. Os
 * comandos de arquivo e de exibição são frequentes o bastante para
 * precisarem de nome, mas raros o bastante para não merecerem espaço
 * permanente — é exatamente o caso de um menu.
 */
export function Menu({ label, entries, title }: Props) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!aberto) return;

    // Fecha ao clicar fora ou no Esc. `pointerdown` em vez de `click`
    // para o menu sumir antes de o clique chegar ao canvas.
    const foraDaqui = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const noEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setAberto(false);
      }
    };
    document.addEventListener('pointerdown', foraDaqui, true);
    document.addEventListener('keydown', noEsc, true);
    return () => {
      document.removeEventListener('pointerdown', foraDaqui, true);
      document.removeEventListener('keydown', noEsc, true);
    };
  }, [aberto]);

  return (
    <div className="menu" ref={raiz}>
      <button
        className={aberto ? 'menu-trigger active' : 'menu-trigger'}
        title={title}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        {label}
      </button>

      {aberto && (
        <div className="menu-popup" role="menu">
          {entries.map((entry, i) =>
            entry === 'separator' ? (
              <hr key={`s${i}`} />
            ) : (
              <button
                key={entry.label}
                role="menuitem"
                disabled={entry.disabled}
                onClick={() => {
                  setAberto(false);
                  entry.onSelect();
                }}
              >
                <span>{entry.label}</span>
                {entry.shortcut && <em>{entry.shortcut}</em>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

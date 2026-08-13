import { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  value: number;
  unit?: string;
  decimals?: number;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}

/**
 * Campo numérico de ajuste fino. Aceita vírgula ou ponto como separador
 * decimal e só confirma no Enter ou ao sair do campo — digitar "1," não
 * pode aplicar um valor intermediário ao desenho. Setas ajustam pelo passo.
 */
export function NumberField({
  label,
  value,
  unit,
  decimals = 2,
  step = 1,
  min,
  max,
  disabled,
  onCommit,
}: Props) {
  const [text, setText] = useState(() => format(value, decimals));
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setText(format(value, decimals));
  }, [value, decimals]);

  const commit = (raw: string) => {
    const parsed = parse(raw);
    editing.current = false;
    if (parsed === null) {
      setText(format(value, decimals));
      return;
    }
    const clamped = clamp(parsed, min, max);
    setText(format(clamped, decimals));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <label className="field">
      <span>{label}</span>
      <span className="input-unit">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          onFocus={() => {
            editing.current = true;
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              editing.current = false;
              setText(format(value, decimals));
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const base = parse(text) ?? value;
              const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
              const next = clamp(base + delta, min, max);
              editing.current = false;
              setText(format(next, decimals));
              onCommit(next);
            }
          }}
        />
        {unit && <em>{unit}</em>}
      </span>
    </label>
  );
}

const format = (v: number, decimals: number): string =>
  v.toFixed(decimals).replace('.', ',').replace(/,?0+$/, (m) => (m.startsWith(',') ? '' : m));

function parse(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '' || !/^-?\d*\.?\d*$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function clamp(v: number, min?: number, max?: number): number {
  if (min !== undefined && v < min) return min;
  if (max !== undefined && v > max) return max;
  return v;
}

import { rectanglePoints } from '@core/geometry/outline';
import type { Vec2 } from '@core/geometry/vec';
import type { Arena } from '@core/model/types';
import { color } from '@render/style/tokens';

interface Props {
  arena: Arena;
  toPaper: (p: Vec2) => Vec2;
  /** Pixels por milímetro: alça com tamanho fixo em tela. */
  zoom: number;
  editingVertices: boolean;
  onVertexDown: (e: React.PointerEvent, index: number) => void;
  onCornerDown: (e: React.PointerEvent, corner: 0 | 1 | 2 | 3) => void;
  onEdgeDoubleClick: (index: number) => void;
}

const HANDLE_PX = 9;

/**
 * Alças da pista: cantos do retângulo ou vértices do contorno irregular.
 * Cromo de tela — fica fora do grupo exportável.
 */
export function ArenaHandles({
  arena,
  toPaper,
  zoom,
  editingVertices,
  onVertexDown,
  onCornerDown,
  onEdgeDoubleClick,
}: Props) {
  const mm = (px: number) => px / zoom;
  const half = mm(HANDLE_PX) / 2;

  if (arena.shape === 'rectangle') {
    const corners = rectanglePoints(arena.origin, arena.widthM, arena.heightM);
    return (
      <g data-part="arena-handles">
        {corners.map((c, i) => {
          const p = toPaper(c);
          return (
            <rect
              key={i}
              x={p.x - half}
              y={p.y - half}
              width={half * 2}
              height={half * 2}
              fill="#ffffff"
              stroke={color.selection}
              strokeWidth={mm(1.2)}
              pointerEvents="all"
              style={{ cursor: i === 0 || i === 2 ? 'nwse-resize' : 'nesw-resize' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onCornerDown(e, i as 0 | 1 | 2 | 3);
              }}
            />
          );
        })}
      </g>
    );
  }

  if (!editingVertices) return null;

  return (
    <g data-part="arena-handles">
      {arena.points.map((v, i) => {
        const a = toPaper(v);
        const next = toPaper(arena.points[(i + 1) % arena.points.length]!);
        const mid = { x: (a.x + next.x) / 2, y: (a.y + next.y) / 2 };
        return (
          <g key={i}>
            {/* Meio da aresta: duplo clique insere um vértice. */}
            <circle
              cx={mid.x}
              cy={mid.y}
              r={mm(HANDLE_PX) / 3}
              fill="#ffffff"
              stroke={color.selection}
              strokeWidth={mm(0.8)}
              opacity={0.55}
              pointerEvents="all"
              style={{ cursor: 'copy' }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onEdgeDoubleClick(i);
              }}
            />
            <circle
              cx={a.x}
              cy={a.y}
              r={mm(HANDLE_PX) / 2}
              fill={color.selection}
              stroke="#ffffff"
              strokeWidth={mm(1.2)}
              pointerEvents="all"
              style={{ cursor: 'move' }}
              data-vertex={i}
              onPointerDown={(e) => {
                e.stopPropagation();
                onVertexDown(e, i);
              }}
            />
          </g>
        );
      })}
    </g>
  );
}

/** Contorno em construção, enquanto o usuário clica os vértices. */
export function ArenaDraft({
  points,
  cursor,
  toPaper,
  zoom,
}: {
  points: Vec2[];
  cursor: Vec2 | null;
  toPaper: (p: Vec2) => Vec2;
  zoom: number;
}) {
  if (points.length === 0) return null;
  const mm = (px: number) => px / zoom;
  const projected = points.map(toPaper);
  const line = [...projected, ...(cursor ? [toPaper(cursor)] : [])];
  const d = `M ${line.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
  const first = projected[0]!;

  return (
    <g data-part="arena-draft" pointerEvents="none">
      {points.length > 2 && (
        <path
          d={`${d} Z`}
          fill={color.selectionFill}
          stroke="none"
        />
      )}
      <path d={d} fill="none" stroke={color.selection} strokeWidth={mm(1.5)} />
      {projected.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={mm(3)} fill={color.selection} />
      ))}
      {/* Primeiro vértice destacado: é onde se fecha o contorno. */}
      <circle
        cx={first.x}
        cy={first.y}
        r={mm(6)}
        fill="none"
        stroke={color.selection}
        strokeWidth={mm(1.2)}
      />
    </g>
  );
}

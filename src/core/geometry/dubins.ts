import { DEG, add, angleOf, distance, fromAngle, scale, sub, type Vec2 } from './vec';

/**
 * Caminho de Dubins: o mais curto entre dois pontos COM DIREÇÃO FIXA em
 * cada ponta, respeitando um raio mínimo de curva.
 *
 * É a descrição geométrica exata de como um cavaleiro liga um obstáculo ao
 * seguinte: sai reto do salto, faz a curva do maior raio que couber, e
 * chega reto e perpendicular ao próximo. O caminho ótimo é sempre a
 * combinação de três trechos, cada um reta ou arco de raio mínimo — são
 * seis palavras possíveis, e basta calcular as seis e ficar com a mais
 * curta que respeite as restrições da pista.
 *
 * Convenção de giro: o ângulo cresce no sentido horário porque o eixo Y do
 * modelo cresce para baixo (decisão 2). Quem olha para leste e aumenta o
 * ângulo vira para o SUL, que é a mão direita do cavaleiro. Portanto
 * ângulo crescente = curva à direita. A álgebra clássica de Dubins chama
 * esse mesmo giro de "L"; a tradução para a mão do cavaleiro acontece uma
 * vez só, em `maoDoGiro`.
 */

/** Ponto com direção: para onde o cavalo aponta ali. */
export interface Pose {
  pos: Vec2;
  /** Graus horários, 0 = leste. Mesma convenção de `rotation` no modelo. */
  heading: number;
}

export type Hand = 'esquerda' | 'direita';

export interface StraightSegment {
  kind: 'reta';
  from: Vec2;
  to: Vec2;
  length: number;
}

export interface ArcSegment {
  kind: 'arco';
  center: Vec2;
  radius: number;
  /** Graus horários, do começo e do fim do arco, medidos do centro. */
  startAngle: number;
  endAngle: number;
  hand: Hand;
  /** Ângulo varrido, em graus, sempre positivo. */
  sweep: number;
  length: number;
}

export type DubinsSegment = StraightSegment | ArcSegment;

export interface DubinsPath {
  /** Palavra já na mão do cavaleiro: "DRD", "ERE", "EDE"... (R = reta) */
  word: string;
  segments: DubinsSegment[];
  length: number;
  radius: number;
}

const TAU = Math.PI * 2;

/**
 * Resto em [0, 2pi). O `EPS` existe porque um giro que deveria ser nulo sai
 * do arredondamento como -1e-16 e viraria uma volta inteira de 360 graus,
 * expulsando da lista justamente o caminho mais curto.
 */
const EPS = 1e-10;
function mod2pi(a: number): number {
  const m = ((a % TAU) + TAU) % TAU;
  return m > TAU - EPS ? 0 : m;
}

/**
 * Raiz do comprimento da reta. Quando a reta é exatamente nula, a conta
 * chega em -4e-16 em vez de zero; sem esta folga a solução some da lista, e
 * o caso é justamente o das voltas certinhas, onde ela costuma ser a melhor.
 */
const retaEntre = (pSq: number): number | null =>
  pSq >= 0 ? Math.sqrt(pSq) : pSq > -EPS ? 0 : null;

/** Giro de sinal +1 (ângulo cresce) é a mão direita do cavaleiro. */
const maoDoGiro = (sign: 1 | -1): Hand => (sign === 1 ? 'direita' : 'esquerda');

type Turn = 1 | -1 | 0;

/** Uma palavra candidata: três giros e seus comprimentos normalizados. */
interface Word {
  /** +1 gira no sentido do ângulo crescente, -1 no contrário, 0 é reta. */
  turns: [Turn, Turn, Turn];
  /** Arco em radianos, reta em múltiplos do raio. `null` = não existe. */
  lens: [number, number, number] | null;
}

/**
 * As seis soluções fechadas, no referencial normalizado: começo na origem
 * apontando para `alpha`, fim em (d, 0) apontando para `beta`, raio 1.
 * Aqui `l` é o giro de ângulo crescente e `r` o de ângulo decrescente —
 * ainda na álgebra, sem mão de cavaleiro.
 */
function words(alpha: number, beta: number, d: number): Word[] {
  const sa = Math.sin(alpha);
  const sb = Math.sin(beta);
  const ca = Math.cos(alpha);
  const cb = Math.cos(beta);
  const cab = Math.cos(alpha - beta);
  const out: Word[] = [];

  // lsl
  {
    const p = retaEntre(2 + d * d - 2 * cab + 2 * d * (sa - sb));
    let lens: Word['lens'] = null;
    if (p !== null) {
      const tmp = Math.atan2(cb - ca, d + sa - sb);
      lens = [mod2pi(tmp - alpha), p, mod2pi(beta - tmp)];
    }
    out.push({ turns: [1, 0, 1], lens });
  }
  // rsr
  {
    const p = retaEntre(2 + d * d - 2 * cab + 2 * d * (sb - sa));
    let lens: Word['lens'] = null;
    if (p !== null) {
      const tmp = Math.atan2(ca - cb, d - sa + sb);
      lens = [mod2pi(alpha - tmp), p, mod2pi(tmp - beta)];
    }
    out.push({ turns: [-1, 0, -1], lens });
  }
  // lsr
  {
    const p = retaEntre(-2 + d * d + 2 * cab + 2 * d * (sa + sb));
    let lens: Word['lens'] = null;
    if (p !== null) {
      const tmp = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p);
      lens = [mod2pi(tmp - alpha), p, mod2pi(tmp - mod2pi(beta))];
    }
    out.push({ turns: [1, 0, -1], lens });
  }
  // rsl
  {
    const p = retaEntre(d * d - 2 + 2 * cab - 2 * d * (sa + sb));
    let lens: Word['lens'] = null;
    if (p !== null) {
      const tmp = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p);
      lens = [mod2pi(alpha - tmp), p, mod2pi(beta - tmp)];
    }
    out.push({ turns: [-1, 0, 1], lens });
  }
  // rlr
  {
    const c = (6 - d * d + 2 * cab + 2 * d * (sa - sb)) / 8;
    let lens: Word['lens'] = null;
    if (Math.abs(c) <= 1) {
      const p = TAU - Math.acos(c);
      const t = mod2pi(alpha - Math.atan2(ca - cb, d - sa + sb) + p / 2);
      lens = [t, p, mod2pi(alpha - beta - t + p)];
    }
    out.push({ turns: [-1, 1, -1], lens });
  }
  // lrl
  {
    const c = (6 - d * d + 2 * cab + 2 * d * (sb - sa)) / 8;
    let lens: Word['lens'] = null;
    if (Math.abs(c) <= 1) {
      const p = TAU - Math.acos(c);
      const t = mod2pi(-alpha + Math.atan2(cb - ca, d + sa - sb) + p / 2);
      lens = [t, p, mod2pi(mod2pi(beta) - alpha + p - t)];
    }
    out.push({ turns: [1, -1, 1], lens });
  }

  return out;
}

/**
 * Rótulo tirado dos trechos que sobraram, não do gabarito da palavra: um
 * trecho de comprimento zero não é desenhado e não deve ser anunciado. Uma
 * volta de arco único é "D", não "DRE".
 */
const wordLabel = (segments: DubinsSegment[]): string =>
  segments.map((s) => (s.kind === 'reta' ? 'R' : s.hand[0]!.toUpperCase())).join('');

/**
 * Monta a geometria de verdade a partir dos comprimentos normalizados,
 * andando do começo para o fim: cada trecho parte exatamente de onde o
 * anterior terminou, então não sobra emenda entre eles.
 */
function build(start: Pose, turns: Word['turns'], lens: number[], radius: number): DubinsPath {
  const segments: DubinsSegment[] = [];
  let pos = start.pos;
  let heading = start.heading;

  turns.forEach((turn, i) => {
    const norm = lens[i]!;
    if (norm <= 1e-12) return;

    if (turn === 0) {
      const len = norm * radius;
      const to = add(pos, scale(fromAngle(heading), len));
      segments.push({ kind: 'reta', from: pos, to, length: len });
      pos = to;
      return;
    }

    // O centro do arco fica a 90 graus da direção, do lado para o qual se vira.
    const sweep = norm / DEG;
    const toCenter = heading + turn * 90;
    const center = add(pos, scale(fromAngle(toCenter), radius));
    const startAngle = toCenter + 180;
    const endAngle = startAngle + turn * sweep;
    pos = add(center, scale(fromAngle(endAngle), radius));
    heading += turn * sweep;
    segments.push({
      kind: 'arco',
      center,
      radius,
      startAngle,
      endAngle,
      hand: maoDoGiro(turn),
      sweep,
      length: norm * radius,
    });
  });

  return {
    word: wordLabel(segments),
    segments,
    length: segments.reduce((s, seg) => s + seg.length, 0),
    radius,
  };
}

/**
 * Todos os caminhos válidos, do mais curto para o mais longo.
 *
 * Devolve a lista inteira, e não só o melhor, porque o mais curto nem
 * sempre serve: pode sair da pista ou passar por cima de outro obstáculo.
 * Quem escolhe é o assistente, que conhece a pista; aqui só mora a
 * geometria.
 */
export function dubinsPaths(start: Pose, end: Pose, radius: number): DubinsPath[] {
  if (!(radius > 0)) throw new Error('o raio da curva precisa ser positivo');

  const d = distance(start.pos, end.pos) / radius;
  const theta = mod2pi(angleOf(sub(end.pos, start.pos)) * DEG);
  const alpha = mod2pi(start.heading * DEG - theta);
  const beta = mod2pi(end.heading * DEG - theta);

  return words(alpha, beta, d)
    .filter((w): w is Word & { lens: [number, number, number] } => w.lens !== null)
    .map((w) => build(start, w.turns, w.lens, radius))
    .filter((p) => Number.isFinite(p.length) && chegaEm(p, end, radius))
    .sort((a, b) => a.length - b.length);
}

/**
 * Confere que o caminho montado termina mesmo na pose pedida.
 *
 * As fórmulas fechadas têm casos degenerados — uma reta de comprimento zero
 * faz um `atan2(0, 0)` decidir no ruído. Em vez de confiar na álgebra,
 * remonta-se a geometria e mede-se o resultado: candidato que não chega no
 * destino não entra na lista.
 */
function chegaEm(path: DubinsPath, end: Pose, radius: number): boolean {
  const fim = poseAt(path, path.length);
  const erroAngular = Math.abs(((fim.heading - end.heading) % 360 + 540) % 360 - 180);
  return distance(fim.pos, end.pos) < radius * 1e-9 && erroAngular < 1e-7;
}

/** O mais curto, ignorando pista e obstáculos. */
export function dubinsShortest(start: Pose, end: Pose, radius: number): DubinsPath | null {
  return dubinsPaths(start, end, radius)[0] ?? null;
}

/**
 * Pose a `s` metros do começo do caminho. Fora do intervalo, devolve a
 * ponta mais próxima — quem amostra não precisa cuidar da borda.
 */
export function poseAt(path: DubinsPath, s: number): Pose {
  const ultimo = path.segments.length - 1;
  if (ultimo < 0) throw new Error('caminho sem trechos');
  let restante = Math.max(0, s);
  for (let i = 0; i < ultimo; i++) {
    const seg = path.segments[i]!;
    if (restante <= seg.length) return poseInSegment(seg, restante);
    restante -= seg.length;
  }
  const fim = path.segments[ultimo]!;
  return poseInSegment(fim, Math.min(restante, fim.length));
}

function poseInSegment(seg: DubinsSegment, s: number): Pose {
  if (seg.kind === 'reta') {
    const heading = angleOf(sub(seg.to, seg.from));
    return { pos: add(seg.from, scale(fromAngle(heading), s)), heading };
  }
  const turn = seg.hand === 'direita' ? 1 : -1;
  const ang = seg.startAngle + (turn * (s / seg.radius)) / DEG;
  return {
    pos: add(seg.center, scale(fromAngle(ang), seg.radius)),
    heading: ang + turn * 90,
  };
}

/** Pontos igualmente espaçados ao longo do caminho, para checagens. */
export function samplePath(path: DubinsPath, stepM: number): Vec2[] {
  const n = Math.max(1, Math.ceil(path.length / stepM));
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) out.push(poseAt(path, (path.length * i) / n).pos);
  return out;
}

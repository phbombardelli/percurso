import { describe, expect, it } from 'vitest';
import { distance, normalizeAngle, type Vec2 } from './vec';
import {
  dubinsPaths,
  dubinsShortest,
  poseAt,
  samplePath,
  type ArcSegment,
  type DubinsPath,
  type Pose,
} from './dubins';

const pose = (x: number, y: number, heading: number): Pose => ({ pos: { x, y }, heading });

/** Diferença angular assinada, em graus, no intervalo (-180, 180]. */
const angDiff = (a: number, b: number) => {
  const d = normalizeAngle(a - b);
  return d > 180 ? d - 360 : d;
};

/** Confere que o caminho realmente sai de `a` e chega em `b`. */
function chegaEmCasa(path: DubinsPath, a: Pose, b: Pose, tol = 1e-9) {
  const inicio = poseAt(path, 0);
  const fim = poseAt(path, path.length);
  expect(distance(inicio.pos, a.pos)).toBeLessThan(tol);
  expect(Math.abs(angDiff(inicio.heading, a.heading))).toBeLessThan(1e-7);
  expect(distance(fim.pos, b.pos)).toBeLessThan(tol);
  expect(Math.abs(angDiff(fim.heading, b.heading))).toBeLessThan(1e-7);
}

describe('caminho de Dubins', () => {
  it('em linha reta é a distância, sem curva nenhuma', () => {
    const p = dubinsShortest(pose(0, 0, 0), pose(40, 0, 0), 12)!;
    expect(p.length).toBeCloseTo(40, 9);
    expect(p.segments).toHaveLength(1);
    expect(p.segments[0]!.kind).toBe('reta');
  });

  it('as seis palavras chegam todas ao mesmo destino', () => {
    const a = pose(0, 0, 0);
    const b = pose(35, 22, 130);
    const caminhos = dubinsPaths(a, b, 11);
    expect(caminhos.length).toBeGreaterThanOrEqual(4);
    for (const c of caminhos) chegaEmCasa(c, a, b, 1e-7);
  });

  it('a lista vem ordenada e a mais curta é a primeira', () => {
    const caminhos = dubinsPaths(pose(0, 0, 0), pose(30, 18, 90), 10);
    const comprimentos = caminhos.map((c) => c.length);
    expect([...comprimentos].sort((x, y) => x - y)).toEqual(comprimentos);
    expect(dubinsShortest(pose(0, 0, 0), pose(30, 18, 90), 10)!.length).toBe(comprimentos[0]);
  });

  it('nunca é mais curto que a linha reta entre os pontos', () => {
    const a = pose(0, 0, 20);
    const b = pose(45, -30, 200);
    const p = dubinsShortest(a, b, 12)!;
    expect(p.length).toBeGreaterThanOrEqual(distance(a.pos, b.pos) - 1e-9);
  });

  it('nenhum arco fecha mais que o raio mínimo', () => {
    const raio = 12;
    for (const heading of [0, 45, 90, 137, 180, 250, 300]) {
      for (const alvo of [
        pose(30, 0, heading),
        pose(-25, 18, heading),
        pose(8, 40, heading),
      ]) {
        for (const c of dubinsPaths(pose(0, 0, 0), alvo, raio)) {
          for (const seg of c.segments) {
            if (seg.kind === 'arco') expect(seg.radius).toBeCloseTo(raio, 12);
          }
        }
      }
    }
  });

  it('meia-volta sobre si mesma vale meia circunferência', () => {
    // De (0,0) para leste até (0, 2r) para oeste: o cavaleiro dá meia volta
    // colada, e o caminho é exatamente meio círculo de raio r.
    const r = 10;
    const p = dubinsShortest(pose(0, 0, 0), pose(0, 2 * r, 180), r)!;
    expect(p.length).toBeCloseTo(Math.PI * r, 6);
    expect(p.segments).toHaveLength(1);
    expect((p.segments[0] as ArcSegment).sweep).toBeCloseTo(180, 6);
  });

  it('ângulo crescente é a mão direita do cavaleiro', () => {
    // Saindo para leste (Y cresce para baixo), quem vira para o sul virou
    // para a direita. É a convenção que amarra o resto do assistente.
    const r = 10;
    const p = dubinsShortest(pose(0, 0, 0), pose(r, r, 90), r)!;
    const arco = p.segments.find((s): s is ArcSegment => s.kind === 'arco')!;
    expect(arco.hand).toBe('direita');
    expect(p.word).toBe('D');
    expect(p.length).toBeCloseTo((Math.PI * r) / 2, 6);
  });

  it('a mesma cena espelhada vira a mão contrária, mesmo comprimento', () => {
    const r = 10;
    const dir = dubinsShortest(pose(0, 0, 0), pose(r, r, 90), r)!;
    const esq = dubinsShortest(pose(0, 0, 0), pose(r, -r, 270), r)!;
    expect(esq.length).toBeCloseTo(dir.length, 9);
    expect((esq.segments[0] as ArcSegment).hand).toBe('esquerda');
  });

  it('raio maior alonga a volta quando é preciso virar', () => {
    const a = pose(0, 0, 0);
    const b = pose(20, 25, 180);
    const curto = dubinsShortest(a, b, 8)!;
    const largo = dubinsShortest(a, b, 14)!;
    expect(largo.length).toBeGreaterThan(curto.length);
  });

  it('vira nos dois sentidos quando o destino está atrás', () => {
    const caminhos = dubinsPaths(pose(0, 0, 0), pose(-40, 0, 180), 12);
    const maos = new Set(caminhos.map((c) => c.word));
    expect(maos.size).toBeGreaterThan(1);
  });

  it('o comprimento bate com a soma dos trechos', () => {
    for (const c of dubinsPaths(pose(3, -4, 33), pose(-18, 26, 205), 9.5)) {
      const soma = c.segments.reduce((s, seg) => s + seg.length, 0);
      expect(c.length).toBeCloseTo(soma, 12);
    }
  });

  it('recusa raio não positivo em vez de devolver bobagem', () => {
    expect(() => dubinsPaths(pose(0, 0, 0), pose(10, 0, 0), 0)).toThrow(/raio/);
    expect(() => dubinsPaths(pose(0, 0, 0), pose(10, 0, 0), -5)).toThrow(/raio/);
  });
});

describe('percorrer o caminho', () => {
  const a = pose(0, 0, 0);
  const b = pose(38, 26, 155);
  const p = dubinsShortest(a, b, 11)!;

  it('o passo é contínuo: sem salto entre trechos', () => {
    let anterior: Vec2 | null = null;
    const passo = p.length / 400;
    for (let s = 0; s <= p.length; s += passo) {
      const atual = poseAt(p, s).pos;
      if (anterior) expect(distance(anterior, atual)).toBeLessThan(passo * 1.001);
      anterior = atual;
    }
  });

  it('a direção nunca dá pulo: a curvatura respeita o raio', () => {
    const passo = 0.05;
    for (let s = passo; s <= p.length; s += passo) {
      const giro = Math.abs(angDiff(poseAt(p, s).heading, poseAt(p, s - passo).heading));
      // Girar mais que passo/raio significaria fechar mais que o raio mínimo.
      expect(giro).toBeLessThan((passo / p.radius / (Math.PI / 180)) * 1.001);
    }
  });

  it('fora do intervalo devolve as pontas', () => {
    expect(distance(poseAt(p, -50).pos, a.pos)).toBeLessThan(1e-9);
    expect(distance(poseAt(p, p.length + 50).pos, b.pos)).toBeLessThan(1e-7);
  });

  it('a poligonal amostrada subestima um pouco o arco, como deve', () => {
    const pontos = samplePath(p, 0.25);
    let soma = 0;
    for (let i = 1; i < pontos.length; i++) soma += distance(pontos[i - 1]!, pontos[i]!);
    expect(soma).toBeLessThanOrEqual(p.length + 1e-9);
    expect(soma).toBeGreaterThan(p.length - 0.01);
  });
});

describe('robustez em massa', () => {
  /**
   * Gerador determinístico: teste que varre milhares de casos precisa
   * falhar sempre no mesmo, senão não se conserta.
   */
  function random(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  }

  it('acha caminho para 5000 pares de poses, sempre chegando no destino', () => {
    const rnd = random(20260818);
    let semSolucao = 0;
    let maiorErro = 0;

    for (let i = 0; i < 5000; i += 1) {
      const raio = 6 + rnd() * 14;
      const a = pose(rnd() * 80 - 40, rnd() * 60 - 30, rnd() * 360);
      const b = pose(rnd() * 80 - 40, rnd() * 60 - 30, rnd() * 360);
      const caminhos = dubinsPaths(a, b, raio);
      if (caminhos.length === 0) {
        semSolucao += 1;
        continue;
      }
      const p = caminhos[0]!;
      expect(p.length).toBeGreaterThanOrEqual(distance(a.pos, b.pos) - 1e-9);
      const fim = poseAt(p, p.length);
      maiorErro = Math.max(maiorErro, distance(fim.pos, b.pos));
    }

    // Entre dois pontos quaisquer sempre existe caminho de Dubins; zero
    // aqui é o que prova que a filtragem por precisão não come solução boa.
    expect(semSolucao).toBe(0);
    expect(maiorErro).toBeLessThan(1e-6);
  });

  it('o mais curto é mesmo o mais curto entre os candidatos', () => {
    const rnd = random(7);
    for (let i = 0; i < 500; i += 1) {
      const raio = 8 + rnd() * 8;
      const a = pose(rnd() * 60, rnd() * 40, rnd() * 360);
      const b = pose(rnd() * 60, rnd() * 40, rnd() * 360);
      const caminhos = dubinsPaths(a, b, raio);
      const minimo = Math.min(...caminhos.map((c) => c.length));
      expect(caminhos[0]!.length).toBeCloseTo(minimo, 12);
    }
  });
});

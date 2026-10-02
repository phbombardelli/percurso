import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SideFlags } from './flags';

/** x do pano de cada cor, lido do SVG gerado. */
function panos(reversed: boolean) {
  const svg = renderToStaticMarkup(<svg><SideFlags halfMm={10} reversed={reversed} /></svg>);
  const x = (cor: string) => {
    const g = svg.split('<g').find((parte) => parte.includes(`flag-${cor}`))!;
    return Number(/<rect x="([-\d.]+)"/.exec(g)![1]);
  };
  return { vermelha: x('vermelha'), branca: x('branca') };
}

describe('bandeirolas (decisão 54)', () => {
  it('saltando para cima (−Y), a vermelha fica à direita (+X)', () => {
    const { vermelha, branca } = panos(false);
    expect(vermelha).toBeGreaterThan(0);
    expect(branca).toBeLessThan(0);
  });

  it('com o salto invertido, a vermelha passa para o outro lado', () => {
    const { vermelha, branca } = panos(true);
    expect(vermelha).toBeLessThan(0);
    expect(branca).toBeGreaterThan(0);
  });

  it('as duas ficam para fora do paraflanco', () => {
    const { vermelha, branca } = panos(false);
    expect(vermelha).toBeGreaterThan(10);
    expect(branca + 1.7).toBeLessThan(-10);
  });
});

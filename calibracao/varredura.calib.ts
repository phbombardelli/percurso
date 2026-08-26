import { it } from 'vitest';
import { buildCourseRide } from '@core/assist/courseRide';
import { DEFAULT_RIDE, type RideParams } from '@core/assist/ridePath';
import { pathLength } from '@core/model/path';
import { montaPercurso, PERCURSOS } from './percursos';

/**
 * Varredura de calibração.
 *
 * Não é teste de aprovação: é medição. Roda o assistente sobre os
 * percursos transcritos com centenas de combinações de parâmetros e
 * relata quais chegam perto das distâncias oficiais.
 *
 * Fica fora da suíte de sempre (o nome do arquivo não é `.test` por
 * acidente — é rodada à mão) porque o resultado é um relatório para ler,
 * não um verde ou vermelho.
 */

const RETAS = [6, 7, 8, 9, 10, 12];
const RAIOS = [9, 10, 11, 12, 14];
const APERTOS = [5, 6, 7, 8];
const MARGENS = [2, 3];

interface Resultado {
  params: RideParams;
  erros: { nome: string; oficial: number; medido: number; erroPct: number }[];
  piorPct: number;
}

it('varre os parâmetros e relata', () => {
  const docs = PERCURSOS.map((p) => ({ p, doc: montaPercurso(p) }));

  // Referência: onde estamos hoje.
  console.log('\\n=== HOJE, com os parâmetros atuais ===');
  for (const { p, doc } of docs) {
    const r = buildCourseRide(doc, DEFAULT_RIDE);
    const medido = r ? pathLength(r.path) : 0;
    const pct = ((medido - p.distanciaOficial) / p.distanciaOficial) * 100;
    console.log(
      `${p.nome}: oficial ${p.distanciaOficial} m, medido ${medido.toFixed(1)} m ` +
        `(${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`,
    );
  }

  const resultados: Resultado[] = [];
  for (const reta of RETAS) {
    for (const raio of RAIOS) {
      for (const aperto of APERTOS) {
        if (aperto >= raio) continue;
        for (const margem of MARGENS) {
          const params: RideParams = {
            ...DEFAULT_RIDE,
            approachM: reta,
            getawayM: reta,
            radiusM: raio,
            tightRadiusM: aperto,
            railMarginM: margem,
          };
          const erros = docs.map(({ p, doc }) => {
            const r = buildCourseRide(doc, params);
            const medido = r ? pathLength(r.path) : 0;
            return {
              nome: p.nome,
              oficial: p.distanciaOficial,
              medido,
              erroPct: ((medido - p.distanciaOficial) / p.distanciaOficial) * 100,
            };
          });
          resultados.push({
            params,
            erros,
            piorPct: Math.max(...erros.map((e) => Math.abs(e.erroPct))),
          });
        }
      }
    }
  }

  resultados.sort((a, b) => a.piorPct - b.piorPct);

  console.log(`\\n=== ${resultados.length} combinações; as 12 melhores ===`);
  for (const r of resultados.slice(0, 12)) {
    const p = r.params;
    console.log(
      `reta ${p.approachM} raio ${p.radiusM} aperto ${p.tightRadiusM} margem ${p.railMarginM} ` +
        `-> pior erro ${r.piorPct.toFixed(2)}%  [${r.erros.map((e) => e.medido.toFixed(0)).join(', ')}]`,
    );
  }

  console.log('\\n=== sensibilidade: quanto cada parâmetro move o número ===');
  const base = resultados.find(
    (r) =>
      r.params.approachM === 8 &&
      r.params.radiusM === 11 &&
      r.params.tightRadiusM === 6 &&
      r.params.railMarginM === 2,
  );
  if (base) {
    const medidoBase = base.erros[0]!.medido;
    const varia = (rotulo: string, filtro: (p: RideParams) => boolean) => {
      const iguais = resultados.filter((r) => filtro(r.params));
      const min = Math.min(...iguais.map((r) => r.erros[0]!.medido));
      const max = Math.max(...iguais.map((r) => r.erros[0]!.medido));
      console.log(`${rotulo}: de ${min.toFixed(0)} a ${max.toFixed(0)} m (base ${medidoBase.toFixed(0)})`);
    };
    varia('reta variando', (p) => p.radiusM === 11 && p.tightRadiusM === 6 && p.railMarginM === 2);
    varia('raio variando', (p) => p.approachM === 8 && p.tightRadiusM === 6 && p.railMarginM === 2);
    varia('aperto variando', (p) => p.approachM === 8 && p.radiusM === 11 && p.railMarginM === 2);
    varia('margem variando', (p) => p.approachM === 8 && p.radiusM === 11 && p.tightRadiusM === 6);
  }
}, 600_000);

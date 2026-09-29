import { mergeConfig } from 'vite';
import base from '../vite.config';

/**
 * Configuração da bancada de calibração (`npm run calibrar`).
 *
 * Os `.calib.ts` ficam fora da suíte normal de propósito: são relatórios
 * lentos, não testes. O script usava `vitest run --include ...`, opção que
 * o vitest instalado não reconhece — a bancada não rodava.
 */
export default mergeConfig(base, {
  test: { include: ['calibracao/**/*.calib.ts'] },
});

import { toMillimeterPrecision } from '@core/geometry/snap';
import type { Vec2 } from '@core/geometry/vec';
import { fitElementsToType, obstacleDef } from '@core/library/obstacles';
import type { CourseDocument, Obstacle, ObstacleType, ObjectId } from '@core/model/types';

/**
 * Operações sobre obstáculos. Tudo o que o desenhador decide — tipo,
 * número, letra, alturas, largura, direção do salto — passa por aqui.
 *
 * O programa não interpreta nada disso: não confere sequência, não valida
 * combinação, não julga altura. Só guarda e desenha o que foi decidido.
 */

function obstacleOf(doc: CourseDocument, id: ObjectId): Obstacle | null {
  const obj = doc.objects.find((o) => o.id === id);
  return obj?.kind === 'obstacle' && !obj.locked ? obj : null;
}

/** Troca o tipo preservando as alturas já digitadas. */
export function setObstacleType(doc: CourseDocument, id: ObjectId, type: ObstacleType): void {
  const obstacle = obstacleOf(doc, id);
  if (!obstacle) return;
  const def = obstacleDef(type);
  const eraSemLargura = obstacle.spreadM === null;

  obstacle.type = type;
  obstacle.elements = fitElementsToType(obstacle.elements, type);
  // A largura de salto só é reposta quando o obstáculo não tinha nenhuma:
  // um oxer já ajustado não pode voltar ao padrão ao virar tríplice.
  if (def.spreadM === null) obstacle.spreadM = null;
  else if (eraSemLargura) obstacle.spreadM = def.spreadM;
}

/** Numeração livre: o texto é do usuário, inclusive vazio (§14). */
export function setObstacleNumber(doc: CourseDocument, id: ObjectId, numero: string): void {
  const obstacle = obstacleOf(doc, id);
  if (obstacle) obstacle.number = numero.trim().slice(0, 6);
}

export function setObstacleLetter(
  doc: CourseDocument,
  id: ObjectId,
  letter: Obstacle['letter'],
): void {
  const obstacle = obstacleOf(doc, id);
  if (obstacle) obstacle.letter = letter;
}

/** Altura de um elemento. `null` = não informada. */
export function setElementHeight(
  doc: CourseDocument,
  id: ObjectId,
  index: number,
  height: number | null,
): void {
  const obstacle = obstacleOf(doc, id);
  const element = obstacle?.elements[index];
  if (!element) return;
  element.height = height === null || !Number.isFinite(height) || height <= 0
    ? null
    : toMillimeterPrecision(height);
}

export function addElement(doc: CourseDocument, id: ObjectId): void {
  const obstacle = obstacleOf(doc, id);
  if (obstacle && obstacle.elements.length < 6) obstacle.elements.push({ height: null });
}

export function removeElement(doc: CourseDocument, id: ObjectId, index: number): void {
  const obstacle = obstacleOf(doc, id);
  if (obstacle && obstacle.elements.length > 0) obstacle.elements.splice(index, 1);
}

export function setFaceWidth(doc: CourseDocument, id: ObjectId, widthM: number): void {
  const obstacle = obstacleOf(doc, id);
  if (obstacle && widthM > 0) obstacle.faceWidthM = toMillimeterPrecision(widthM);
}

/** `null` remove a largura de salto (o obstáculo passa a ser de uma linha). */
export function setSpread(doc: CourseDocument, id: ObjectId, spreadM: number | null): void {
  const obstacle = obstacleOf(doc, id);
  if (!obstacle) return;
  obstacle.spreadM =
    spreadM === null || !(spreadM > 0) ? null : toMillimeterPrecision(spreadM);
}

export function setArrow(
  doc: CourseDocument,
  id: ObjectId,
  patch: Partial<Obstacle['arrow']>,
): void {
  const obstacle = obstacleOf(doc, id);
  if (obstacle) obstacle.arrow = { ...obstacle.arrow, ...patch };
}

/** Inverte a direção do salto sem mexer na rotação do desenho. */
export function flipArrow(doc: CourseDocument, id: ObjectId): void {
  const obstacle = obstacleOf(doc, id);
  if (obstacle) obstacle.arrow.reversed = !obstacle.arrow.reversed;
}

export function setLabelOffset(
  doc: CourseDocument,
  id: ObjectId,
  which: 'numberLabel' | 'heightLabel',
  offsetM: Vec2,
): void {
  const obstacle = obstacleOf(doc, id);
  if (!obstacle) return;
  obstacle[which].offsetM = {
    x: toMillimeterPrecision(offsetM.x),
    y: toMillimeterPrecision(offsetM.y),
  };
}

export function setLabelVisible(
  doc: CourseDocument,
  id: ObjectId,
  which: 'numberLabel' | 'heightLabel',
  visible: boolean,
): void {
  const obstacle = obstacleOf(doc, id);
  if (obstacle) obstacle[which].visible = visible;
}

export function setObstacleNote(doc: CourseDocument, id: ObjectId, note: string): void {
  const obstacle = obstacleOf(doc, id);
  if (obstacle) obstacle.note = note;
}

/** Todos os obstáculos, na ordem em que estão no documento. */
export const allObstacles = (doc: CourseDocument): Obstacle[] =>
  doc.objects.filter((o): o is Obstacle => o.kind === 'obstacle');

/**
 * Renumera na ordem de inserção. É um utilitário explícito, nunca
 * automático: a sequência do percurso é decisão do desenhador (§14).
 */
export function renumberByInsertion(doc: CourseDocument): void {
  let n = 1;
  for (const obstacle of allObstacles(doc)) {
    if (obstacle.locked) continue;
    obstacle.number = String(n);
    obstacle.letter = '';
    n += 1;
  }
}

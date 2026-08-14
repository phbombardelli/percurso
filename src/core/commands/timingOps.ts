import { toMillimeterPrecision } from '@core/geometry/snap';
import type { CourseDocument, ObjectId, TimingLine, WingsAppearance } from '@core/model/types';

/** Operações da linha de partida/chegada. */

function lineOf(doc: CourseDocument, id: ObjectId): TimingLine | null {
  const obj = doc.objects.find((o) => o.id === id);
  return obj?.kind === 'timing' && !obj.locked ? obj : null;
}

export function setTimingLine(
  doc: CourseDocument,
  id: ObjectId,
  patch: Partial<Omit<TimingLine, 'id' | 'kind'>>,
): void {
  const line = lineOf(doc, id);
  if (!line) return;
  Object.assign(line, patch);
  if (!(line.widthM > 0)) line.widthM = 8;
  line.widthM = toMillimeterPrecision(line.widthM);
}

export function setTimingWings(
  doc: CourseDocument,
  id: ObjectId,
  patch: Partial<WingsAppearance>,
): void {
  const line = lineOf(doc, id);
  if (!line) return;
  line.wings = { ...line.wings, ...patch };
  if (!(line.wings.widthM > 0)) line.wings.widthM = 0.4;
  if (!(line.wings.depthM > 0)) line.wings.depthM = 0.8;
}

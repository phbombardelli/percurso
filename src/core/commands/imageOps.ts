import { distance, type Vec2 } from '@core/geometry/vec';
import { toMillimeterPrecision } from '@core/geometry/snap';
import { newId } from '@core/model/ids';
import type { Asset, BackgroundImage, CourseDocument, ObjectId } from '@core/model/types';

/**
 * Imagem de referência (satélite, planta existente, foto aérea) e sua
 * calibração de escala.
 *
 * A escala mora em `metersPerPixel`: um número só, que relaciona o pixel
 * do arquivo ao metro do terreno. Toda forma de ajustar a escala — pela
 * barra do Google Maps, digitando a largura em metros ou digitando a
 * própria relação — desemboca nele.
 */

function imageOf(doc: CourseDocument, id: ObjectId): BackgroundImage | null {
  const obj = doc.objects.find((o) => o.id === id);
  return obj?.kind === 'image' && !obj.locked ? obj : null;
}

export interface ImportedImage {
  asset: Asset;
  widthPx: number;
  heightPx: number;
}

/**
 * Insere a imagem já dimensionada para uma largura plausível, para ela não
 * nascer com quilômetros de lado nem invisível. A calibração é o passo
 * seguinte, e é o que dá a escala de verdade.
 */
export function addImage(
  doc: CourseDocument,
  imported: ImportedImage,
  origin: Vec2,
  initialWidthM = 100,
): BackgroundImage {
  const assetId = newId('ass');
  doc.assets[assetId] = imported.asset;

  const image: BackgroundImage = {
    id: newId('img'),
    kind: 'image',
    layer: 'background',
    locked: false,
    visible: true,
    z: 0,
    assetId,
    origin,
    metersPerPixel: initialWidthM / Math.max(1, imported.widthPx),
    widthPx: imported.widthPx,
    heightPx: imported.heightPx,
    rotation: 0,
    opacity: 0.6,
    calibration: null,
  };
  doc.objects.push(image);
  return image;
}

/**
 * Calibração por referência visual: o usuário marca dois pontos sobre a
 * imagem (as pontas da barra de escala do mapa, por exemplo) e informa a
 * distância real entre eles.
 *
 * O ponto A fica parado: é o que o usuário acabou de mirar, e vê-lo saltar
 * ao confirmar seria desconcertante.
 */
export function calibrateImage(
  doc: CourseDocument,
  id: ObjectId,
  pointA: Vec2,
  pointB: Vec2,
  knownDistanceM: number,
): boolean {
  const image = imageOf(doc, id);
  if (!image) return false;

  const measured = distance(pointA, pointB);
  if (!(measured > 1e-9) || !(knownDistanceM > 0)) return false;

  const factor = knownDistanceM / measured;
  image.metersPerPixel *= factor;
  image.origin = {
    x: toMillimeterPrecision(pointA.x + (image.origin.x - pointA.x) * factor),
    y: toMillimeterPrecision(pointA.y + (image.origin.y - pointA.y) * factor),
  };
  image.calibration = { pointA, pointB, knownDistanceM };
  return true;
}

/** Largura total da imagem no terreno, em metros. */
export const imageWidthM = (image: BackgroundImage): number =>
  image.widthPx * image.metersPerPixel;

export const imageHeightM = (image: BackgroundImage): number =>
  image.heightPx * image.metersPerPixel;

/** Redimensiona pela largura em metros, mantendo a origem. */
export function setImageWidthM(doc: CourseDocument, id: ObjectId, widthM: number): void {
  const image = imageOf(doc, id);
  if (!image || !(widthM > 0)) return;
  image.metersPerPixel = widthM / Math.max(1, image.widthPx);
}

export function setImageOpacity(doc: CourseDocument, id: ObjectId, opacity: number): void {
  const image = imageOf(doc, id);
  if (image) image.opacity = Math.min(1, Math.max(0, opacity));
}

export function setImageRotation(doc: CourseDocument, id: ObjectId, degrees: number): void {
  const image = imageOf(doc, id);
  if (image) image.rotation = degrees;
}

/**
 * Remove a imagem e, com ela, o arquivo embutido — desde que nenhum outro
 * objeto ainda o use. Sem isso o projeto engordaria a cada troca de imagem.
 */
export function removeImage(doc: CourseDocument, id: ObjectId): void {
  const obj = doc.objects.find((o) => o.id === id);
  if (obj?.kind !== 'image') return;
  const { assetId } = obj;
  doc.objects = doc.objects.filter((o) => o.id !== id);
  const aindaEmUso = doc.objects.some((o) => o.kind === 'image' && o.assetId === assetId);
  if (!aindaEmUso) delete doc.assets[assetId];
}

/** Remove arquivos embutidos que nenhum objeto referencia mais. */
export function pruneAssets(doc: CourseDocument): string[] {
  const usados = new Set(
    doc.objects.filter((o) => o.kind === 'image').map((o) => o.assetId),
  );
  const removidos: string[] = [];
  for (const key of Object.keys(doc.assets)) {
    if (!usados.has(key)) {
      delete doc.assets[key];
      removidos.push(key);
    }
  }
  return removidos;
}

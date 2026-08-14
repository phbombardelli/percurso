import {
  calibrateImage,
  imageHeightM,
  imageWidthM,
  removeImage,
  setImageOpacity,
  setImageWidthM,
} from '@core/commands/imageOps';
import { distance } from '@core/geometry/vec';
import type { BackgroundImage } from '@core/model/types';
import { formatMeters } from '@core/scale/units';
import { useDocumentStore } from '@store/documentStore';
import { useEditorStore } from '@store/editorStore';
import { NumberField } from './NumberField';

export function ImagePanel({ image }: { image: BackgroundImage }) {
  const { doc, apply } = useDocumentStore();
  const { calibration, beginCalibration, cancelCalibration, clearSelection } = useEditorStore();
  const asset = doc.assets[image.assetId];
  const calibrando = calibration?.imageId === image.id;

  const confirmar = () => {
    const a = calibration?.pointA;
    const b = calibration?.pointB;
    if (!a || !b) return;
    const medida = distance(a, b);
    const resposta = window.prompt(
      'Qual é a distância real entre os dois pontos, em metros?\n' +
        `(a escala atual diz ${formatMeters(medida)} m)`,
      formatMeters(medida),
    );
    if (resposta === null) return;
    const valor = Number(resposta.replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      window.alert('Informe uma distância maior que zero.');
      return;
    }
    apply('Calibrar escala', (d) => {
      calibrateImage(d, image.id, a, b, valor);
    });
    cancelCalibration();
  };

  return (
    <>
      <p className="note">
        {asset?.name ?? 'arquivo ausente'} · {image.widthPx}×{image.heightPx} px
      </p>

      <h3>Escala</h3>
      <NumberField
        label="Largura"
        unit="m"
        value={imageWidthM(image)}
        decimals={2}
        step={1}
        min={0.1}
        disabled={image.locked}
        onCommit={(v) => apply('Largura da imagem', (d) => setImageWidthM(d, image.id, v))}
      />
      <p className="note">
        Altura {formatMeters(imageHeightM(image))} m · 1 px ={' '}
        {formatMeters(image.metersPerPixel, 4)} m
      </p>

      {calibrando ? (
        <div className="calibration-box">
          <p className="note">
            {!calibration?.pointA
              ? 'Clique na primeira ponta da referência (a barra de escala do mapa, por exemplo).'
              : !calibration?.pointB
                ? 'Agora clique na outra ponta.'
                : `Medida atual: ${formatMeters(distance(calibration.pointA, calibration.pointB))} m.`}
          </p>
          <div className="row-buttons">
            <button
              disabled={!calibration?.pointA || !calibration?.pointB}
              onClick={confirmar}
            >
              Informar distância real
            </button>
            <button onClick={cancelCalibration}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="row-buttons">
          <button disabled={image.locked} onClick={() => beginCalibration(image.id)}>
            Calibrar por referência
          </button>
        </div>
      )}

      {image.calibration && !calibrando && (
        <p className="note dim">
          Calibrada com {formatMeters(image.calibration.knownDistanceM)} m de referência.
        </p>
      )}

      <h3>Aparência</h3>
      <label className="field">
        <span>Transparência</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(image.opacity * 100)}
          disabled={image.locked}
          onChange={(e) =>
            apply(
              'Transparência da imagem',
              (d) => setImageOpacity(d, image.id, Number(e.target.value) / 100),
              'opacidade-imagem',
            )
          }
        />
      </label>
      <p className="note">{Math.round(image.opacity * 100)}% de opacidade</p>

      <div className="row-buttons">
        <button
          className="danger"
          onClick={() => {
            apply('Remover imagem', (d) => removeImage(d, image.id));
            clearSelection();
          }}
        >
          Remover imagem
        </button>
      </div>
    </>
  );
}

# Decisões técnicas

Registro das decisões que não são óbvias no código. Cada uma explica o
*porquê*, para que uma futura alteração seja consciente e não acidental.

---

## 1. Geometria em metros, anotação em milímetros de papel

Um croqui tem dois tipos de medida que se comportam de forma oposta ao
mudar a escala:

- **Geometria real** (pista, obstáculo, traçado) escala com o desenho → metros.
- **Anotação** (espessura de linha, corpo de texto, seta) **não** escala →
  milímetros de papel.

Em 1:500 o número "7" precisa continuar com ~3 mm de altura impressa. Se a
anotação vivesse em metros, viraria um ponto ilegível.

Consequência: `render/style/tokens.ts` está todo em mm de papel, e a
conversão passa por `page.printScale`.

## 2. Eixo Y cresce para baixo

Igual ao SVG. A alternativa cartesiana obriga a inverter a matriz em toda
ida e volta e é fonte permanente de bugs de rotação e texto espelhado.

Rotação: **graus, sentido horário, 0° = leste**.

Custo aceito: `y = 17,40 m` significa 17,40 m a partir da borda superior.

## 3. A tela é WYSIWYG com o papel

O espaço de coordenadas do SVG é **milímetro de papel**. O zoom do viewport
é `px por mm`. Trocar a escala de impressão muda visivelmente a proporção
entre anotação e desenho — exatamente como sairá impresso. O desenhador vê
o problema de legibilidade na tela, não no papel.

## 4. Rotação e posição são absolutas, nunca acumuladas

Girar 5° dez vezes grava `rotation = 50`, jamais `rotation += 5` dez vezes.
Evita deriva de ponto flutuante e mantém o painel de propriedades honesto.

## 5. Uma única função de renderização

`render/renderDocument.tsx` recebe `mode: 'screen' | 'paper'`. Tela,
impressão e PDF consomem a mesma função. Não existe gerador de PDF paralelo
que possa divergir do que se vê na tela — a causa nº 1 de "na tela está
certo, no papel sai diferente".

## 6. Restrições de SVG impostas pela exportação em PDF

O conversor SVG→PDF (`svg2pdf.js`, fase 2) não suporta tudo. Valem desde o
primeiro commit, porque retroagi-las depois é caro:

1. **Nenhum `<foreignObject>`** na árvore exportável. Quadro técnico e
   tabela de alturas são `<rect>` + `<text>` + `<line>` nativos.
2. **Estilo por atributos de apresentação inline**, não por classe CSS.
3. **Sem `filter`, `mask` ou gradiente complexo.**
4. **Símbolos como `<symbol>`/`<use>`.**
5. **Fonte única com métricas conhecidas** (Helvetica no MVP; embutir TTF
   depois, se necessário).

O overlay de seleção fica **fora** do grupo exportável.

## 7. Estado de edição separado do documento

`documentStore` é o que se salva. `editorStore` (zoom, pan, seleção,
ferramenta ativa) é efêmero: não entra no arquivo nem no histórico.

## 8. Histórico por patches do Immer

`produceWithPatches` devolve patch e patch inverso. Undo/redo em ~60 linhas,
transacional e correto. `mergeKey` coalesce um gesto contínuo (arrastar,
girar) em **uma única entrada de undo**, não uma por pixel.

## 9. Gestos contínuos não passam pelo React

Arrastar, girar e mover a vista escrevem `transform` direto no nó DOM via
ref e só fazem *commit* de um comando ao soltar o mouse. Mantém 60 fps e é
o que sustenta a decisão 8. (A implementar na fase 3.)

## 10. Toda a matemática de viewport usa o tamanho do SVG, não do contêiner

O contêiner do canvas inclui as réguas da interface; o SVG não. Usar um em
um lugar e outro em outro desloca cursor e zoom em meia régua — bug real
encontrado na verificação da fase 1. `Canvas.tsx` deriva `size` uma vez e
usa em todos os pontos.

## 11. Escalas redondas

"Ajustar ao papel" nunca devolve 1:237. Arredonda para a escala redonda
imediatamente superior (`STANDARD_SCALES`), como em desenho técnico.

## 12. Trocar escala ou formato não move o desenho sozinho

`centerOnPage` é uma ação explícita do usuário. Reposicionamento automático
é surpresa ruim em ferramenta técnica.

---

## Ordem das fases

Três ajustes em relação ao plano original, para reduzir retrabalho:

- **Escala antes do editor** — construir em pixels e converter depois
  obrigaria a reescrever o núcleo de coordenadas.
- **Spike de PDF na fase 2** — o maior risco do projeto precisa ser
  validado com 800 linhas, não com 8.000.
- **Persistência na fase 4** — cada fase seguinte já nasce serializável e
  testada como tal.

## Fora do MVP

Multi-página; editor de símbolos customizados; exportação DXF/SVG/PNG;
templates; camadas do usuário; numeração automática pela ordem do traçado;
tabela automática de distâncias; agrupamento; Electron/Tauri; i18n; modo
escuro. A arquitetura preserva o caminho de volta para todos.

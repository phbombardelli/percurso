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

Verificadas na fase 2 com PDFs reais gerados e inspecionados
(`svg2pdf.js` 2.x + `jsPDF` 4.2.1). Valem desde o primeiro commit, porque
retroagi-las depois é caro.

**Funciona, confirmado no PDF:**

- Acentuação completa em Helvetica/WinAnsi (`Obstáculo`, `Combinação`,
  `Três`, `Água`, `Ângulo`, `°`, `×`, `·`).
- Corpo de texto de 1,8 mm a 7 mm; espessuras de 0,13 mm a 1,0 mm.
- Tracejados, inclusive sobre curva de Bézier.
- `transform` com `rotate` em grupo e em texto; `text-anchor` e
  `dominant-baseline`.
- Imagem raster embutida por data URL — vira `/Subtype /Image` de verdade.
- Página em milímetros exatos: A4 paisagem sai `MediaBox` 841,89 × 595,28 pt
  e A3 paisagem 1190,55 × 841,89 pt.

**Não funciona — proibido na árvore exportável:**

1. **`<foreignObject>`.** Quadro técnico e tabela de alturas são `<rect>` +
   `<text>` + `<line>` nativos.
2. **`<symbol>` + `<use>`.** Gera um Form XObject com `BBox [0 0 0 0]`: o
   conteúdo some do PDF. Símbolos de obstáculo são **grupos `<g>` diretos**,
   repetidos por instância. Com ~40 obstáculos o custo de DOM é irrelevante
   perto do risco.
3. **Travessão `—`, meia-risca `–` e sinal de menos `−`.** O travessão e a
   meia-risca desaparecem; o `−` sai como `"`. Usar hífen ASCII `-`.
   Vale para "não informado" na tabela de alturas.
4. **Estilo por classe CSS externa** — usar atributos de apresentação inline.
5. **`filter`, `mask`, gradiente complexo.**

Fonte única com métricas conhecidas (Helvetica no MVP; embutir TTF depois,
se necessário).

O overlay de seleção fica **fora** do grupo exportável.

Ao atualizar `svg2pdf.js` ou `jsPDF`, reexecutar a folha de diagnóstico
(`exportDiagnosticPdf`) e reconferir esta lista.

## 7. Estado de edição separado do documento

`documentStore` é o que se salva. `editorStore` (zoom, pan, seleção,
ferramenta ativa) é efêmero: não entra no arquivo nem no histórico.

## 8. Histórico por patches do Immer

`produceWithPatches` devolve patch e patch inverso. Undo/redo em ~60 linhas,
transacional e correto. `mergeKey` coalesce um gesto contínuo (arrastar,
girar) em **uma única entrada de undo**, não uma por pixel.

## 9. Gestos contínuos são limitados a um quadro, com flush no fim

Arrastar e girar aplicam a alteração no documento no máximo uma vez por
`requestAnimationFrame`, todas coalescidas em **uma** entrada de desfazer
pela decisão 8. Ao soltar o ponteiro, o gesto faz *flush* do último valor
pendente de forma síncrona: sem isso, o movimento final se perde quando o
quadro não chega a rodar (aba em segundo plano) — falha encontrada na
verificação da fase 3.

O plano original era escrever `transform` direto no nó DOM durante o gesto
e só tocar o modelo ao soltar. Não foi necessário: com algumas dezenas de
objetos, a reconciliação do React por quadro é barata. A otimização
continua possível sem mudar nada fora de `useObjectGestures`, e só deve
ser feita se a medição em um croqui real acusar perda de quadros.

Complemento: `setPointerCapture` **nunca pode derrubar um gesto**. Ele
lança quando o ponteiro já foi liberado, e o gesto precisa estar
registrado antes da chamada, não depois.

## 10. Toda a matemática de viewport usa o tamanho do SVG, não do contêiner

O contêiner do canvas inclui as réguas da interface; o SVG não. Usar um em
um lugar e outro em outro desloca cursor e zoom em meia régua — bug real
encontrado na verificação da fase 1. `Canvas.tsx` deriva `size` uma vez e
usa em todos os pontos.

## 11. O laço de seleção seleciona por contenção

Selecionar por interseção arrastaria a pista junto em qualquer laço
desenhado sobre ela — a pista cobre toda a área de trabalho. Só entra na
seleção o objeto inteiramente contido no retângulo, como em qualquer
editor gráfico.

## 12. Escalas redondas

"Ajustar ao papel" nunca devolve 1:237. Arredonda para a escala redonda
imediatamente superior (`STANDARD_SCALES`), como em desenho técnico.

## 13. Trocar escala ou formato não move o desenho sozinho

`centerOnPage` é uma ação explícita do usuário. Reposicionamento automático
é surpresa ruim em ferramenta técnica.

## 14. Arquivo de projeto em JSON legível, com envelope versionado

`.pcs` é JSON indentado, não um binário nem um zip. Um croqui é documento
de trabalho que pode precisar ser recuperado anos depois, possivelmente
sem este programa à mão; formato legível é seguro de graça, e o custo em
tamanho é irrelevante (um croqui completo dá alguns kB, e as imagens de
fundo já vão embutidas como data URL de todo jeito).

O envelope (`format`, `schemaVersion`, `savedAt`, `appVersion`) fica
separado do documento para que a versão possa ser lida **antes** de
qualquer tentativa de interpretar o conteúdo. A ordem na leitura é:
analisar → conferir envelope → **migrar** → validar. Migrar antes de
validar é o que permite abrir um arquivo antigo que já não passaria na
validação de hoje.

Migrações são funções sobre JSON cru, nunca sobre os tipos do modelo — os
tipos vão continuar mudando, e uma migração antiga escrita sobre eles
deixaria de compilar. Uma vez publicada, uma migração nunca mais muda.

## 15. Na leitura, geometria é erro; acessório é aviso

- Página, escala, coordenadas, rotações: **erro**, a abertura para. Abrir
  em silêncio um croqui com medidas erradas é pior do que não abrir.
- Camada faltando, objeto de tipo desconhecido (gravado por versão mais
  nova), campo acessório ausente: **aviso**, o resto do arquivo abre.

Nunca "consertar" uma coordenada em silêncio.

## 16. Gravar por cima quando o navegador permite

Com a File System Access API (Chrome, Edge), "Salvar" grava no mesmo
arquivo. Sem ela (Firefox, Safari), cai para download — o usuário perde o
"salvar por cima", não o trabalho. É por isso que o estado "não salvo"
precisa ficar visível na barra superior, e que existe confirmação antes de
descartar alterações e aviso do navegador ao fechar.

Não há salvamento automático nem rascunho local, por pedido explícito: o
usuário decide quando salvar.

## 17. Uma única fonte para o contorno da pista

`arenaPoints()` é a única forma de obter os vértices. O desenho, a
envoltória, o teste de clique, o perímetro e a área consomem essa função —
antes o retângulo era reconstruído em cada lugar, e bastaria um deles
esquecer o caso do polígono para o clique deixar de bater com o traço.

A régua de perímetro usa a **caixa envolvente**, não o contorno: mesmo num
contorno irregular ela continua sendo uma referência retilínea, como nos
croquis impressos.

Converter retângulo em contorno livre é caminho de mão única. O contrário
teria de jogar fora o desenho do usuário para caber num retângulo.

## 18. Estado que o evento consulta, e não o que o render capturou

Manipuladores de ponteiro leem a ferramenta ativa de
`useEditorStore.getState()` no instante do evento. Lida do render, o
primeiro clique logo depois de trocar de ferramenta ainda usaria a
anterior — o React só re-renderiza no microtask seguinte. Falha real
encontrada na verificação da fase 5.

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

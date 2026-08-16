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

## 19. A escala da imagem é um número só

`metersPerPixel` relaciona o pixel do arquivo ao metro do terreno. Todas as
formas de ajustar — calibrar pela barra do mapa, digitar a largura em
metros — desembocam nele, e o desenho aplica esse único fator num único
`transform`. Guardar largura e escala em separado seria convidar os dois a
divergirem.

Na calibração, o **ponto A fica parado**: é o que o usuário acabou de
mirar, e vê-lo saltar ao confirmar a distância seria desconcertante. A
origem da imagem é recalculada em torno dele.

O clique da calibração **não usa snap**. Alinhar a mira ao grid falsearia
a própria medição de referência.

## 20. O arquivo da imagem fica embutido no projeto

Data URL dentro do `.pcs`. O requisito é funcionar offline, e um croqui
que depende de um arquivo solto na pasta do usuário deixa de abrir no
primeiro backup mal feito. Em troca: limite de 12 MB por imagem, e o
arquivo é apagado junto quando nenhuma imagem o referencia mais.

O preenchimento da pista pode ser desligado — de outro modo, o branco
opaco taparia a imagem de referência.

## 21. O obstáculo tem sistema local proprio

X ao longo da frente, Y na profundidade, salto para -Y. Rotacao 0 significa
frente horizontal com o cavalo saltando para cima na tela. A seta, as
barras e a largura de salto seguem essa convencao; muda-la depois exigiria
revisar cada simbolo.

Os simbolos sao desenhados em MILIMETROS DE PAPEL, recebendo `k` (mm por
metro), e nunca dentro de um `scale()`. A escala do grupo engordaria junto
a espessura do traco, que e anotacao e precisa ficar constante em qualquer
escala de impressao.

## 22. Geometria que o desenho usa mora no nucleo

A seta saia na diagonal em vez de perpendicular, e nenhum teste podia
pegar isso porque a geometria estava dentro do componente. `arrowGeometry`
passou para `core/library/obstacles`: "a seta e perpendicular e centrada"
e uma afirmacao sobre numeros, nao sobre pixels, e agora ha teste dizendo
isso.

Vale como regra: se um requisito e verificavel em numeros, a conta sai do
componente.

## 23. Os rotulos do obstaculo nao giram

Numero e alturas ficam fora do grupo rotacionado. Com o obstaculo a 127
graus, um rotulo girado junto ficaria de cabeca para baixo. O deslocamento
do rotulo e em metros a partir do centro, para acompanhar o obstaculo ao
move-lo.

## 24. Liverpool e opcao, nao tipo de obstaculo

Na pista o liverpool aparece acoplado a um vertical ou a um oxer, e nao
como obstaculo a parte. Vira `liverpool` dentro do obstaculo: ligar,
profundidade, deslocamento e sobra nos lados.

Ele e desenhado no sistema LOCAL do obstaculo, com os lados alinhados aos
eixos. Por construcao fica sempre paralelo a frente — nao existe opcao de
angulo, porque nao existe como desalinha-lo.

## 25. Rotulo do obstaculo se posiciona sozinho

Com `auto` ligado, o numero vai para o LADO (alem da meia-largura da
frente) e as alturas vao para TRAS — nunca para a frente, que e por onde a
seta sai. O deslocamento e local: gira com o obstaculo, entao continua
fugindo do corpo e da seta em qualquer angulo. Foi assim que se resolveu o
numero ficar encoberto em obstaculo largo ou inclinado.

Mexer na posicao pelo painel desliga o automatico; um botao devolve.

O texto em si nunca gira (decisao 23).

## 26. Paraflanco e o suporte padrao

Sem o painel lateral o obstaculo parece uma vara solta no chao. O suporte
tem tres formas: `paraflanco` (padrao), `pilar` (so o montante) e `nenhum`
— a vara no chao existe em pista de verdade e continua disponivel.

A profundidade do paraflanco acompanha a largura de salto, para o oxer
ficar apoiado dos dois lados, e entra na envoltoria: e ele, nao a vara,
quem define ate onde vai o corpo do obstaculo.

## 27. Dimensoes que vem da pista, nao do desenho

Vara: 3,50 m. Liverpool: 3,00 x 0,50 m — mais estreito que a vara de
proposito, para as pontas dela ficarem para fora da agua, como se monta na
pista. Os dois sao ajustaveis.

O comprimento da lamina e proprio, nao derivado da vara. Quando ele passa
da vara, e ele quem manda na extensao do obstaculo; quando e menor, manda
a vara.

## 28. Linha de cronometragem e entidade propria

Partida e chegada nao sao obstaculo: nao tem altura, nao recebem numero de
percurso e nao entram na tabela de alturas. Compartilham o sistema local e
o paraflanco, entao a seta continua perpendicular por construcao.

## 29. O comprimento e do tracado desenhado

Cubica nao tem comprimento em forma fechada. `cubicLength` usa subdivisao
adaptativa: enquanto o poligono de controle e a corda discordarem mais que
a tolerancia, parte a curva ao meio — e DIVIDE a tolerancia a cada nivel,
para o erro total continuar limitado. Padrao de 0,1 mm, verificado contra
integracao por forca bruta com 200 mil passos.

`flattenPath` NAO serve para medir: a tolerancia dela vale por segmento e
o desvio se acumula, entao a poligonal subestima o arco. Ela existe para
teste de clique e, na fase 9, para procurar interferencia.

Trecho sem alca vira cubica degenerada com os controles sobre as pontas —
o comprimento sai exato, sem aproximacao, no caso mais comum de todos.

## 30. Alca espelhada nao e arredondada

Posicoes digitadas pelo usuario sao arredondadas ao milimetro. A alca
oposta de um no liso, nao: ela e derivada, e arredonda-la quebraria a
colinearidade — ou seja, deixaria um bico de 0,0001 rad num no que o
desenhador pediu liso. Quem e calculado guarda precisao cheia.

A alca tambem nao usa snap ao ser arrastada: ela molda a curva, e alinhar
ao grid daria saltos justamente onde se quer ajuste fino.

## 31. Tracado nasce curvo, com um numero so

Duas escolhas vindas do uso real, nao do plano.

Clicar ponto a ponto produzia uma poligonal angulosa — "bebada". Ao
concluir, os nos ganham tangentes coerentes com os vizinhos (Catmull-Rom
em forma de Bezier) e viram curva continua, SEM sair do lugar. O botao
"Suavizar" faz o mesmo depois, e "Endireitar" desfaz. Ha a opcao Reto para
quem quer segmentos.

Distancia: um numero por LINHA, no meio do percurso medido em comprimento
— como no croqui impresso, onde o que interessa e a distancia entre dois
obstaculos. Um numero por trecho so faz sentido em tracado de poucos nos,
e vira poluicao quando a curva foi feita com muitos cliques. Os dois modos
continuam disponiveis.

## 32. Cenario e percurso sao escopos separados

Todo objeto declara a que parte pertence: `pista` (contorno, imagem de
referencia, arvores, fixos do local) ou `percurso` (obstaculos, tracados,
cronometragem, textos).

O editor tem um modo ativo, e SO o escopo ativo recebe clique — o resto
fica esmaecido e intocavel. Nasceu de uma dificuldade real de operacao: a
pista cobre toda a area de trabalho, entao qualquer clique no vazio pegava
o fundo em vez do obstaculo que se queria. Nao ha como resolver isso so
com ordem de empilhamento; e uma questao de intencao, e intencao precisa
ser declarada.

A barra lateral tambem filtra por modo, e trocar de modo limpa a selecao:
manter selecionado o que deixou de ser selecionavel confunde mais do que
ajuda.

## 33. Repositorio de pistas

O cenario de um local pode ser guardado e reaplicado em outra prova.
Aplicar TROCA o cenario e PRESERVA o percurso — e para isso que os escopos
existem. Os ids sao renovados na aplicacao, entao o mesmo modelo pode ser
usado duas vezes sem colidir.

Guarda em dois lugares, de proposito: `localStorage` para reuso rapido na
maquina, e arquivo `.pista` para levar embora. A cota do localStorage gira
em torno de 5 MB e uma imagem de satelite estoura sozinha, entao a
gravacao avisa e oferece a exportacao em arquivo, em vez de falhar calada.

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

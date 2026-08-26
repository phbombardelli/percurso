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

## 34. Barra superior em menus

Novo, Abrir, Salvar, Salvar como, Exportar PDF e Imprimir viraram o menu
Arquivo; grid, snap, limites da página e enquadramentos viraram o menu
Exibir. Continuam em botão apenas os comandos de uso contínuo: desfazer,
modo Pista/Percurso, seleção e zoom.

O critério é esse: comando frequente o bastante para precisar de nome, mas
raro o bastante para não merecer espaço permanente, é caso de menu. O menu
ainda ensina os atalhos, que antes existiam sem ninguém poder descobrir.

O nome do arquivo ficou por último e encolhe com reticências. Com barra de
rolagem, quem sumia da tela era comando, e sumia sem aviso; o nome é
informação, então é ele quem cede espaço.

## 35. Traçado do cavaleiro: geometria, não aprendizado

O assistente de traçado desenha a linha que um cavaleiro faria. A tentação
seria aprender o estilo de croquis existentes; a escolha foi outra, porque
a linha do cavaleiro obedece a regras físicas e não a estilo: chega
perpendicular e centrado no obstáculo, com reta antes e depois, e liga um
salto ao outro com a curva de maior raio que couber.

Isso é exatamente o caminho de Dubins — o mais curto entre duas poses com
raio mínimo de curva —, que tem solução fechada e exata. Não há
treinamento, não há modelo estatístico, não há dependência nova, e o
resultado é reprodutível: o mesmo percurso dá sempre o mesmo traçado. O
§44 proíbe IA no produto, e aqui ela não faria falta nenhuma.

Croquis reais entram como CALIBRAÇÃO (quanto de reta, que raio, que
margem até o alambrado) e como verificação: rodar o assistente sobre um
percurso de distância total conhecida e comparar os números.

Duas decisões internas que sustentam o resto:

- `dubinsPaths` devolve TODOS os candidatos ordenados, não só o mais
  curto. O mais curto pode sair da pista ou passar por cima de outro
  obstáculo, e quem sabe disso é o assistente, não a geometria.
- Candidato só entra na lista depois de a geometria ser remontada e
  medida. As fórmulas fechadas têm casos degenerados — uma reta de
  comprimento zero faz um `atan2(0, 0)` decidir no ruído —, e conferir o
  destino é mais barato e mais seguro que confiar na álgebra.

O caminho vira traçado NORMAL, de nós e alças editáveis: arco em pedaços
de 45 graus, cada um uma cúbica, com desvio medido de 0,09 mm no terreno.
Não é um objeto especial e não é caixa-preta — quem não gostou de uma
volta arrasta o nó, e a distância recalcula.

## 36. Duas formas de volta, um juiz só

O primeiro assistente ligava as poses pelo caminho mais curto de raio
mínimo (Dubins). Na pista de verdade o croqui saiu cheio de LAÇADAS.

O diagnóstico, medido e não suposto: para a volta do obstáculo 1 ao 2 de
um percurso real, TODOS os caminhos possíveis giravam 330 graus ou mais.
Não era escolha ruim entre opções boas — não havia opção boa. Exigir reta
perpendicular de tamanho fixo nas duas pontas E raio mínimo entre elas é
restritivo demais: quando dois saltos não estão bem alinhados, que é o
caso quase sempre, a geometria só sabe responder com laçada.

A cúbica de Hermite resolve o outro extremo: sai na direção do salto,
chega na direção do próximo, e nunca laça. Mas numa volta grande ela
responde com um BICO, porque não gira tanto sem se dobrar.

Nenhuma das duas serve sozinha, e as duas juntas servem. Os dois
geradores convivem e um juiz só decide, pelo mesmo critério: cabe na
pista, não atropela obstáculo, e o ponto mais fechado ainda se galopa —
vence quem tem menos problema e, no empate, a curva mais ampla. Na
prática a cúbica ganha as voltas mansas e o arco-reta-arco as grandes.

Duas correções que vieram do mesmo teste:

- As retas se atropelavam. Partida e obstáculo 1 costumam distar menos de
  16 m; com 8 m de reta de cada lado, o ponto de chegada nascia ATRÁS do
  de partida, e voltar com raio mínimo exige uma volta completa. Cada vão
  agora dá no máximo um terço de si para cada reta.
- O raio tem teto no vão. Curva de 11 m não cabe em 10 m de vão, e a
  geometria responde com laçada em vez de admitir que não cabe.

Aprendizado de método, não de código: os testes unitários diziam
"chegou no destino", e as laçadas chegavam ao destino. Faltava medir a
FORMA — giro total e raio mínimo. São essas duas medidas que hoje
reprovam a laçada e o bico.

## 37. O juiz aprendeu a enxergar troca de mão

Reclamação da prova real: "do 2 para o 3 ficou com uma ligeira inflexão à
esquerda desnecessária antes da curva propriamente dita à direita".

Cavaleiro que vai virar à direita não começa torcendo à esquerda. A
cúbica produz essa inversão sozinha quando as tangentes puxam demais, e
nenhuma das medidas que o juiz tinha — comprimento, raio mínimo, cabe na
pista — enxergava o defeito. Agora conta-se a troca de mão, e ela entra
no critério.

Três armadilhas apareceram ao ajustar isso, todas por medir:

- Pôr a inflexão antes do raio elegeu o BICO, que tecnicamente não troca
  de mão porque inverte passando pelo zero. A ordem certa separa antes o
  que dá para galopar: entre as galopáveis vence a que troca menos de
  mão; entre as ingalopáveis, o aperto é que manda.
- Uma curva que sobe e volta pela MESMA reta era medida como reta
  perfeita, curvatura zero em todo ponto. É o pior traçado possível e
  passava limpo. Agora a inversão de sentido é detectada.
- Faltava o limite físico: entre duas poses que diferem de Δ, nenhuma
  curva tem raio maior que vão / (2·sen(Δ/2)). Sem ele, poses quase
  coladas e opostas passavam como impecáveis, porque a medição ponto a
  ponto de um trecho degenerado não acusa nada.

E uma liberdade nova, que é o que o cavaleiro realmente faz: ceder reta
para ganhar curva. Virar 70 graus em 11 m entre duas retas de 8 m não
cabe; encurtando as retas, cabe. Reta demais com curva impossível é pior
que reta menor com curva galopável — mas nunca abaixo do mínimo, senão o
cavalo chega torto no salto.

## 38. Anotações: dois sistemas de coordenadas, de propósito

O texto livre mora em METROS do terreno; o quadro técnico e a tabela de
alturas moram em MILÍMETROS de papel.

Não é inconsistência, é a diferença entre o que cada um nomeia. O texto
aponta um lugar da pista ("entrada", "aquecimento") e tem que andar junto
quando a escala muda. O quadro é cabeçalho da folha: passar o croqui de
1:200 para 1:500 encolhe a pista e não pode encolher a letra do quadro
nem tirá-lo do canto onde foi posto. Os dois modelos já previam isso
desde a fase 0, e o `transform` já sabia converter.

A tabela de alturas NÃO guarda alturas próprias: lê os obstáculos do
documento. É o que impede o erro clássico de manter duas fontes — o
croqui imprimindo uma altura que o desenho não tem. Mudou a vara, mudou a
tabela.

O leiaute dos dois vive no núcleo, e não no componente de desenho, porque
tem dois consumidores: o desenho e a SELEÇÃO. Antes disso a envoltória
era estimada (uma conta de "mais ou menos 5 mm por linha") e mentia sobre
o que estava desenhado — clicar acertava o vazio e errava a letra. Uma
conta só, dois consumidores, como já vale para o desenho de tela e papel.

O quadro traz um "preencher do desenho" que escreve distância, número de
obstáculos e de esforços. São justamente os três campos que ficam errados
quando digitados à mão e o percurso muda depois. Preenche só quando
pedido: o §44 proíbe validação esportiva, e sobrescrever o que o
desenhador digitou seria pior que deixar em branco.

Verificado com PDF real, não presumido: os textos saem como TEXTO
selecionável, e os acentos e o ordinal (Distância, Esforços, Nº)
sobrevivem à conversão — a armadilha que já tinha mordido nas fases
anteriores com travessão e sinal de menos.

## 39. A folha: escala declarada e espaço negociado

Duas coisas fechavam a fase 12.

**A escala impressa.** Croqui sem escala declarada não se confere com
régua, e quem recebe a folha de outra pessoa pergunta isso primeiro. Vai
o "1:250" escrito E a barra gráfica, porque as duas resolvem problemas
diferentes: o número diz o que o milímetro vale, e a barra continua certa
mesmo quando a folha é fotocopiada com redução — situação em que o número
escrito passa a mentir. A barra procura um comprimento redondo (10, 20,
25, 50 ou 100 m) que dê entre 2 e 6 cm de papel: barra em número quebrado
não se lê.

**O ajuste ao papel.** Antes reservava 25% da altura "para o cabeçalho",
sempre, houvesse quadro ou não — demais quando a folha estava limpa, de
menos quando havia uma tabela comprida. Agora mede-se a área realmente
livre.

A regra é a invasão por borda, e o detalhe que a fez funcionar custou uma
falha de teste: uma anotação no canto superior esquerdo invade pela
esquerda E pelo topo, e a primeira versão escolhia sempre a primeira que
testava. O certo é o lado de MENOR invasão, que é o lado a que ela está
encostada — é o que separa uma faixa larga e baixa, que é cabeçalho e
custa só a sua altura, de uma caixa alta e estreita, que é lateral e
custa só a sua largura. Descontar pelo lado errado jogava fora meia
folha.

Consequência boa e não planejada: a tabela de alturas muda de papel
sozinha conforme cresce. Vazia é baixa e larga, e desconta como
cabeçalho; com doze obstáculos vira alta e estreita, e passa a descontar
como lateral.

Anotação no meio da folha não desconta nada: quem a pôs ali quis que
ficasse sobre o desenho.

O PDF também ganhou ficha (título, assunto com a escala, criador). Croqui
circula por e-mail e acaba numa pasta com dezenas de outros; sem isso ele
aparece como "Untitled" na lista do leitor.

## 40. O traçado ideal obriga o programa, não o desenhador

Regra do ofício, dita pelo desenhador: **a linha passa pelo CENTRO do
obstáculo, a 90 graus, 100% das vezes. O croqui é o traçado ideal, não o
traçado mais rápido.**

E a delimitação que veio junto, e que muda tudo: *"se o desenhador
desenhar à mão, o programa aceita. O que não pode é o programa ser
programado para desenhar errado."*

A regra obriga o PROGRAMA. Quem desenha à mão desenha como quiser.

Errei duas vezes seguidas nisso, em direções opostas. Primeiro modelei
tolerância de cavaleiro — até 40 graus de desvio, passagem a meia vara do
centro — como se o croqui registrasse o que um cavalo fez; não registra,
declara o que ele deve fazer. Depois, corrigindo, passei a ACUSAR salto
fora do centro e fora do esquadro no desenho manual, e aí o programa
estava opinando sobre desenho alheio. Os dois avisos foram removidos.

Então a regra vive dos dois lados, cada um no seu lugar:

- Do lado do PROGRAMA, é teste: o traçado gerado pelo assistente cruza
  todo obstáculo a menos de 1 mm do centro e menos de 0,01 grau do
  esquadro. Um segundo teste fecha o círculo — percurso traçado pelo
  assistente não se acusa na detecção.
- Do lado do DESENHO, é silêncio: linha manual fora do centro ou torta
  passa sem comentário.

A detecção acusa corpo no caminho, e só: obstáculo por cima de obstáculo,
obstáculo fora da pista, e linha atravessando um obstáculo que não está
saltando. Cruzar na faixa do paraflanco conta como estorvo, porque ali é
bater no pilar, não saltar. Passado 45 graus de desvio, o cruzamento
deixa de ser salto e vira travessia no comprimento — o caso extremo, uma
linha deitada sobre a vara, mede 90 graus e precisa do nome certo.

O aviso vive no OVERLAY e nunca sai no PDF nem na impressão: alerta
impresso viraria erro na folha entregue à comissão. Verificado no SVG do
papel, que é o mesmo que alimenta PDF e impressora.

### O bug que a regra desenterrou

Exigir a linha ideal do programa achou um defeito real que nenhum teste
anterior pegava: um nó do traçado gerado caía a 21 cm do centro do
obstáculo, com a reta do salto empurrada para além da vara.

A causa: a volta pode ceder parte da reta para caber a curva, e o limite
dessa cessão era calculado contra os 8 m NOMINAIS, não contra a reta que
aquele salto realmente tinha. Ceder 6 m de uma reta de 1,5 m atravessa o
obstáculo.

O conserto criou outro defeito na hora, e vale registrar: passando a
respeitar o mínimo de reta, uma reta já curta não tinha opção de cessão
NENHUMA, e a volta ficava sem solução — trecho inteiro sumia do traçado.
Ceder zero precisa ser sempre uma opção.

## 41. Curva para trás

Conceito do ofício que faltava no modelo, e que uma prova real expôs: no
percurso do desenhador, o obstáculo 6 fica logo ao lado do 5 e virado
para outra direção. Entre a saída de um e a entrada do outro sobram menos
de 4 m, com 90 graus de diferença. Não existe ligação curta possível, e a
volta que o assistente desenhava ali era impossível de galopar.

A saída do cavaleiro é a CURVA PARA TRÁS: seguir em frente depois do
salto, dar a volta por fora e voltar numa aproximação bem mais longa.

O programa tinha perdido a capacidade de fazer isso. O solucionador só
sabia ENCURTAR a reta para caber a curva; alongá-la, que é o que cria o
espaço da volta, não era opção. Agora a reta mexe nos dois sentidos:
negativo cede, positivo afasta o ponto do obstáculo.

E havia uma proibição que atrapalhava junto. Para caçar as laçadas de uma
versão anterior eu tinha posto um teto de 270 graus de giro — e a curva
para trás gira mais que isso por definição. O teto proibia a única volta
possível.

O que separa a laçada da curva para trás não é o tamanho do giro: é a
NECESSIDADE. Então o teto virou generoso (420 graus, só para barrar
absurdo) e quem decide passou a ser o custo: giro total mais uma taxa de
90 graus por troca de mão. A laçada aparecia onde havia opção mansa e
perde no custo; a curva para trás só aparece quando não havia nenhuma, e
ganha por falta de concorrente. Uma medida resolve os dois casos sem
proibir nenhum.

Dois ajustes que a medição exigiu:

- O custo é comparado em degraus de 5 graus. No valor cru, meio grau
  decidia antes da amplitude e TODA volta caía no raio de aperto — uma
  curva de raio 6 gira um tiquinho menos que a mesma de raio 11 e ganhava
  por isso. Com o degrau, o empate devolve a decisão à curva mais ampla.
- Alongar os dois lados em medidas diferentes quase nunca ajuda e
  multiplicava a busca: o percurso inteiro levava 1,6 s. Alongando só de
  um lado por vez, mais dois simétricos, caiu para 0,69 s com o mesmo
  resultado.

No percurso da prova real: 8 voltas, nenhum problema, e o 5 para o 6
resolvido com 30 m de reta a mais e uma volta de 251 graus.

## 42. A volta por fora é recurso, não alternativa

A primeira versão da curva para trás virou caos no percurso real: laçadas
por toda parte, linhas se cruzando, o croqui ilegível.

A causa foi trocar uma proibição rígida (teto de giro) por uma comparação
GLOBAL de custo. Com isso a volta por fora passou a disputar de igual
para igual com a linha direta, e ganhava sempre que a direta ficava um
pouco apertada — não só quando era impossível.

A ordem do ofício não é uma comparação, é uma escala de recurso:

1. Volta direta MANSA — até 200 graus de giro, galopável e limpa. Se
   existir, é ela. Cavaleiro não dá a volta por fora quando dá para ir
   direto.
2. Curva para trás, quando a direta mansa não existe.
3. Volta direta com giro grande, em último caso.

A busca ficou em estágios, nessa ordem, em vez de um balcão único. O
degrau dos 200 graus é o que faltava: sem ele, uma laçada de 350 graus
passava como "direta, limpa e galopável" e era aceita, quando a volta por
fora teria resolvido com elegância.

De quebra, a busca em estágios é mais rápida — quase sempre para no
primeiro. O percurso inteiro caiu de 1,6 s para meio segundo.

O relatório passou a nomear as voltas feitas por fora. Curva para trás é
decisão visível: o desenhador precisa saber que ali a linha sai e volta de
propósito, e não por defeito do assistente.

## 43. A cruzada de tempo não se larga: coloca-se

Regra do ofício: entre a partida e o primeiro obstáculo, e entre o último
e a chegada, NUNCA existe volta. O cavalo cruza a partida já apontado
para o primeiro salto, e segue reto do último para a chegada.

Enquanto a cruzada podia ser largada em qualquer ponto da pista com um
clique, o assistente tinha de inventar uma ligação entre ela e o
obstáculo — e inventava, com laçada e tudo. O aviso da prova real
denunciou exatamente isso: "partida para 1" e "7 para chegada" listadas
como curvas para trás.

Consertar o solucionador seria remendo. O erro estava um passo antes: a
cruzada não é um objeto que se posiciona livremente, é uma consequência
do percurso.

Agora se escolhe a DISTÂNCIA, entre 9 e 15 m, e o resto sai por
construção: a cruzada fica no eixo do salto, paralela à face, com os
centros coincidindo — as duas unidas por uma reta perpendicular aos seus
comprimentos. A partida atrás do primeiro obstáculo, a chegada à frente
do último, e a seta acompanhando a do salto.

Uma de cada por percurso: recolocar substitui, em vez de empilhar.

E o assistente ganhou a garantia correspondente: perna que toca uma
cruzada de tempo é RETA, sem procurar curva nenhuma. Não é otimização, é
a regra — procurar curva ali era o defeito.

Efeito colateral bom: os testes que largavam a cruzada num ponto
arbitrário passaram a acusar bico na emenda, porque agora a reta é
imposta. Estavam modelando um percurso que o programa não constrói mais.

## 44. A cruzada segue o obstáculo

Quatro afinações da regra 43, todas do desenhador:

**Cada cruzada tem a sua distância.** Partida e chegada não precisam ficar
à mesma distância dos seus obstáculos, e agora cada uma guarda a sua. O
campo da barra lateral é só o padrão da inserção; depois de colocada,
cada linha se ajusta no próprio painel.

**Décimo de metro.** O passo era de meio metro, que é grosso demais para
um número que sai impresso.

**A medida é da VARA, não do centro.** Da partida até a vara de entrada,
e da vara de saída até a chegada. Num vertical dá no mesmo; num oxer de
1,50 m a diferença é de 75 cm de cada lado. Medido no programa: com a
distância em 12 m, a cruzada fica a 12,75 m do centro do oxer — 12,00 m
da vara, que é o número que o desenhador pediu.

**A cruzada acompanha o obstáculo.** Esta foi a que mexeu no modelo: a
linha passou a guardar o VÍNCULO (a que obstáculo pertence e a que
distância), e não só a posição. Mover ou girar o obstáculo 1 recoloca a
partida sozinha.

A invariante é garantida num lugar só — depois de qualquer alteração do
documento, no `apply` da loja. Não em cada comando que move obstáculo: são
oito caminhos diferentes (mover, girar, colar, duplicar, desfazer,
refazer, aplicar modelo de pista, arrastar no canvas) e bastaria esquecer
um para a regra de "nunca há volta na cronometragem" se perder em
silêncio. Invariante que depende de lembrança não é invariante.

Cruzada cujo obstáculo foi apagado perde o vínculo e fica onde está.
Apagar a linha junto seria decidir pelo desenhador.

## 45. Vínculo não pode ser opcional em silêncio

O desenhador moveu o primeiro e o último obstáculo, e as cruzadas não
acompanharam — apesar de o mecanismo estar certo e testado.

O motivo: as linhas dele tinham sido colocadas ANTES de a cruzada
aprender a seguir, e por isso não tinham vínculo. Na tela ficavam
idênticas às vinculadas. Uma armadilha silenciosa, e culpa da decisão
anterior: eu tinha resolvido que migração não vincularia sozinha, "para
não adivinhar".

Só que aqui não há o que adivinhar. A partida pertence ao primeiro
obstáculo e a chegada ao último — é a definição, não uma inferência.

Então a cruzada sem vínculo é ADOTADA na sincronização, com a distância
que ela já tinha, trazida para dentro dos 9 a 15 m. Conserta sozinho o
croqui antigo e fecha a armadilha: não existe mais cruzada que parece
igual e não anda.

Fica solta só quando não há obstáculo numerado, porque aí não há a quem
pertencer.

Segunda correção, de uso: a distância ganhou um controle deslizante. O
campo numérico só confirma no Enter ou ao sair, e o desenhador quer
PROCURAR a distância olhando o croqui, não digitar um número e conferir
depois. Arrastar move a linha a cada décimo, e o arrasto inteiro entra no
histórico como um gesto só.

## 46. Combinações e linhas retas

Ferramenta para montar duplo, triplo e linha reta: selecionam-se 2 ou 3
obstáculos, digita-se a distância de cada vão, e eles ficam alinhados.

O cerne é a MEDIDA. A distância entre dois saltos não é de centro a
centro: é da vara de saída do anterior até a vara de entrada do seguinte,
que é o vão que o cavalo galopa e o número que vai para o croqui. Medido
no programa, com oxer nas duas pontas: vãos de 7,60 e 10,90 m saem com
8,35 e 11,65 m entre os centros — a meia largura do oxer em cada ponta.
Errar isso é errar quase uma passada inteira.

Alinhar é a outra metade: mesmo eixo, mesma inclinação, mesmo sentido de
seta. Combinação torta não é combinação, são dois obstáculos próximos.

Três decisões de comportamento:

- O PRIMEIRO elemento não se move. Alinhar acerta os outros em relação a
  ele. Se todos se movessem, cada aplicação arrastaria a combinação pela
  pista e o desenhador perderia o lugar que escolheu.
- A ordem é a do SALTO, não a da seleção: quem vem antes é quem o cavalo
  encontra primeiro, projetado no eixo do primeiro. Selecionar de trás
  para a frente dá o mesmo resultado.
- Os campos nascem medindo o que já existe, e nada é aplicado sozinho.
  Alinhar move obstáculo alheio; move quando se pede.

O vão pode ser negativo, e isso é informação: quer dizer que os corpos
estão sobrepostos. A ferramenta mostra o número em vez de esconder.


# Pendências

Lista viva do que falta. Cada item diz o QUE é, POR QUE importa e, quando
já se sabe, POR ONDE começar.

Ordem da seção não é ordem de execução — a recomendação está no fim.

---

## 1. Lapidar o traçado por trechos

O recurso funciona e já é utilizável, mas a seleção de opções ainda é
grosseira: **aparecem opções absurdas no meio das boas, e boas opções
deixam de ser apresentadas**.

São dois defeitos opostos do mesmo mecanismo — a poda. Ela hoje agrupa
por forma (mão inicial, trocas de mão, giro em degraus de 45 graus) e
descarta o que gira meia volta a mais que o melhor. Grosseiro demais num
sentido e fino demais no outro.

Por onde começar: reunir casos concretos onde falta uma boa opção, e
casos onde sobra uma absurda. São dois ajustes diferentes — a poda deixa
passar lixo, e o agrupamento está fundindo formas que não são a mesma
coisa. Sem os casos, mexer é adivinhar.

## 2. Revisão de UX/UI

Botões, menus e organização das funções nunca passaram por uma revisão
própria — foram crescendo fase a fase. Já houve um sintoma: a barra
superior estourou a tela e virou menus na marra.

Pontos que já se sabe:

- A barra lateral tem hoje nove botões que misturam ferramenta de clicar
  (obstáculo, texto), ação imediata (partida, chegada, quadro) e processo
  (assistente, por trechos). São três coisas diferentes com a mesma cara.
- Não há atalho de teclado para nada da barra lateral.
- O painel da direita empilha seções sem hierarquia clara.
- Ferramenta e modo (Pista/Percurso) competem pela mesma atenção.

## 3. O assistente automático gira demais

A calibração mediu: **587 m contra 420 oficiais**, e nenhum parâmetro
conserta (a melhor de 240 combinações ainda dá 523 m). O excesso é do
modelo, não da leitura do croqui.

O relatório por perna aponta onde: giros de 287, 356 e 399 graus, e uma
volta com raio de 0,1 m — um bico aceito como solução.

Duas suspeitas concretas, nesta ordem: o recurso de último caso aceita
bico em vez de recusar; e o degrau de "volta direta mansa até 200 graus"
não está sendo respeitado em algum caminho.

Consequência prática: o botão "preencher do desenho" do quadro técnico
escreve uma distância provavelmente 30 a 40% alta quando a linha veio do
assistente automático. Linha desenhada à mão ou escolhida por trechos não
tem esse problema — o número mede o que está desenhado.

## 4. Calibração dos parâmetros

Bloqueada pelo item 3: enquanto a forma da linha estiver errada, calibrar
reta, raio e margem é ajustar o número errado.

A bancada está pronta (`npm run calibrar`), com o World Challenge 2020
transcrito e conferido contra as distâncias impressas. Quando o giro
estiver domado, é rodar e comparar.

Limite conhecido do método: sacudir as inclinações em 5 graus, que é
menos do que se erra lendo uma imagem, move o total em 156 m. Calibração
fina com croqui lido a olho não vai passar disso. Percursos montados por
um traçador, com distância oficial conhecida, resolveriam.

## 5. Parâmetros do traçado na interface

Reta de aproximação, raio preferido, raio de aperto e margem do alambrado
só existem no código. Não dá para dizer "nesta pista quero raio de 9 m".

Faz mais sentido depois da calibração, que vai dizer quais números
importam de verdade.

## 6. O assistente empilha traçados

Clicar duas vezes cria dois traçados sobrepostos. Deveria substituir o
anterior, ou ao menos avisar. Vale para os dois assistentes.

## 7. Fase 11 — ampliar a ornamentação

Existem nove ornamentos. Ampliar é a tarefa mais cosmética que restou, e
a única que não muda nada do que o croqui comunica.

## 8. Lâmina d'água como cenário

Hoje "rio" é um TIPO DE OBSTÁCULO, ou seja, pertence ao percurso. Um lago
ou córrego fixo do local, que é cenário da pista, não existe.

## 9. Soltar o vínculo da cruzada de tempo

A partida e a chegada acompanham o obstáculo, e cruzada arrastada à mão
volta para o lugar na próxima alteração. Se alguma prova precisar de uma
partida fora do eixo, falta um jeito explícito de soltar o vínculo — hoje
ele volta sozinho.

## 10. Tempo concedido

Adiado por decisão do desenhador. A conta é de uma linha, a partir da
distância e da velocidade da prova, e o campo já existe no quadro técnico.
Depende do item 4 para o número prestar.

## 11. Miudezas da ferramenta de composto

- Numeração e letras não são mexidas: um duplo montado continua 4 e 5, e
  virar 4A/4B é manual.
- A âncora é sempre o PRIMEIRO elemento. Ancorar pelo último resolveria o
  caso de quem monta de trás para a frente.

---

## Ordem recomendada

1. **Item 1** (lapidar o por trechos), porque é o recurso que está em uso
   agora, e o retorno do desenhador já apontou o defeito.
2. **Item 3** (giro do automático), que destrava o 4, o 5 e o 10 e conserta
   a distância impressa no quadro técnico.
3. **Item 2** (UX/UI), que é melhor fazer com o conjunto de funções já
   estabilizado — revisar interface durante mudança de recurso é retrabalho.
4. O resto por conveniência.

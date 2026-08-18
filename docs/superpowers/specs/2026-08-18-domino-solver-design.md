# Solver e Assistente de Dominó Clássico (Duplo-6) — Design

Data: 2026-08-18

## Visão Geral

Aplicação Next.js (App Router) para acompanhar uma partida de dominó duplo-6 em
tempo real e sugerir, a cada turno do usuário, as melhores jogadas ranqueadas
com justificativa estratégica. Não há `src/`; a estrutura fica na raiz do
projeto, ao lado do `app/` já existente (criado pelo `create-next-app`),
seguindo a convenção atual do repositório.

## Estrutura de Arquivos

```
app/
├── layout.tsx
├── page.tsx
└── globals.css
components/
├── SetupWizard.tsx
├── BoardDisplay.tsx
├── TurnController.tsx
├── UserHand.tsx
├── RecommendationList.tsx
└── GameHistoryLog.tsx
engine/
├── deck.ts
├── inference.ts
├── solver.ts
└── types.ts
hooks/
└── useDominoGame.ts
```

Alias `@/*` do `tsconfig.json` já aponta para `./*` — nenhuma mudança de
configuração necessária.

## Modelo de Tabuleiro

Linha simples com duas pontas abertas (esquerda/direita). Sem regra de
"spinner" — a primeira dobra jogada não abre 4 lados, só estende a linha
normalmente. Isso corresponde ao dominó clássico simples descrito no pedido
original, sem variantes de carroça-coringa.

## Regra do Monte (Boneyard)

Configurável no Setup Wizard:

- **Com monte**: quando `numJogadores × pedrasIniciais < 28`, sobram peças.
  Elas formam um monte de compra. Um jogador que não pode jogar compra do
  monte antes de passar. Só quando o monte está vazio um "passar" é
  registrado como void real (gera dedução de naipe).
- **Sem monte**: peças não distribuídas ficam simplesmente fora de jogo
  (nunca entram na mesa). Qualquer "passar" já é tratado como void imediato
  nas pontas abertas.
- Com 4 jogadores × 7 peças = 28 (todas distribuídas), o monte é sempre
  vazio — o comportamento é idêntico a "sem monte" automaticamente, sem
  exigir escolha do usuário nesse caso.

## Fim de Rodada (revisado — Rodada 3, correções do usuário)

> Histórico: a primeira versão deste documento definia pontuação por soma de
> pips com revelação opcional de mãos, lá-e-lô como "pontas iguais antes da
> batida" e bucha como "bater antes de o adversário jogar qualquer peça".
> Todas as três definições foram corrigidas pelo usuário após jogo real e a
> seção abaixo é a que vale.

Duas formas de terminar uma rodada:

1. **Batida**: um jogador fica sem peças. O vencedor é detectado
   automaticamente (é quem zerou a mão — o app já sabe).
2. **Trancamento**: todos os jogadores em sequência passam (com monte já
   vazio ou desabilitado). Vence quem tiver **menos peças na mão**; empate
   no mínimo → rodada empatada, sem vencedor.

**Não há placar**: nenhuma contagem de pontos por pips, nenhuma revelação de
mãos, nenhum acumulado entre rodadas. Cada rodada registra apenas quem venceu
e o tipo da batida. O vencedor inicia a rodada seguinte (empate → mantém o
`startingPlayer` configurado).

### Tipos de Batida

Detectados a partir das pontas da mesa imediatamente ANTES da jogada final e
da peça que bateu:

- **Simples**: qualquer batida que não se enquadre nas abaixo.
- **Carroça (bucha/carreto)**: a peça final é uma dobra (ex.: bater com 4-4).
- **Lá-e-lô (lasquinê)**: as duas pontas têm valores DIFERENTES (x, y) e a
  peça final é exatamente x-y — ela fecharia qualquer uma das duas pontas.
  Pontas (5,5) batendo com 2-5 NÃO é lá-e-lô (caso reportado pelo usuário).
- **Cruzada**: as duas pontas têm o mesmo valor v e a peça final é a carroça
  v-v — a batida mais forte.

O solver usa os tipos apenas como desempate de estilo entre jogadas que já
batem o jogo (bater vence a rodada — domina qualquer outra heurística).

### Heurística central do solver: mobilidade do adversário

Correção estratégica da Rodada 3 (análise do usuário confirmada): a avaliação
de cada jogada passa a computar, via inferência exata sobre o pool de peças
desconhecidas, **quantas peças o próximo adversário poderia jogar** nas duas
pontas resultantes (descontando naipes em que ele é comprovadamente void, por
passe ou por contagem — ex.: o usuário segura todos os 6 restantes).
Penalidade proporcional à mobilidade dele; bônus alto quando chega a zero
(passe garantido). Isso substitui o antigo "castigo de passe" (que só olhava
voids declarados por passe e apenas a ponta alterada) e captura jogadas como
"manter a ponta 6 morta e jogar no branco". O bônus de preparação de lá-e-lô
passa a valer apenas quando o usuário ainda segura a peça-ponte das duas
pontas distintas resultantes. Heurísticas de peso de peça (descarte de
pesadas) saem — sem pontuação por pips, peso não afeta o resultado; carroças
seguem penalizadas por inflexibilidade.

## Tipos Centrais (`engine/types.ts`)

- `Suit = 0 | 1 | 2 | 3 | 4 | 5 | 6`
- `Piece = { id: string; a: Suit; b: Suit }` — canônico com `a <= b`.
- `End = 'left' | 'right'`
- `Board = { sequence: PlacedPiece[]; leftEnd: Suit | null; rightEnd: Suit | null }`
- `PlayerRole = 'user' | 'partner' | 'opponent'`
- `PlayerState = { id: number; role: PlayerRole; team: 'A' | 'B' | null; hand?: Piece[]; handSize: number; voidSuits: Set<Suit>; suitPlayCount: Record<Suit, number> }`
- `GameConfig = { numPlayers: 2|3|4; mode: 'individual'|'duplas'; direction: 'cw'|'ccw'; handSize: number; boneyardEnabled: boolean; startingPlayer: number }`
- `Move = { type: 'play'; playerId: number; pieceId: string; end: End } | { type: 'pass'; playerId: number; drewFirst: boolean } | { type: 'draw'; playerId: number; count: number }`
- `BatidaType = 'simples' | 'carroca' | 'la-e-lo' | 'cruzada'` (Rodada 3)
- `GameState = { phase: 'setup'|'playing'|'round-end'; config: GameConfig; players: PlayerState[]; board: Board; boneyardRemaining: number; currentPlayerIndex: number; history: Move[]; roundNumber: number; error: string | null; roundEndReason: 'batida'|'lock'|null; batidaType: BatidaType | null; passStreak: number; lastWinnerId: number | null }` — sem `scores` e sem fase `finished` desde a Rodada 3 (sem placar; vencedor automático)

## Engine

### `deck.ts`
Gera as 28 peças duplo-6 (`id` = `"a-b"`, `a<=b`).

### `inference.ts`
- `registerPass(state, playerId)`: se monte vazio/desabilitado, adiciona
  `leftEnd`/`rightEnd` atuais a `voidSuits[playerId]`.
- `registerPlay(state, playerId, piece)`: incrementa `suitPlayCount` para os
  naipes da peça jogada (sinal de preferência de naipe).
- `getUnknownPieces(state)`: `deck − mão do usuário − peças na mesa`.
- `filterByPlayableEnds(pool, leftEnd, rightEnd, voidSuits)`: filtro
  compartilhado de encaixe nas pontas (Rodada 3).
- `getCandidatePieces(state, playerId)`: peças que o jogador poderia
  legalmente ter jogado agora — pool desconhecido (ou a própria mão, se
  conhecida) filtrado pelas pontas e pelos voids dele (Rodada 2).
- `willSurelyPass(state, playerId)`: prova de passe — nenhum candidato e
  monte vazio/desabilitado (Rodada 2).

### `solver.ts`
`rankMoves(state, userHand): RankedMove[]` onde
`RankedMove = { piece: Piece; end: End; score: number; reasoning: string[] }`.

Para cada jogada válida (pesos como constantes no topo do arquivo),
conjunto revisado na Rodada 3:

1. **Batida** (domina tudo): se é a última peça do usuário, bônus enorme +
   desempate por tipo (cruzada > lá-e-lô > carroça > simples), com a mesma
   detecção de tipo do reducer.
2. **Mobilidade do adversário** (núcleo novo): simula as pontas resultantes
   e conta exatamente, via `filterByPlayableEnds` sobre o pool desconhecido,
   quantas peças o próximo adversário poderia jogar. Penalidade proporcional;
   bônus alto quando zero (passe garantido). Substitui o antigo castigo de
   passe e o incentivo a trancamento.
3. **Sinergia de dupla** (modo duplas): mantida — penalidade por fechar
   naipe forte do parceiro e por deixar ponta que só o adversário aproveita.
4. **Flexibilidade própria**: bônus por peça restante da mão jogável nas
   DUAS pontas resultantes (não só na alterada).
5. **Descarte de carroça**: mantido (dobra é peça de encaixe único).
6. **Preparação de lá-e-lô**: bônus apenas quando as pontas resultantes são
   distintas (x, y) e o usuário ainda segura exatamente a peça x-y.

Removidos na Rodada 3: castigo de passe (subsumido pela mobilidade), alívio
de peso/pesadas (sem pontuação por pips, peso não afeta o resultado) e
incentivo a trancamento por estimativa de pontos.

Retorna lista ordenada por `score` desc, cada uma com `reasoning: string[]`
em PT-BR explicando quais heurísticas contribuíram.

## `useDominoGame.ts` — Reducer

`useReducer` com ações:

- `SETUP_COMPLETE(config, userHand)`
- `PLAY_PIECE({ playerId, pieceId, end })`
- `PASS({ playerId })` — se monte ativo e não vazio, exige `DRAW` antes.
- `DRAW({ playerId })`
- `UNDO` — restaura snapshot completo do estado anterior (histórico de
  snapshots, não de ações inversas — o estado é pequeno, snapshot é mais
  simples e à prova de erros de "undo" mal implementado).
- `NEW_ROUND()` — reseta mesa/mãos; o vencedor da rodada anterior inicia
  (empate no trancamento → volta ao `startingPlayer` configurado).

`REVEAL_HANDS` e `FINISH_ROUND` foram removidos na Rodada 3 junto com o
placar: a batida define o vencedor automaticamente e o trancamento decide
por menor quantidade de peças na mão.

Ordem de turnos calculada a partir de `direction`, `numPlayers` e
`startingPlayer`.

## Validações e Tratamento de Erros

- Peça duplicada: impedir que a mesma peça seja atribuída simultaneamente à
  mão do usuário, à mesa, ou à mão revelada de outro jogador (checagem
  contra `unknownPieceIds`).
- Jogada em ponta inexistente ou com naipe incompatível.
- `PASS` de jogador quando ele na verdade tem jogada válida conhecida (só
  aplicável ao próprio usuário, cuja mão é conhecida) — bloqueado com aviso.
- `PLAY_PIECE`/`PASS` fora de turno.
- `PASS` com monte ativo e não vazio sem `DRAW` prévio.

## Componentes (UI)

- `SetupWizard.tsx` — passos: nº jogadores → modo (individual/duplas) →
  sentido → pedras iniciais → monte (se aplicável) → seleção da mão do
  usuário → quem inicia (mão antes de quem-inicia desde a Rodada 2).
- `BoardDisplay.tsx` — visualiza sequência de peças e pontas abertas,
  responsivo (scroll horizontal em telas pequenas).
- `TurnController.tsx` — ações rápidas contextuais ao turno atual: para
  oponentes/parceiro, seletor mostrando SOMENTE as peças que poderiam estar
  em jogo (via `getCandidatePieces`), fluxo peça → ponta em dois cliques,
  e modo passe-garantido via `willSurelyPass` (Rodada 2; substituiu os dois
  seletores de naipe 0-6 originais).
- `UserHand.tsx` — grade de peças do usuário, destaca jogáveis vs
  inválidas no turno atual.
- `RecommendationList.tsx` — cards ranqueados, Top 1 com destaque visual
  nítido (borda/cor de destaque), demais em ordem decrescente de score.
- `GameHistoryLog.tsx` — log cronológico de jogadas/passes/compras, com
  botão de Undo.

Ícones via `lucide-react` (nova dependência). Tailwind CSS v4 já configurado
no projeto — reaproveitado sem mudanças de tema.

## Fora de Escopo (YAGNI)

- Persistência entre sessões (localStorage) — não pedida, não incluída
  nesta primeira versão.
- Multiplayer em rede / sincronização entre dispositivos.
- Variante com "spinner"/carroça-coringa.
- Meta de pontos fixa para fim de partida (placar é livre, cumulativo).

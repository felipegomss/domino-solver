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

## Pontuação em Fim de Rodada

Duas formas de terminar uma rodada:

1. **Batida** (simples ou do parceiro): um jogador fica sem peças.
2. **Trancamento**: todos os jogadores em sequência passam (com monte já
   vazio ou desabilitado) e ninguém consegue jogar.

Como as mãos dos adversários nunca são 100% conhecidas pelo app, ao fim da
rodada a UI oferece "Revelar mãos": o usuário pode digitar as peças finais de
cada oponente (como acontece na mesa real, quando os perdedores mostram a
mão) para pontuação exata. Se o usuário pular essa etapa, o app estima a
pontuação distribuindo o peso das peças ainda desconhecidas proporcionalmente
entre os jogadores que ainda as poderiam ter (excluindo naipes que a matriz
de `voidSuits` já eliminou para cada jogador).

Placar é cumulativo entre rodadas dentro da sessão (não há alvo de pontos
fixo — o usuário decide quando a partida acaba).

### Bônus de Pontuação: Lá-e-Lô e Bucha

Duas condições especiais de batida valem pontuação em dobro (multiplicador
aplicado sobre os pontos base da rodada, cumulativo se as duas ocorrerem
juntas — dobro cada, ou seja ×4 no total):

- **Lá-e-lô** (lasquenete/lasquinê): a peça que bate o jogo é jogada quando
  as duas pontas abertas já tinham o mesmo valor — ou seja, o vencedor
  "podia bater de lá ou de lô" indiferentemente. Detectado comparando as
  pontas da mesa imediatamente antes da jogada vencedora.
- **Bucha** (carreto): o lado vencedor bate a partida enquanto nenhum
  jogador do lado adversário jogou qualquer peça ainda (mão adversária
  intacta desde a distribuição). Detectado verificando se nenhum jogador
  adversário tem uma jogada (`play`) no histórico até aquele momento.

O solver ganha duas heurísticas adicionais para favorecer essas condições
quando forem alcançáveis sem comprometer as demais heurísticas de segurança:
bônus ao identificar que a jogada atual É a jogada final em condição de
lá-e-lô ou bucha, e um bônus menor e especulativo quando a jogada iguala as
pontas e o usuário ainda guarda peça(s) naquele naipe (abrindo caminho para
uma futura batida de lá-e-lô).

## Tipos Centrais (`engine/types.ts`)

- `Suit = 0 | 1 | 2 | 3 | 4 | 5 | 6`
- `Piece = { id: string; a: Suit; b: Suit }` — canônico com `a <= b`.
- `End = 'left' | 'right'`
- `Board = { sequence: PlacedPiece[]; leftEnd: Suit | null; rightEnd: Suit | null }`
- `PlayerRole = 'user' | 'partner' | 'opponent'`
- `PlayerState = { id: number; role: PlayerRole; team: 'A' | 'B' | null; hand?: Piece[]; handSize: number; voidSuits: Set<Suit>; suitPlayCount: Record<Suit, number> }`
- `GameConfig = { numPlayers: 2|3|4; mode: 'individual'|'duplas'; direction: 'cw'|'ccw'; handSize: number; boneyardEnabled: boolean; startingPlayer: number }`
- `Move = { type: 'play'; playerId: number; pieceId: string; end: End } | { type: 'pass'; playerId: number; drewFirst: boolean } | { type: 'draw'; playerId: number; count: number }`
- `GameState = { phase: 'setup'|'playing'|'round-end'|'finished'; config: GameConfig; players: PlayerState[]; board: Board; boneyard: { remaining: number }; unknownPieceIds: Set<string>; currentPlayerIndex: number; history: Move[]; scores: { A: number; B: number } | Record<number, number>; roundNumber: number }`

## Engine

### `deck.ts`
Gera as 28 peças duplo-6 (`id` = `"a-b"`, `a<=b`).

### `inference.ts`
- `registerPass(state, playerId)`: se monte vazio/desabilitado, adiciona
  `leftEnd`/`rightEnd` atuais a `voidSuits[playerId]`.
- `registerPlay(state, playerId, piece)`: incrementa `suitPlayCount` para os
  naipes da peça jogada (sinal de preferência de naipe).
- `getUnknownPieces(state)`: `deck − mão do usuário − peças na mesa`.
- `estimateSuitLikelihood(state, playerId, suit)`: heurística simples —
  zero se `suit ∈ voidSuits[playerId]`; caso contrário, proporcional ao
  `handSize` do jogador sobre a soma de `handSize` de todos os jogadores
  não-void nesse naipe, ponderada pela fração de peças desconhecidas que
  contêm esse naipe.

### `solver.ts`
`rankMoves(state, userHand): RankedMove[]` onde
`RankedMove = { piece: Piece; end: End; score: number; reasoning: string[] }`.

Para cada jogada válida, soma pesos das seguintes heurísticas (pesos
ajustáveis como constantes no topo do arquivo):

1. **Castigo de passe**: bônus se a ponta resultante tem naipe em que o(s)
   próximo(s) adversário(s) na ordem de turno já é(são) void.
2. **Sinergia de dupla** (modo duplas): penalidade por fechar um naipe em
   que o parceiro tem alta `suitPlayCount` (naipe "forte" dele); penalidade
   por abrir uma ponta em naipe que o parceiro já é void mas o adversário
   seguinte não.
3. **Controle/flexibilidade**: bônus proporcional a quantas peças restantes
   na mão do usuário (após a jogada hipotética) ainda contêm o(s) novo(s)
   valor(es) de ponta.
4. **Alívio de peso**: bônus por descartar dobras e peças de soma alta de
   pontos, maior quanto mais peças pesadas ainda restam na mão.
5. **Incentivo a trancamento**: se a soma de pontos da mão do usuário (mão
   conhecida) for menor que a estimativa média das mãos adversárias, bônus
   para jogadas que aumentam a chance de trancamento (pontas em naipes onde
   múltiplos jogadores já mostraram void).

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
- `REVEAL_HANDS({ hands: Record<playerId, Piece[]> })` — pontuação exata.
- `FINISH_ROUND({ estimated: boolean })` — fecha rodada com pontuação
  estimada se o usuário pular a revelação.
- `NEW_ROUND()` — mantém placar cumulativo, reseta mesa/mãos.

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
  sentido → pedras iniciais → monte (se aplicável) → quem inicia → seleção
  da mão do usuário.
- `BoardDisplay.tsx` — visualiza sequência de peças e pontas abertas,
  responsivo (scroll horizontal em telas pequenas).
- `TurnController.tsx` — ações rápidas contextuais ao turno atual: para
  oponentes/parceiro, seletor de peça (dois seletores de naipe 0-6) + ponta
  + botão "Passou"; para o usuário, atalho para abrir `RecommendationList`.
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

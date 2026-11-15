# SISP: auditoria visual + spec de polish de UI/UX

> Alvo: demo **desktop projetada** para os jurados do NASA Space Apps. Tema: *dark space* (sem logo ainda).
> Autor: figma bro (agente de design) · 15/11/2026, ~02:25 BRT.
> **Nenhum arquivo de código foi alterado.** Este documento só propõe.

## 0. Como ler este documento

- **Valor atual** = citado do código (`arquivo:linha`) ou marcado **(medido do screenshot)**.
- **Valor proposto** = marcado **Proposta**. Os contrastes WCAG foram **calculados** (fórmula de luminância relativa WCAG 2.x, script em Python) e não estimados.
- **Atenção: o código mudou durante a auditoria.** Outro agente estava editando o repo ao mesmo tempo. Às 02:21–02:24 BRT havia mudanças não commitadas em `App.tsx`, `index.css`, `ui.tsx`, `Body3D.tsx`, `BodyMap.tsx`, `Dashboard.tsx` e `store.ts`, e arquivos novos: `HazardStrip.tsx`, `Onboarding.tsx`, `DemoDirector.tsx`, `lib/story.ts`. Essas mudanças foram commitadas às 02:24 BRT (`08b95b6`, `feea6ec`, `6fb0974`). As linhas citadas foram reconferidas contra `6fb0974`.
- Os 4 screenshots em `docs/screenshots/*.webp` (1280 px de largura) são **anteriores** a essas mudanças: não mostram `.space-bg`, `.glass`, MET, botão Demo nem a faixa de hazards. Quando screenshot e código divergem, o código vale e a divergência fica anotada.
- Este documento **constrói em cima** do que já entrou no snapshot (`.space-bg`, `.glass`, `.text-glow` e `.mono` em `src/index.css`) e não propõe um tema paralelo.

Stack confirmada (`package.json`): React 19, Vite 8, **Tailwind v4** via `@tailwindcss/vite` (**não existe `tailwind.config.*`**: o tema vai em `@theme` no CSS), framer-motion 14, R3F 9 + drei 10, recharts 3, zustand 5. i18n próprio em `src/lib/i18n.ts`.

---

## (a) Auditoria: top 10 problemas por impacto nos jurados

| # | Problema | Tela | Evidência | Fix |
|---|---|---|---|---|
| 1 | **O status geral do tripulante não é o herói da tela.** O dado mais importante do app ("como está o tripulante 4 agora") aparece como um badge `text-xs` no meio de uma linha de metadados. Um jurado a 4 m do projetor não vê. | Todas (exceto Emergência) | `App.tsx:127` `<Badge s={a.overall} />` dentro da linha de contexto; `ui.tsx:8` `text-xs`; screenshot dashboard: badge "Warning" com ~20 px de altura **(medido do screenshot)** | Criar uma **Status Hero Bar** abaixo da nav: nome + função à esquerda; à direita, `StatusBadge size="lg"` (ícone + rótulo + nível) e a ação primária ("Agir / Solo →"). Tipo `display-sm` (28 px). Ver (f) Dashboard #1. |
| 2 | **A Emergência não parece uma emergência.** A aba usa o mesmo chrome (header, XP, tripulação), começa com um bloco de disclaimer de 3 linhas e põe os 3 manuais com o mesmo peso. Não tem um modo "takeover". | Emergência | `Emergency.tsx:83-86` (disclaimer primeiro); `Emergency.tsx:87-96` (3 cards iguais); screenshot emergency: o 1º passo acionável só aparece a ~560 px do topo **(medido do screenshot)** | **Emergency takeover**: overlay full-screen com vinheta vermelha, header reduzido (sem XP e sem seletor de ambiente), timer desde o início, **um passo por vez** em tipo grande, metrônomo gigante e o disclaimer recolhido em uma linha + "ⓘ". Ver (d) e (f) Emergência. |
| 3 | **Contraste abaixo do AA em pontos-chave.** O texto do badge Crítico atual (`#ef4444` sobre o tint de 15%) dá **4,31:1** no `.glass`, abaixo de 4,5. O botão do metrônomo (branco sobre `#ef4444`) dá **3,76:1**. `text-slate-500` (`#64748b`) no glass dá **3,89:1**. | Global, Emergência | `knowledge.ts:14` `SEVERITY_COLOR`; `ui.tsx:9` (`+'26'` = tint de ~15%); `Emergency.tsx:67` `bg-red-500 … text-white`; `App.tsx` "Simulated scenario" em `text-slate-500` | Nova escala de status (c): Crítico `#FF6B6B` = 5,61:1 no tint e 6,68:1 no glass; botões sólidos com **texto escuro** (`#01030B` sobre `#FF6B6B` = 7,43:1). Banir `slate-500` para texto. |
| 4 | **Microtipografia ilegível no projetor.** Há 36 ocorrências de `text-[10px]`/`text-[11px]` em `components/` + `App.tsx`. Legendas de gráficos, fontes, dicas do 3D e subtítulos dos cards ficam em 10–11 px. | Global | `grep` → 36 ocorrências; ex.: `Body3D.tsx:102` (dica 10 px), `Trends.tsx:54` (legenda 10 px), `App.tsx:69` (subtítulo 11 px) | Piso de **12 px** (meta) e **14 px** (corpo) em desktop, com escala tipográfica (b). Para projeção, considerar `html { font-size: 17px }` em `≥1280px` (**Proposta**). |
| 5 | **Cor de status sobrecarregada (semântica quebrada).** O amarelo/âmbar serve ao mesmo tempo para Atenção, para o CTA de check-in, para a barra de XP, para o "Nv" e para os pontos de check-in manual nos gráficos. Os 3 manuais de emergência usam vermelho/laranja/amarelo como **categoria**, não como severidade. | Global, Tendências, Emergência | `App.tsx:130` CTA `bg-amber-400/90`; `App.tsx:94` `text-amber-300` (nível); `Trends.tsx:48` ponto manual `#facc15`; `lib/emergency.ts:45,75,100` `#ef4444/#f97316/#eab308` | Reservar as 4 cores **só** para status. CTA e XP passam a usar `accent` (ciano) ou `xp` (violeta). Ponto manual: anel branco. Manuais: ícone + cor `accent`, e severidade só via `StatusBadge`. |
| 6 | **O 3D é bonito mas "solto": não reage à narrativa.** A câmera é fixa (`position [0,1.1,3.3]`), e selecionar um órgão não aproxima nem enquadra. O fundo do canvas é um radial próprio (`#12305e`) que forma uma "caixa" mais clara dentro do card. Os hotspots têm raio 0,018. | Dashboard | `Body3D.tsx:82` camera; `Body3D.tsx:81` `bg-[radial-gradient(circle_at_50%_40%,#12305e,#020617_70%)]`; `Body3D.tsx:63` `sphereGeometry args={[0.018…]}`; screenshot dashboard: retângulo azul visível dentro do card | **Camera rig**: ao selecionar a região, fazer dolly e mudar o target até o hotspot (damp de ~0,6 s, ver d.5), com label ancorado. Canvas transparente sobre `.space-bg`, sem caixa. Hotspot maior + anel de sonar para ≥ Alerta. O card 3D ganha mais largura (ver #8). |
| 7 | **Ícones são emojis heterogêneos.** As abas (🧍✍️📈📡🚨🛰️ℹ️), os títulos dos cards, os ambientes e os avatares (todos `🧑‍🚀`) usam emojis, que renderizam de forma diferente por SO e passam a impressão de "protótipo". Os 4 tripulantes têm avatar idêntico. | Global | `App.tsx:22-30` `tabLabel`; `crew.ts:33,39,48,57` `avatar: '🧑‍🚀'`; títulos com emoji em `Ground.tsx:50,74`, `Emergency.tsx:127,130` | Set de ícones **outline 1,5 px** consistente (SVG inline ou `lucide-react`, ~tree-shaken). Avatares = **monograma + anel de status** (ex.: "T4" com anel laranja). Manter emoji só onde for conteúdo (ex.: ilustração). |
| 8 | **Densidade e grid do Dashboard.** O card do corpo está limitado a `minmax(300px,400px)`, e a coluna direita empilha hazards, detalhe da região, 6 tiles, radiação e mais. Os tiles em `xl:grid-cols-6` quebram "147/90 mmHg" em duas linhas, com alturas desiguais. BP e FC aparecem duas vezes (card da região + tiles). | Dashboard | `Dashboard.tsx:44` grid; `Dashboard.tsx:120` `xl:grid-cols-6`; screenshot dashboard: tile BP com 3 linhas vs FC com 2 **(medido do screenshot)** | Grid de 12 colunas: **corpo 5/12 (≥520 px)**, painel 7/12. Tiles em 3×2 com valor em `mono` + unidade menor e **sparkline de 14 d**. O card da região mostra só o "porquê/ação" e não repete o valor. |
| 9 | **Tendências: gráficos "lamacentos" e sem resposta rápida.** As faixas de referência usam `fillOpacity 0.09` nas 4 cores e somam marrom/verde-musgo. O título em `uppercase` transforma "mmHg" em "MMHG". Falta o "valor de hoje vs baseline" no cabeçalho. O ponto manual é amarelo (colide com Atenção). | Tendências | `Trends.tsx:33` `fillOpacity={0.09}`; `ui.tsx:21` `uppercase`; screenshot trends: "BLOOD PRESSURE (MMHG)"; `Trends.tsx:48` `#facc15` | Faixas: só **Nominal** em `nominal/6%` + **linhas de limite** tracejadas na cor do status. Título em sentence case e unidade fora do `uppercase`. Cabeçalho com **valor atual grande + delta vs baseline + StatusBadge**. Ponto manual = anel branco 2 px. |
| 10 | **Hierarquia de chrome: o header compete com o conteúdo.** São 3 faixas de header (marca + controles, tripulação, abas) e ainda a linha de contexto + o CTA de check-in. O conteúdo útil começa a ~250 px **(medido do screenshot)** num viewport de 720–900 px. A gamificação "Lv 1 · 0 XP · 🔥0 · 🏅0" fica no header principal e, zerada, parece vazia na demo. | Global | `App.tsx:66-120` (header), `App.tsx:93-97` (XP), `App.tsx:130` (CTA); screenshots: o CTA quebra para uma linha própria | Fundir **tripulação + status hero** numa faixa só, com abas logo abaixo (altura total ≤ 168 px). XP vai para um chip compacto ao lado do check-in ou para a aba Check-in. Na demo, semear XP > 0 ou esconder quando = 0. |

Menções honrosas (fora do top 10):
- O foco de teclado é praticamente invisível: só 3 ocorrências de `focus` em `src/`, e não há `focus-visible` global. Para um app médico, a acessibilidade conta pontos. O fix está em (b).
- `aria-label="done"` não traduzido em `Emergency.tsx:106`.
- O comentário em `i18n.ts:3` diz que o App remonta com `key={lang}`, mas não existe `key={lang}` no código. Hoje funciona porque o `App` re-renderiza via `useStore()`, mas fica frágil com `memo` (ver e).
- A fonte `Inter` está declarada (`index.css:3`), mas **não é carregada** (sem `@font-face` nem link em `index.html`), então cai para a fonte do sistema e o visual muda de máquina para máquina.
- O pulso do DONKI usa `boxShadow` infinito (`NasaData.tsx:88`), e as animações infinitas do Framer (`Emergency.tsx:22`, `BodyMap.tsx:372`) **ignoram** `prefers-reduced-motion`. Só o CSS da `.space-bg` respeita (`index.css`, `@media (prefers-reduced-motion)`).

---

## (b) Tokens do tema *dark space*

### b.1 Decisões
- **Fundo**: mantém o `#01030B` já em uso (`index.css`, `body`/`.space-bg`), com a nebulosa e as estrelas atuais.
- **Superfícies**: 3 elevações + glass. A elevação vem de **luminosidade + borda superior com highlight**, não de sombra (sombra some no projetor).
- **Accent**: ciano "telemetria" `#5CC8FF`, próximo do `sky-400` atual, para não quebrar o que existe. **Secundário**: violeta `#A78BFA` (já usado em `Trends.tsx:17`), para dados/2ª série e XP.
- **Fontes** (offline-first → **self-host via `@fontsource`**, nada de Google Fonts em runtime):
  - Display/títulos: **Space Grotesk** 500/700 (técnica e "espacial" sem ser clichê).
  - UI/corpo: **Inter** 400/500/600 (já declarada, agora de fato carregada).
  - Números/telemetria: **JetBrains Mono** 500 com `tabular-nums` (a classe `.mono` já existe).
  - `npm i @fontsource-variable/inter @fontsource/space-grotesk @fontsource/jetbrains-mono` (**Proposta**).

### b.2 Contraste calculado do texto (Proposta)

| Token | Hex | vs `bg #01030B` | vs `surface-1 #0A0F1C` | vs glass efetivo `#0C1323`* | Uso |
|---|---|---|---|---|---|
| `text-1` | `#EAF0FA` | 18,0 | 16,7 | n/d | títulos, valores |
| `text-2` | `#AAB6CB` | 10,1 | 9,35 | 9,06 | corpo, labels |
| `text-3` | `#7F8BA3` | 6,01 | 5,58 | 5,41 | meta, legendas (substitui `slate-500`, que tem 3,89) |
| `accent` | `#5CC8FF` | 10,95 | 10,16 | 9,85 | links, foco, seleção |
| `accent-ink` (texto sobre botão accent) | `#01030B` | n/d | n/d | n/d | 10,95 sobre `#5CC8FF` |

\* glass efetivo = `rgba(15,23,42,.78)` (`.glass` em `index.css`) composto sobre `#01030B` = `#0C1323` (calculado).

### b.3 CSS: variáveis + `@theme` do Tailwind v4 (cole em `src/index.css`, **Proposta**)

```css
@import "tailwindcss";
@import "@fontsource-variable/inter";
@import "@fontsource/space-grotesk/500.css";
@import "@fontsource/space-grotesk/700.css";
@import "@fontsource/jetbrains-mono/500.css";

:root {
  /* superfícies / elevação */
  --sisp-bg: #01030B;
  --sisp-surface-1: #0A0F1C;   /* cards */
  --sisp-surface-2: #0F1628;   /* cards aninhados, tiles */
  --sisp-surface-3: #151E35;   /* hover, popovers, inputs */
  --sisp-glass: rgba(15, 23, 42, 0.78);
  /* texto */
  --sisp-text-1: #EAF0FA;
  --sisp-text-2: #AAB6CB;
  --sisp-text-3: #7F8BA3;
  /* bordas */
  --sisp-border-subtle: rgba(148, 163, 184, 0.12);
  --sisp-border: rgba(148, 163, 184, 0.20);
  --sisp-border-strong: rgba(148, 163, 184, 0.36);
  --sisp-highlight: rgba(255, 255, 255, 0.06); /* borda superior "luz" */
  /* accent */
  --sisp-accent: #5CC8FF;
  --sisp-accent-strong: #8BD9FF;
  --sisp-accent-ink: #01030B;
  --sisp-xp: #A78BFA;
  /* status (ver seção c) */
  --sisp-nominal: #34D399;
  --sisp-caution: #FACC15;
  --sisp-warning: #FB923C;
  --sisp-critical: #FF6B6B;
  /* glow */
  --sisp-glow-accent: 0 0 24px rgba(92, 200, 255, 0.35);
  --sisp-glow-critical: 0 0 0 1px rgba(255, 107, 107, 0.6), 0 0 32px rgba(255, 107, 107, 0.45);
  /* motion (seção d) */
  --sisp-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --sisp-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}

@theme {
  --color-bg: var(--sisp-bg);
  --color-surface-1: var(--sisp-surface-1);
  --color-surface-2: var(--sisp-surface-2);
  --color-surface-3: var(--sisp-surface-3);
  --color-fg-1: var(--sisp-text-1);
  --color-fg-2: var(--sisp-text-2);
  --color-fg-3: var(--sisp-text-3);
  --color-line-subtle: var(--sisp-border-subtle);
  --color-line: var(--sisp-border);
  --color-line-strong: var(--sisp-border-strong);
  --color-accent: var(--sisp-accent);
  --color-accent-strong: var(--sisp-accent-strong);
  --color-accent-ink: var(--sisp-accent-ink);
  --color-xp: var(--sisp-xp);
  --color-nominal: var(--sisp-nominal);
  --color-caution: var(--sisp-caution);
  --color-warning: var(--sisp-warning);
  --color-critical: var(--sisp-critical);

  --font-display: "Space Grotesk", "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  /* escala tipográfica desktop/projeção (size / line-height) */
  --text-meta: 0.75rem;     --text-meta--line-height: 1rem;      /* 12 — piso absoluto */
  --text-body-sm: 0.875rem; --text-body-sm--line-height: 1.25rem;/* 14 */
  --text-body: 1rem;        --text-body--line-height: 1.5rem;    /* 16 */
  --text-title: 1.125rem;   --text-title--line-height: 1.5rem;   /* 18 — títulos de card */
  --text-metric: 1.75rem;   --text-metric--line-height: 2rem;    /* 28 — valores em tiles (mono) */
  --text-display-sm: 1.75rem; --text-display-sm--line-height: 2.125rem; /* 28 — status hero */
  --text-display: 2.5rem;   --text-display--line-height: 2.75rem;/* 40 — takeover de emergência */
  --text-display-xl: 4.5rem;--text-display-xl--line-height: 1;   /* 72 — contador do metrônomo */

  --radius-sm: 0.5rem;   /* chips, inputs */
  --radius-md: 0.75rem;  /* tiles */
  --radius-lg: 1rem;     /* cards */
  --radius-xl: 1.5rem;   /* modais/takeover */

  --shadow-glow-accent: var(--sisp-glow-accent);
  --shadow-glow-critical: var(--sisp-glow-critical);

  --ease-out-expo: var(--sisp-ease-out);
  --ease-in-out-sisp: var(--sisp-ease-in-out);
}

html { font-family: var(--font-sans); background: var(--sisp-bg); color: var(--sisp-text-1); }
@media (min-width: 1280px) { html { font-size: 17px; } } /* projeção: +6% em tudo que usa rem */

/* .glass atual, reescrito com tokens + elevação */
.glass {
  background: linear-gradient(180deg, rgba(15,23,42,0.78), rgba(2,6,23,0.72));
  border: 1px solid var(--sisp-border);
  box-shadow: inset 0 1px 0 var(--sisp-highlight), 0 10px 30px -12px rgba(0,0,0,0.6);
  backdrop-filter: blur(12px);
}
.glass-2 { background: var(--sisp-surface-2); border: 1px solid var(--sisp-border-subtle); box-shadow: inset 0 1px 0 var(--sisp-highlight); }

/* foco global visível (hoje inexistente) */
:where(button, a, select, input, [tabindex]):focus-visible {
  outline: 2px solid var(--sisp-accent); outline-offset: 2px; border-radius: 0.5rem;
}
.tnum { font-variant-numeric: tabular-nums; }
```

**Equivalente `theme.extend`** (só se migrarem para `@config "./tailwind.config.ts"`; em v4 o `@theme` acima é o caminho nativo):

```ts
// tailwind.config.ts (opcional, v4 via @config)
export default {
  theme: { extend: {
    colors: {
      bg: 'var(--sisp-bg)', 'surface-1': 'var(--sisp-surface-1)', 'surface-2': 'var(--sisp-surface-2)', 'surface-3': 'var(--sisp-surface-3)',
      'fg-1': 'var(--sisp-text-1)', 'fg-2': 'var(--sisp-text-2)', 'fg-3': 'var(--sisp-text-3)',
      line: { subtle: 'var(--sisp-border-subtle)', DEFAULT: 'var(--sisp-border)', strong: 'var(--sisp-border-strong)' },
      accent: { DEFAULT: 'var(--sisp-accent)', strong: 'var(--sisp-accent-strong)', ink: 'var(--sisp-accent-ink)' },
      xp: 'var(--sisp-xp)',
      nominal: 'var(--sisp-nominal)', caution: 'var(--sisp-caution)', warning: 'var(--sisp-warning)', critical: 'var(--sisp-critical)',
    },
    fontFamily: { display: ['Space Grotesk', 'Inter Variable', 'sans-serif'], sans: ['Inter Variable', 'Inter', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
    fontSize: {
      meta: ['0.75rem', '1rem'], 'body-sm': ['0.875rem', '1.25rem'], body: ['1rem', '1.5rem'], title: ['1.125rem', '1.5rem'],
      metric: ['1.75rem', '2rem'], 'display-sm': ['1.75rem', '2.125rem'], display: ['2.5rem', '2.75rem'], 'display-xl': ['4.5rem', '1'],
    },
    borderRadius: { sm: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem' },
    boxShadow: { 'glow-accent': 'var(--sisp-glow-accent)', 'glow-critical': 'var(--sisp-glow-critical)' },
    transitionTimingFunction: { 'out-expo': 'cubic-bezier(0.22,1,0.36,1)' },
  } },
}
```

### b.4 Espaçamento e layout (Proposta)
- Base de 4 px (padrão do Tailwind). Ritmo: `gap-2` (8) dentro de componentes, `gap-4` (16) entre cards, `gap-6` (24) entre seções, `p-5` (20) em cards (hoje `p-4` em `ui.tsx:18`).
- Container: `max-w-[1440px] px-6` (hoje `max-w-7xl px-4` em `App.tsx`). No projetor 1920 px isso ganha ~160 px úteis.
- Grid de 12 colunas no desktop (`grid-cols-12`), com spans 5/7 no Dashboard e 8/4 na Emergência.
- Títulos de card: `font-display text-title text-fg-1`, sentence case. O "eyebrow" opcional em `text-meta uppercase tracking-[0.18em] text-fg-3` **só** para rótulos curtos sem unidade (evita o "MMHG").

---

## (c) Escala de status Nominal / Atenção / Alerta / Crítico

Hoje: `SEVERITY_COLOR = ['#22c55e', '#eab308', '#f97316', '#ef4444']` (`knowledge.ts:14`); rótulos PT/EN em `knowledge.ts:13` (`Nominal/Nominal`, `Atenção/Caution`, `Alerta/Warning`, `Crítico/Critical`). O badge só tem **cor + bolinha** (`ui.tsx:6-14`), ou seja, a diferença é só por cor.

### c.1 Cores propostas + contraste WCAG calculado

| Nível | Token | Hex | vs bg `#01030B` | vs glass `#0C1323` | texto no tint 14% (badge) | ink `#01030B` sobre sólido | AA texto normal (4,5) |
|---|---|---|---|---|---|---|---|
| 0 Nominal | `--sisp-nominal` | `#34D399` | **10,72** | 9,64 | 7,45 | 10,72 | ✅ |
| 1 Atenção / Caution | `--sisp-caution` | `#FACC15` | **13,46** | 12,10 | 9,09 | 13,46 | ✅ |
| 2 Alerta / Warning | `--sisp-warning` | `#FB923C` | **9,10** | 8,19 | 6,60 | 9,10 | ✅ |
| 3 Crítico / Critical | `--sisp-critical` | `#FF6B6B` | **7,43** | 6,68 | 5,61 | 7,43 | ✅ |

Comparação com o atual (calculado): Crítico `#ef4444` dá 4,93 no glass e **4,31 no tint do badge (❌ AA)**. Branco sobre `#ef4444` (botão do metrônomo) dá **3,76 (❌)**. Branco sobre `#22c55e` dá 2,28 (❌). **Regra:** botões/chips sólidos de status usam **texto `#01030B`**, nunca branco.

Takeover de emergência (fundo `#1A0609`, Proposta): `#FF6B6B` = 7,05 e `text-1` = 17,08 (✅).

> Nota de daltonismo: Alerta (laranja) e Crítico (vermelho) se confundem em protanopia. Por isso **forma do ícone + rótulo + nível numérico** são obrigatórios, e o Crítico ganha também **movimento** (pulso, ver d.3).

### c.2 Ícone + rótulo (não depender só de cor)

| Nível | Forma do ícone | Glifo | Rótulo PT / EN | Nível | Comportamento extra |
|---|---|---|---|---|---|
| Nominal | círculo | ✓ check | Nominal / Nominal | N0 | nenhum |
| Atenção | círculo | `i` / olho | Atenção / Caution | N1 | nenhum |
| Alerta | triângulo | `!` | Alerta / Warning | N2 | borda 1,5 px |
| Crítico | octógono (stop) | `✕` / `!!` | Crítico / Critical | N3 | pulso + glow (d.3), `role="alert"` quando surge |

### c.3 Snippet `StatusBadge` (Proposta: novo arquivo `src/components/StatusBadge.tsx`; o `Badge` atual pode virar wrapper)

```tsx
import { motion, useReducedMotion } from 'framer-motion'
import type { Severity } from '../lib/knowledge'
import { SEVERITY_LABEL } from '../lib/knowledge'
import { tr } from '../lib/i18n'

export const STATUS = [
  { key: 'nominal',  color: 'var(--sisp-nominal)'  },
  { key: 'caution',  color: 'var(--sisp-caution)'  },
  { key: 'warning',  color: 'var(--sisp-warning)'  },
  { key: 'critical', color: 'var(--sisp-critical)' },
] as const

function StatusIcon({ s, size }: { s: Severity; size: number }) {
  const p = { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (s === 0) return <svg {...p}><circle cx="8" cy="8" r="6.5" /><path d="M5.2 8.2l1.9 1.9 3.7-4" /></svg>
  if (s === 1) return <svg {...p}><circle cx="8" cy="8" r="6.5" /><path d="M8 7.2v4M8 4.8v.01" /></svg>
  if (s === 2) return <svg {...p}><path d="M8 1.8l6.5 11.4H1.5z" /><path d="M8 6.3v3.2M8 11.4v.01" /></svg>
  return <svg {...p}><path d="M5.3 1.5h5.4l3.8 3.8v5.4l-3.8 3.8H5.3l-3.8-3.8V5.3z" /><path d="M6 6l4 4M10 6l-4 4" /></svg>
}

type Size = 'sm' | 'md' | 'lg'
const SZ: Record<Size, { pad: string; text: string; icon: number }> = {
  sm: { pad: 'px-2 py-0.5 gap-1', text: 'text-meta', icon: 12 },
  md: { pad: 'px-2.5 py-1 gap-1.5', text: 'text-body-sm', icon: 14 },
  lg: { pad: 'px-4 py-2 gap-2', text: 'text-title font-display', icon: 20 },
}

export function StatusBadge({ s, size = 'sm', showLevel = false, solid = false, className = '' }:
  { s: Severity; size?: Size; showLevel?: boolean; solid?: boolean; className?: string }) {
  const { color } = STATUS[s]
  const reduce = useReducedMotion()
  const z = SZ[size]
  const critical = s === 3
  return (
    <motion.span
      role={critical ? 'alert' : 'status'}
      className={`inline-flex items-center rounded-full font-semibold ${z.pad} ${z.text} ${className}`}
      style={solid
        ? { background: color, color: 'var(--sisp-bg)' }                               // ink sobre sólido ≥ 7,4:1
        : { background: `color-mix(in oklab, ${color} 14%, transparent)`, color, border: `1px solid color-mix(in oklab, ${color} 45%, transparent)` }}
      animate={critical && !reduce ? { boxShadow: ['0 0 0 0 rgba(255,107,107,0.55)', '0 0 0 8px rgba(255,107,107,0)'] } : undefined}
      transition={critical ? { duration: 1.6, repeat: Infinity, ease: 'easeOut' } : undefined}
    >
      <StatusIcon s={s} size={z.icon} />
      <span>{tr(SEVERITY_LABEL[s])}</span>
      {showLevel && <span className="font-mono opacity-70">N{s}</span>}
    </motion.span>
  )
}
```

Migração mínima: `SEVERITY_COLOR` em `knowledge.ts:14` passa a `['#34D399', '#FACC15', '#FB923C', '#FF6B6B']` (o 3D, os gráficos e o BodyMap herdam). O `Badge` em `ui.tsx:6` vira `export const Badge = (p) => <StatusBadge {...p} />`.

---

## (d) Motion spec (Framer Motion + R3F)

### d.1 Tabela de valores (Proposta)

| Token | Duração | Easing | Uso |
|---|---|---|---|
| `instant` | 0,12 s | `easeOut` | hover, press, toggle EN/PT |
| `fast` | 0,20 s | `[0.22, 1, 0.36, 1]` | badges, chips, tooltips |
| `base` | 0,32 s | `[0.22, 1, 0.36, 1]` | troca de tela (enter) |
| `exit` | 0,16 s | `[0.4, 0, 1, 1]` | troca de tela (exit), sempre mais rápida que o enter |
| `stagger` | 0,045 s/filho, delay 0,06 s | n/d | cards e tiles |
| `emphasis` | 0,45 s | spring `{ stiffness: 260, damping: 26 }` | status hero mudando de nível |
| `takeover` | 0,42 s in / 0,24 s out | `[0.65, 0, 0.35, 1]` | emergência |
| `pulse-critical` | 1,6 s loop | `easeOut` | Crítico (ring expandindo) |
| `camera` | ~0,6 s até 95 % | `damp λ=6` | câmera 3D |

Atual (do código): troca de tela `duration: 0.15`, `y: 6` (`App.tsx:135`); passos da emergência com `delay: i * 0.03` (`Emergency.tsx:104`); pulso da ilustração `0.55 s` infinito (`Emergency.tsx:22`); hotspot com `speed 6/2.5` e `amp 0.35/0.12` (`Body3D.tsx:44-45`); DONKI com `boxShadow` de 1,5 s infinito (`NasaData.tsx:88`).

### d.2 Variants (Proposta: `src/lib/motion.ts`)

```ts
import type { Transition, Variants } from 'framer-motion'

export const EASE_OUT = [0.22, 1, 0.36, 1] as const
export const EASE_IN = [0.4, 0, 1, 1] as const
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const

export const screen: Variants = {
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  enter:   { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.32, ease: EASE_OUT, when: 'beforeChildren', staggerChildren: 0.045, delayChildren: 0.06 } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.16, ease: EASE_IN } },
}

export const card: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.985 },
  enter:   { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: EASE_OUT } },
}

export const statusChange: Transition = { type: 'spring', stiffness: 260, damping: 26 }

export const criticalPulse: Variants = {
  idle: { boxShadow: '0 0 0 0 rgba(255,107,107,0)' },
  pulse: { boxShadow: ['0 0 0 0 rgba(255,107,107,0.55)', '0 0 0 14px rgba(255,107,107,0)'],
           transition: { duration: 1.6, repeat: Infinity, ease: 'easeOut' } },
}

export const takeover = {
  backdrop: { initial: { opacity: 0 }, enter: { opacity: 1, transition: { duration: 0.3 } }, exit: { opacity: 0, transition: { duration: 0.2 } } } satisfies Variants,
  panel: {
    initial: { opacity: 0, scale: 1.04, clipPath: 'inset(8% 8% 8% 8% round 24px)' },
    enter:   { opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0% round 0px)', transition: { duration: 0.42, ease: EASE_IN_OUT } },
    exit:    { opacity: 0, scale: 0.98, transition: { duration: 0.24, ease: EASE_IN } },
  } satisfies Variants,
  vignetteFlash: { enter: { opacity: [0, 0.55, 0.18], transition: { duration: 0.9, times: [0, 0.25, 1] } } } satisfies Variants,
}

export const step: Variants = {  // emergência: um passo por vez
  initial: (dir: 1 | -1) => ({ opacity: 0, x: 40 * dir }),
  enter:   { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE_OUT } },
  exit:    (dir: 1 | -1) => ({ opacity: 0, x: -40 * dir, transition: { duration: 0.18, ease: EASE_IN } }),
}
```

Uso (troca de tela, substitui `App.tsx:135`):

```tsx
<MotionConfig reducedMotion="user">
  <AnimatePresence mode="wait">
    <motion.div key={tab + c.id} variants={screen} initial="initial" animate="enter" exit="exit">
      {/* cada Card: <motion.section variants={card}> herda o stagger */}
    </motion.div>
  </AnimatePresence>
</MotionConfig>
```

### d.3 Crítico
- Badge/tile Crítico: `criticalPulse` (ring expandindo, **não** piscar opacidade: piscar > 3 Hz é risco de fotossensibilidade, e 1,6 s ≈ 0,6 Hz está dentro do limite).
- Na primeira vez que um tripulante vira Crítico: o status hero faz `statusChange` (spring) + **toast persistente** "Crítico: abrir protocolo de emergência →".
- Hotspot 3D Crítico: `speed 3.9 rad/s` (≈0,6 Hz) em vez de 6 (≈0,95 Hz, `Body3D.tsx:44`) + anel de sonar (o anel já existe para `lit` em `Body3D.tsx:49-54`; estender para `sev === 3`).

### d.4 Emergency takeover
1. Gatilho: aba Emergência **ou** CTA do status hero quando Crítico.
2. Sequência: `backdrop` (0,3 s) → `vignetteFlash` vermelho nas bordas (0,9 s, uma vez só) → `panel` (0,42 s, clip-path abrindo) → passos com `step`.
3. Durante o takeover: header reduzido, sem animações decorativas (`.space-bg` pausado), metrônomo com o contador em `text-display-xl` e `scale 1.15 → 1` a cada batida (0,12 s), que já existe em `Emergency.tsx:70`.
4. Saída: `Esc` ou botão "Encerrar protocolo" com confirmação.

### d.5 3D: câmera e highlight (R3F)

```tsx
// dentro do <Canvas>: substitui a câmera fixa (Body3D.tsx:82) por um rig com damping
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three'

const FOCUS: Record<BodyRegionId, { pos: [number, number, number]; target: [number, number, number] }> = {
  brain:           { pos: [0.4, 2.0, 1.6], target: [0, 1.85, 0] },
  heart:           { pos: [0.5, 1.5, 1.7], target: [0.06, 1.43, 0] },
  lungs:           { pos: [-0.5, 1.55, 1.8], target: [-0.09, 1.49, 0] },
  immune:          { pos: [0.0, 1.7, 1.9], target: [0, 1.65, 0] },
  metabolism:      { pos: [0.3, 1.25, 1.8], target: [0, 1.19, 0] },
  musculoskeletal: { pos: [0.6, 0.8, 2.4], target: [0.1, 0.6, 0] },
}  // targets = HOTSPOTS × SCALE (Body3D.tsx:21-31); posições são Proposta, ajustar a olho

function CameraRig({ region, controls }: { region: BodyRegionId | null; controls: React.RefObject<any> }) {
  const { camera } = useThree()
  const reduce = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const pos = new Vector3(); const tgt = new Vector3()
  useFrame((_, dt) => {
    const f = region ? FOCUS[region] : { pos: [0, 1.1, 3.3] as const, target: [0, 0.98, 0] as const }
    pos.set(...f.pos); tgt.set(...f.target)
    const k = reduce ? 1 : 1 - Math.exp(-6 * dt)          // damp λ=6 → ~0,5–0,6 s; reduce = corte seco
    camera.position.lerp(pos, k)
    controls.current?.target.lerp(tgt, k); controls.current?.update()
  })
  return null
}
```

- Highlight: o órgão selecionado fica com `emissiveIntensity 2.4` (já em `Body3D.tsx:64`), e os outros ficam `dim` (o padrão já existe para hazards). O mesmo dim se aplica ao selecionar uma região.
- `autoRotate` (`Body3D.tsx:96`) **para** enquanto o rig estiver em foco e volta após 8 s de inatividade. Com reduced-motion: `autoRotate={false}`.
- O label do órgão (`Body3D.tsx:98-101`) entra com `fast` (opacity + y 4 px).
- Canvas: `gl={{ alpha: true }}` e remover o `bg-[radial-gradient…#12305e…]` (`Body3D.tsx:81`) para o corpo flutuar sobre a `.space-bg`.

### d.6 prefers-reduced-motion
- Envolver o App em `<MotionConfig reducedMotion="user">`: o Framer remove transform/layout e mantém a opacidade.
- Loops infinitos (`Emergency.tsx:22`, `NasaData.tsx:88`, `BodyMap.tsx:372`, `criticalPulse`): condicionar a `!useReducedMotion()` e trocar por um **estado estático forte** (anel sólido 2 px + glow fixo).
- R3F: `useFrame` dos hotspots com `amp = 0` quando reduce; câmera com corte seco (`k = 1`).
- CSS: o `@media (prefers-reduced-motion)` atual de `.space-bg` já está certo; estender para `.animate-pulse` do MET (`App.tsx`, bolinha do MET).

---

## (e) Seletor EN/PT

O que existe: o i18n próprio `t(pt, en)` / `tr(obj)` em `src/lib/i18n.ts`, com idioma no zustand (`store.ts:21,53,66`, padrão `'en'` "para os jurados", o que é uma boa decisão) e `<html lang>` sincronizado (`App.tsx`, `useEffect` de `document.documentElement.lang`). O toggle atual é PT|EN em `App.tsx:82-86`, com `bg-sky-500` no ativo e **sem `aria-pressed`**. `detectLang()` existe (`i18n.ts:18`), mas não é usado.

**Proposta: manter o i18n (zero dependências) e só trocar o componente + posição.**

```tsx
// src/components/LangSwitch.tsx
import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useStore } from '../lib/store'

const LANGS = [{ id: 'en', label: 'EN', name: 'English' }, { id: 'pt', label: 'PT', name: 'Português' }] as const

export function LangSwitch() {
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  useEffect(() => { // atalho "L" para o apresentador alternar ao vivo
    const h = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'l' && !(e.target as HTMLElement).closest('input,textarea,select')) setLang(lang === 'en' ? 'pt' : 'en') }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [lang, setLang])
  return (
    <div role="group" aria-label="Language / Idioma" className="relative flex rounded-full border border-line bg-surface-2 p-0.5 text-meta font-semibold">
      {LANGS.map((l) => (
        <button key={l.id} onClick={() => setLang(l.id)} aria-pressed={lang === l.id} title={l.name} lang={l.id}
          className={`relative z-10 rounded-full px-3 py-1 transition-colors ${lang === l.id ? 'text-accent-ink' : 'text-fg-2 hover:text-fg-1'}`}>
          {lang === l.id && <motion.span layoutId="lang-pill" className="absolute inset-0 -z-10 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
          {l.label}
        </button>
      ))}
    </div>
  )
}
```

- **Onde**: header, canto superior direito, **último item** (após MET / Demo), alinhado com a convenção "utilitário à direita". Também dentro do Emergency takeover (no header reduzido) e no Onboarding (1º slide), porque o jurado pode escolher o idioma logo de cara.
- **Ordem EN → PT** (EN primeiro, coerente com o padrão `'en'`).
- Troca de idioma sem "flash": envolver o conteúdo em `<motion.div key={lang} initial={{opacity:.4}} animate={{opacity:1}} transition={{duration:.12}}>`. Isso também concretiza o `key={lang}` que o comentário de `i18n.ts:3` promete e não existe.
- Opcional: usar `detectLang()` só quando não houver estado persistido **e** não for modo demo (na demo, EN fixo).

---

## (f) Checklist por tela (ordem = maior impacto primeiro)

Legenda de esforço: 🟢 ≤30 min · 🟡 30–90 min · 🔴 >90 min.

### 🔝 Top 5 global (fazer antes de tudo, ~3 h no total)
1. 🟢 **Tokens + fontes** (b.3) e novo `SEVERITY_COLOR` (c.1): conserta o contraste em todo o app de uma vez.
2. 🟡 **`StatusBadge`** com ícone + rótulo (c.3) no lugar do `Badge` (`ui.tsx:6`).
3. 🟡 **Status Hero Bar** (Dashboard #1): o "momento uau" de hierarquia.
4. 🔴 **Emergency takeover** (d.4): é a tela que os jurados lembram.
5. 🟡 **Camera rig 3D + canvas transparente** (d.5): o 3D passa a contar a história.

### Dashboard
1. 🟡 Status Hero Bar: avatar-monograma com anel de status · nome `text-title` · função/agência/dia em `text-fg-2` · `StatusBadge size="lg" showLevel` · CTA primário "Agir / Solo →" (accent). Remove a linha de contexto em `App.tsx:125-133`.
2. 🟢 Grid 12 colunas: corpo `col-span-5` (≥520 px), painel `col-span-7` (`Dashboard.tsx:44`).
3. 🟡 Camera rig + dim dos outros órgãos ao selecionar (d.5). Canvas transparente (remove o radial em `Body3D.tsx:81`). Altura `h-[min(70vh,640px)]` em vez de `h-[440px]`.
4. 🟡 Tiles 3×2 (`Dashboard.tsx:120`): label `text-meta text-fg-3`, valor `font-mono text-metric` + unidade `text-body-sm text-fg-3` na mesma linha, `StatusBadge sm`, **sparkline de 14 d** (recharts `<LineChart>` 32 px, sem eixos). Borda esquerda 3 px na cor do status em vez da borda inteira colorida.
5. 🟢 Card da região: não repetir o valor dos tiles; destacar a **ação** ("👉") como callout `bg-accent/8 border-l-2 border-accent`.
6. 🟢 Barra de radiação: marcadores 50/80/100 % sobre a barra (as faixas já existem como heurística, `Dashboard.tsx:145`), número em `mono`.
7. 🟢 HazardStrip: subir o rótulo de 10 px para `text-meta` (`HazardStrip.tsx:33`).

### Emergência
1. 🔴 Takeover full-screen (d.4): fundo `#1A0609` + vinheta; header reduzido com título do protocolo, **timer MM:SS desde o início** e `LangSwitch`.
2. 🟡 **Um passo por vez**: passo atual em `text-display` (40 px), botões grandes "Anterior / Feito ✓ / Próximo" (setas ←/→ e Espaço) e a lista completa como trilha lateral compacta. Os passos e o `done` já existem (`Emergency.tsx:78,102-119`).
3. 🟢 Metrônomo: botão sólido `bg-critical text-[#01030B]` (7,43:1, corrige o 3,76:1 atual de `Emergency.tsx:67`); contador `text-display-xl font-mono`; anel pulsando a 110 bpm (com reduce: só o número muda).
4. 🟢 Seleção do manual: os 3 cards viram tabs com ícone e **sem** cores de severidade (`lib/emergency.ts:45,75,100` → accent).
5. 🟢 Disclaimer (`Emergency.tsx:83-86`) recolhido: uma linha "Educacional · não substitui flight surgeon · ⓘ" que expande.
6. 🟢 `aria-label` traduzido em `Emergency.tsx:106` (`t('concluído','done')`).
7. 🟡 Ilustração (`h-28`) → `h-48`, com traço `accent-strong` e o ponto de compressão sincronizado com o metrônomo.

### Agir / Solo (Ground)
1. 🟡 Headline do plano (`Ground.tsx:30`, `text-2xl font-black` na cor do status): virar **hero** `font-display text-display-sm` com `StatusBadge lg` e passos numerados em `text-body`.
2. 🔴 **Visualização de atraso de comunicação**: em vez de 4 cards com emoji (`Ground.tsx:51-63`), um diagrama Terra ⟷ destino com o **pulso de sinal animado** na velocidade relativa (ISS 1 s, Lua 2,6 s, Marte 40 min, comprimido em escala log) e o ambiente atual destacado. Visual altamente "NASA", alto impacto nos jurados.
3. 🟢 Escalonamento (`Ground.tsx:70-72`): virar uma **escada vertical** N0→N3 com o nível atual destacado (glow) e os demais `opacity-60`.
4. 🟢 Relatório: `pre` em `font-mono text-meta` com fundo `surface-2`. O botão "Copiar" vira primário accent com feedback "Copiado ✓" (0,12 s) e um botão secundário "Baixar .txt".
5. 🟢 Lista de achados: borda esquerda na cor do status + `StatusBadge`. A razão vai de 11 px para `text-meta`.

### Tendências
1. 🟢 Cabeçalho do card: **valor atual** `font-mono text-metric` + delta vs baseline (`▲ +11 vs base` na cor do status) + `StatusBadge`. Título em sentence case, sem `uppercase` (corrige o "MMHG", `ui.tsx:21`).
2. 🟢 Faixas: remover as 4 `ReferenceArea` a 9 % (`Trends.tsx:31-34`). Manter só a faixa **Nominal a 6 %** + `ReferenceLine` tracejadas nos limites, na cor do status.
3. 🟢 Ponto de check-in manual: anel branco (`stroke #EAF0FA`, `fill` = cor da linha) em vez de `#facc15` (`Trends.tsx:48`).
4. 🟢 Eixos/grade: tick `#7F8BA3` 12 px (hoje `#94a3b8` 10 px, `Trends.tsx:36-37`); grade `rgba(148,163,184,.08)`.
5. 🟡 Interação: hover sincronizado entre os 6 gráficos (`syncId="sisp"` do recharts) e um tooltip com data + valor + status. Linha com `isAnimationActive` ligada no 1º render (600 ms) e desligada com reduced-motion.
6. 🟢 Layout: BP e Glicemia (as histórias do cenário) em largura total no topo e os outros 4 em 2×2. Legenda de 10 px → `text-meta`.

### Global (quando sobrar tempo)
- 🟡 Ícones outline consistentes no lugar dos emojis da nav/títulos (`App.tsx:22-30`).
- 🟢 Header: fundir tripulação + status; XP para um chip discreto com `xp` (violeta), escondido quando `xp === 0` na demo.
- 🟢 `focus-visible` global (b.3).
- 🟢 `MotionConfig reducedMotion="user"` na raiz.

---

## O que não foi possível verificar
- **App rodando ao vivo**: não subi o dev server nem tirei screenshots novos. A auditoria visual usa os 4 `.webp` (anteriores às mudanças em andamento) + leitura do código.
- **Telas Check-in, Dados NASA e Sobre**: só lidas parcialmente no código e fora do escopo dos screenshots.
- **Arquivos em edição por outro agente** (`Onboarding.tsx`, `DemoDirector.tsx`, `lib/story.ts`): só passei os olhos. As linhas citadas valem para o commit `6fb0974`.
- Os valores 3D de `FOCUS` (d.5) são estimativas a partir de `HOTSPOTS × SCALE` e precisam de ajuste visual.

# AI 画布 Pro · Aesthetic Direction v1.1 · Warm Paper Studio

> Stage 2 产物 · 由 `superdesign` skill 指引编写
> 输入：`01-spec.md v1.1`（PIVOT 后）
> 输出：落到像素的美学决策 — 双主题 tokens、ASCII wireframe、纸面氛围、手绘细节、组件图案

---

## 1. Tone Commitment

**Warm Paper Studio · Hand of an editor**（暖纸工作室 · 编辑之手）

> 一本设计师的 **Moleskine moodboard notebook** 被摊开在桌面上。奶白暖米的纸面、蘸水笔画出的墨线连接、秋叶红土色的盖章印记、柔和的纸张抬起阴影、Fraunces 衬线的页眉。**精致**而不幼稚、**温暖**而不奶气、**克制**而不高冷。

### 灵感锚（用于判断偏移）
- Arc Browser 的 warm light mode
- Teenage Engineering 网站的克制暖色 + 编辑感排版
- Craft / Things 3 的纸面感 + 墨色文字
- Milanote 的 moodboard cream
- tldraw 2 的手绘端口与线条（**仅**线条，不是整体涂鸦感）
- Obsidian Minimal + Things 的收敛美学

### 明确排斥
- Notion 贴纸 emoji / Craftsman 手账胶带风（太可爱）
- Material You 暖 tonal palette（太圆滑）
- 2010 年 iOS 拟物（太 skeuomorph）
- 油画滤镜 / 水彩渐变（太 Instagram）
- 手写体字体（Caveat、Patrick Hand、Kalam 禁）
- 糖果色 pastel 渐变

### Unforgettable Element
**手绘墨线 + polaroid 式节点**：
- 连接线是 SVG turbulence filter 轻扰后的墨色细线，末端带一滴渐淡的墨点箭头
- 每个节点是一张奶白纸卡，1px 墨灰 hairline + 柔 y-offset 投影，像从桌面抬起 2mm
- 选中态用**墨虚线框**（抖动 SVG path）包住，而不是描实边
- 一眼看见：**这是桌面上的笔记本，不是屏幕上的 app**

---

## 2. Layout Wireframes（ASCII）

### 2.1 主工作区（Idle · Light 默认）

```
╭─────────────────────────────────────────────────────────────────────────────╮
│ ◉ canvas  ·  lighthouse-v2.canvas  ●saved  ↶  ↷          ☾  ⚙  ⊕ Share    │ ← TopBar paper chip
╰─────────────────────────────────────────────────────────────────────────────╯
                                                                              
 ╭──╮                                                            ╭───────────╮
 │◈ │       ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·   │ Inspector │
 │↖ │                                                            │ ───────── │
 │▱ │   ╭─ text prompt ──────╮                                   │ Style ●   │
 │T │   │ a solitary light-  │                                   │ AI    ○   │
 │▶ │   │ house at dusk,     │                                   │ Data  ○   │
 │♪ │   │ 85mm, cinematic    ├─🖋───────╮                        │ Conn  ○   │
 │◈ │   ╰────────────────────╯          │                        │           │
 │▤ │                                   │                        │ Frame:    │
 │⚏ │                          ╭────────▼────────╮               │  x 580    │
 ╰──╯                          │ ▣ IMAGE · 2/5 ★ │               │  y 200    │
  Dock                         │ ┌─────────────┐ │               │  w 380    │
                               │ │             │ │               │  h 300    │
                               │ │  sample     │ ├─🖋──────╮     │           │
                               │ │  image      │ │        │      │ Versions: │
                               │ │             │ │        │      │ ◎◉◎◎◎     │
                               │ └─────────────┘ │        │      │           │
                               │ ╭ prompt ────╮  │        ▼      │ Model:    │
                               │ │ a soli..   │⊕ │    ╭───────╮  │ gpt-img-1 │
                               │ ╰────────────╯  │    │ GEN   │  │           │
                               ╰─────────────────╯    │ 0:12  │  ╰───────────╯
                                                      │ ░░░░░ │
                                                      ╰───────╯
 ╭─────────────────────────────────────────────────────────────────────────╮
 │ select · drag to marquee  (1204, 682) · 1.00× · 7 nodes · 1 sel · saved │
 ╰─────────────────────────────────────────────────────────────────────────╯
   ↑ StatusBar paper chip
```

注：`🖋` = 手绘墨线连接（turbulence SVG filter 微扰）；`○◉` = version dot；`⊕` = terracotta primary button；`●` = status dot。

### 2.2 节点卡片解构

```
        ╭─ version chip ─╮         ╭─ note (folded corner) ─╮
        │                │         │                         │
        ▼                ▼         ▼                         ▼
  ╭─────────────────────────────────────────────╮
  │  ▣  IMAGE · 02 / 05 · ★                  ◈  │ ← node head: serif italic "IMAGE" +
  ├─────────────────────────────────────────────┤   mono meta ·  ·  ·
  │                                             │
  │         [ generated sample image ]          │
  │             w/ 1px ink hairline             │
  │                                             │
  ├─────────────────────────────────────────────┤
  │ ◉ gpt-image-1 ▾   ◻1:1 ▾   HQ ▾   ×4       │ ← NodeInputBar toolbar
  │                                             │
  │ ╭──────────────────────────────────╮   ⊕   │ ← field (General Sans) + terracotta CTA
  │ │ a solitary lighthouse at dusk... │ Gen  │
  │ ╰──────────────────────────────────╯       │
  │ ↗ inherits 1 prompt                         │ ← subtle ink mark
  ╰─────────────────────────────────────────────╯
   ╲_ paper shadow, warm-black, 2px offset _╱
```

### 2.3 AIGenerating 态（墨水扩散，不扫描线）

```
     ╭─ soft terracotta halo (1200ms ease pulse) ─╮
     ╰─ outer 0→3px, α 0→0.3→0  ────────────────╯
  ╭─────────────────────────────────────╮
  │ ◉ GENERATING · 0:12                 │ ← mono (IBM Plex Mono)
  ├─────────────────────────────────────┤
  │                                     │
  │   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │ ← 纸面 shimmer：两种浅米横条交替
  │   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │    非常缓慢移动（12s pan）
  │   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │
  │                                     │
  ├─────────────────────────────────────┤
  │  gpt-image-1 · 1024² · n=1          │ ← mono meta，灰墨
  ╰─────────────────────────────────────╯
```

### 2.4 Modal（SettingsModal · 书页感）

```
 ╔═══════════════════════════════════════════════════════════════╗
 ║ ◉ Settings                                                  ✕ ║
 ╠════════════════╦══════════════════════════════════════════════╣
 ║ ▸ Providers    ║  OpenAI ~                                    ║
 ║   General      ║  ═══════════════════                          ║
 ║   Keyboard     ║  API Key   ●●●●●●●●●●●●●●●●   👁              ║
 ║   Advanced     ║  Base URL  https://api.openai.com/v1         ║
 ║   About        ║                                               ║
 ║                ║  Models                                       ║
 ║                ║  ┌──────────────┬──────────────┐              ║
 ║                ║  │ ☑ gpt-image-1│ ☑ dall-e-3   │              ║
 ║                ║  └──────────────┴──────────────┘              ║
 ║                ║                                               ║
 ║                ║  [test connection]     ⊕ Save                 ║
 ║                ║  ● CONNECTED · 143ms                          ║
 ╚════════════════╩══════════════════════════════════════════════╝
        ↑ left tab 像书目录；content 像翻开的那一页
```

---

## 3. Theme Tokens · Light（默认 / Cream Paper）

```css
/* 建议落位：Canvas/src/styles/tokens.css */
:root,
[data-theme="light"] {
  /* ── Paper surfaces（奶白→渐深的四层纸面） ─────────────── */
  --bg-0: oklch(0.985 0.012 85);   /* cream, 主画布 / body */
  --bg-1: oklch(0.972 0.014 85);   /* panel surface */
  --bg-2: oklch(0.952 0.016 85);   /* raised / hover row */
  --bg-3: oklch(0.920 0.020 80);   /* active selected row */

  /* ── Ink text（墨色从深到浅） ──────────────────────────── */
  --fg-0: oklch(0.185 0.015 65);   /* warm almost-black, primary */
  --fg-1: oklch(0.365 0.018 65);   /* secondary */
  --fg-2: oklch(0.540 0.020 65);   /* tertiary / meta */
  --fg-3: oklch(0.705 0.020 65);   /* disabled / ghost */

  /* ── Ink lines ─────────────────────────────────────────── */
  --line:        oklch(0.865 0.020 75);   /* hairline 默认 */
  --line-strong: oklch(0.755 0.022 75);   /* hover / focused */

  /* ── Terracotta accent（秋叶 / 封蜡红土） ──────────────── */
  --accent:    oklch(0.565 0.180 45);    /* CTA / 主强调 */
  --accent-hi: oklch(0.490 0.200 45);    /* hover */
  --accent-lo: oklch(0.965 0.030 45);    /* 淡底 chip */

  /* ── Teal signal（墨绿 / 旧书印章绿） ─────────────────── */
  --signal:    oklch(0.515 0.120 180);   /* info / link / focus ring */
  --signal-hi: oklch(0.445 0.135 180);
  --signal-lo: oklch(0.955 0.028 180);

  /* ── Semantic（纸面调性，不过饱和） ────────────────────── */
  --warn:    oklch(0.635 0.155 75);      /* mustard */
  --danger:  oklch(0.525 0.205 25);      /* ink red */
  --success: oklch(0.525 0.135 155);     /* moss green */

  /* ── Paper & Canvas ────────────────────────────────────── */
  --canvas:       oklch(0.982 0.010 85);  /* 稍低于 bg-0 的纸底 */
  --grid-dot:     oklch(0.775 0.020 75 / 0.35);  /* 极淡墨点 */
  --paper-grain:  oklch(0.185 0.015 65 / 0.02);  /* 纸面颗粒色 */
  --vignette:     oklch(0.185 0.015 65 / 0.06);  /* 四周暗角 */

  /* ── Ink shadows（偏暖黑、非纯黑） ─────────────────────── */
  --shadow-ink-1: oklch(0.185 0.020 65 / 0.10);
  --shadow-ink-2: oklch(0.185 0.020 65 / 0.14);

  --shadow-1: inset 0 0 0 1px var(--line);
  --shadow-2: 0 2px 4px -2px var(--shadow-ink-1),
              0 10px 24px -12px var(--shadow-ink-2);
  --shadow-3: 0 4px 8px -4px var(--shadow-ink-1),
              0 18px 40px -16px var(--shadow-ink-2);
  --shadow-4: 0 8px 16px -8px var(--shadow-ink-1),
              0 32px 64px -24px var(--shadow-ink-2);
  --shadow-press: 0 1px 0 0 var(--shadow-ink-1);

  /* ── Sticky (蜂蜡黄) ───────────────────────────────────── */
  --sticky-bg:   oklch(0.945 0.110 92);
  --sticky-line: oklch(0.745 0.140 90);
  --sticky-fg:   oklch(0.305 0.095 80);

  /* ── Ports (墨色家族) ──────────────────────────────────── */
  --port-text:  oklch(0.515 0.120 180);  /* teal */
  --port-image: oklch(0.565 0.180 45);   /* terracotta */
  --port-video: oklch(0.570 0.140 75);   /* mustard */
  --port-audio: oklch(0.465 0.110 290);  /* muted plum */

  /* ── Radii (禁 0px) ────────────────────────────────────── */
  --r-sm: 8px; --r-md: 12px; --r-lg: 18px; --r-pill: 999px;

  /* ── Motion ────────────────────────────────────────────── */
  --dur-xs: 100ms; --dur-sm: 160ms; --dur-md: 240ms; --dur-lg: 380ms;
  --ease-snap:  cubic-bezier(0.22, 0.8, 0.22, 1);
  --ease-stand: cubic-bezier(0.4, 0.0, 0.2, 1);
  --ease-paper: cubic-bezier(0.32, 0.72, 0.24, 1.02);  /* 微微 overshoot */

  /* ── Fonts ─────────────────────────────────────────────── */
  --font-serif: "Fraunces", "Iowan Old Style", Georgia, serif;
  --font-body:  "General Sans", "Söhne", system-ui, sans-serif;
  --font-mono:  "IBM Plex Mono", ui-monospace, "JetBrains Mono", monospace;
}
```

---

## 4. Theme Tokens · Dark（夜间纸 / Evening Paper）

> 规则：**不是黑色屏幕**，而是"墨水晕染的纸"。保留暖色相位 65–85，仅压低亮度。shadow 仍然用，但强度降低。

```css
[data-theme="dark"] {
  --bg-0: oklch(0.185 0.014 65);   /* ink-washed paper, warm dark */
  --bg-1: oklch(0.220 0.016 65);
  --bg-2: oklch(0.260 0.018 65);
  --bg-3: oklch(0.310 0.020 65);

  --fg-0: oklch(0.965 0.012 85);   /* cream text */
  --fg-1: oklch(0.810 0.014 85);
  --fg-2: oklch(0.615 0.016 85);
  --fg-3: oklch(0.465 0.018 85);

  --line:        oklch(0.345 0.020 70);
  --line-strong: oklch(0.435 0.022 70);

  --accent:    oklch(0.705 0.160 45);
  --accent-hi: oklch(0.770 0.175 45);
  --accent-lo: oklch(0.280 0.080 45);

  --signal:    oklch(0.685 0.110 180);
  --signal-hi: oklch(0.760 0.125 180);
  --signal-lo: oklch(0.280 0.060 180);

  --warn:    oklch(0.715 0.150 75);
  --danger:  oklch(0.670 0.200 25);
  --success: oklch(0.680 0.130 155);

  --canvas:       oklch(0.165 0.014 65);
  --grid-dot:     oklch(0.560 0.020 80 / 0.25);
  --paper-grain:  oklch(0.965 0.012 85 / 0.03);
  --vignette:     oklch(0 0 0 / 0.25);

  --shadow-ink-1: oklch(0 0 0 / 0.35);
  --shadow-ink-2: oklch(0 0 0 / 0.50);

  --shadow-1: inset 0 0 0 1px var(--line);
  --shadow-2: 0 3px 6px -3px var(--shadow-ink-1),
              0 14px 30px -14px var(--shadow-ink-2);
  --shadow-3: 0 5px 10px -5px var(--shadow-ink-1),
              0 22px 48px -20px var(--shadow-ink-2);
  --shadow-4: 0 10px 20px -10px var(--shadow-ink-1),
              0 40px 72px -28px var(--shadow-ink-2);
  --shadow-press: 0 1px 0 0 oklch(0 0 0 / 0.5);

  --sticky-bg:   oklch(0.375 0.085 85);
  --sticky-line: oklch(0.560 0.110 85);
  --sticky-fg:   oklch(0.955 0.060 85);

  --port-text:  oklch(0.700 0.110 180);
  --port-image: oklch(0.715 0.165 45);
  --port-video: oklch(0.720 0.140 75);
  --port-audio: oklch(0.665 0.110 290);
}
```

---

## 5. Typography · Pairing & Scale

| Role | Family | Weight / Style | 使用场景 |
|---|---|---|---|
| Wordmark | Fraunces (Variable) | 500 / SOFT 50 / opsz 144 | 只在左上角 `◉ canvas` 和空态大标题 |
| Editorial Hero | Fraunces | 400 / SOFT 80 / opsz 144 | 空态中央、关于页、modal header |
| Section Display | Fraunces italic | 400 / opsz 24 | "Versions"、"Connections"等次级标题（仅少量） |
| UI Body | General Sans | 500 | 默认正文 13–15px |
| UI Label / Button | General Sans | 600 | 按钮文本、tab、chip 中文 |
| Meta (坐标/模型/时间/尺寸/错误码/坐标系/路径) | IBM Plex Mono | 500 / uppercase / tracking 0.06em | chip、版本号、状态条 |
| Inline emphasis | Fraunces italic | 400 | 引用、prompt 中的关键字、hint 文案 |

**Size progression**（纸面收敛，梯度 1.25–1.4×）：
```
meta   10.5px   mono uppercase tracking 0.06em
xs     12px
sm     13px    ← default body (General Sans 500)
md     15px
lg     18px
xl     22px
2xl    30px    hero
3xl    48px    display (仅空态 / modal title)
```

**Font loading**（原型 CDN；生产走 self-host or next/font）：
```html
<!-- Google Fonts: Fraunces (variable) + IBM Plex Mono -->
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..700,0..100;1,9..144,300..700,0..100&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">

<!-- Fontshare: General Sans -->
<link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" rel="stylesheet">
```

---

## 6. Motion Micro-syntax（克制、无 loop）

```
# Paper lift & press
node.hover           → 160ms ease-paper  [translateY 0→-1, shadow-2→shadow-3]
node.press           → 100ms ease-snap   [translateY 0→+1, shadow-2→shadow-press]
node.spawn           → 240ms ease-paper  [S 0.98→1, α 0→1, translateY +4→0]
button.press         → 100ms             [S 1→0.97→1]
chip.hover           → 120ms             [bg bg-1→bg-2, fg fg-1→fg-0]

# Selection
node.select          → 160ms             [ink-wobble-rect fade in via SVG filter turbulence]
node.deselect        → 120ms             [reverse]

# Generation
node.generating.halo → 1200ms ease-in-out infinite  [outer ring α 0→0.28→0, ring 0→3px]
                        (reduced-motion: static 2px terracotta halo α 0.18)
node.generating.bg   → 12s linear infinite          [shimmer stripes pan 0→+12px]
                        (reduced-motion: static stripes)

# Connections
connection.draw      → 380ms ease-stand  [stroke-dashoffset 100%→0, α 0→1]
connection.update    → 160ms             [stroke ink → strong-ink]
                     (NO pulse, NO flowing dash animation; 静止的手绘墨线)

# Port
port.hover           → 140ms             [scale 1→1.18, outer-ring α 0→0.6]
port.connect-ready   → 180ms             [outer-ring color → accent, 2px halo]

# Chrome
panel.slide          → 240ms ease-paper  [translateY +12→0, α 0→1]
modal.open           → 240ms ease-paper  [S 0.98→1, α 0→1] + backdrop α 0→0.55 (180ms)
modal.close          → 180ms ease-stand  [reverse]
toast.enter          → 260ms ease-paper  [translateX +40→0, α 0→1]
toast.exit           → 160ms ease-stand  [reverse]

# Background (浅色下几乎不可感知)
bg.grain-drift       → OFF by default；可选 60s linear ±3px pan
```

**禁止**：
- `pulse` / `breathe` 循环放到静止组件上
- `infinite` 的 dash flow（除了 shimmer，它极慢）
- overshoot > 2%
- 方向乱跳的 fade-in-up 组合

---

## 7. Atmosphere Recipes

### 7.1 画布 · 暖米纸 + dot grid

```css
.canvas-surface {
  background-color: var(--canvas);
  background-image:
    radial-gradient(circle, var(--grid-dot) 0.8px, transparent 1.2px);
  background-size: calc(24px * var(--zoom)) calc(24px * var(--zoom));
  background-position: var(--pan-x) var(--pan-y);
}
```

> **差异化**：用 dot 而非 line grid；dot 0.8px 比常见 1–2px 更细更有纸感。

### 7.2 全屏纸面颗粒（极淡）

```html
<svg class="paper-grain" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <filter id="paper-noise">
    <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0.10   0 0 0 0 0.08   0 0 0 0 0.06   0 0 0 0.035 0"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#paper-noise)"/>
</svg>
```

```css
.paper-grain { position: fixed; inset: 0; pointer-events: none; z-index: 90;
               mix-blend-mode: multiply; opacity: 0.55; }
[data-theme="dark"] .paper-grain { mix-blend-mode: screen; opacity: 0.22; }
```

### 7.3 四周暗角（vignette）

```css
body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 91;
  background: radial-gradient(ellipse at center,
                transparent 50%, var(--vignette) 100%);
}
```

效果：不经意地把视觉中心拉到画布中央，像一本打开的书的自然 vignette。

### 7.4 Node = Polaroid paper

```css
.node {
  background: var(--bg-1);
  border-radius: var(--r-md);            /* 12px */
  box-shadow: var(--shadow-1), var(--shadow-2);
  transition:
    box-shadow var(--dur-sm) var(--ease-paper),
    transform  var(--dur-sm) var(--ease-paper);
}
.node:hover {
  box-shadow: var(--shadow-1), var(--shadow-3);
  transform: translateY(-1px);
}
.node[data-selected="true"] {
  /* 手绘墨虚线框通过外层 SVG 绘制；阴影保持 shadow-3 */
  box-shadow: var(--shadow-1), var(--shadow-3);
}
```

### 7.5 手绘墨线连接（SVG）

```svg
<svg class="ink-connections" width="100%" height="100%">
  <defs>
    <filter id="ink-wobble" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="7" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2"/>
    </filter>
  </defs>
  <g filter="url(#ink-wobble)" stroke="var(--fg-0)" stroke-width="1.25" fill="none" stroke-linecap="round">
    <path d="M 440 270 C 480 270, 480 350, 580 350" />
    <!-- drop head -->
    <circle cx="580" cy="350" r="2.4" fill="var(--fg-0)"/>
  </g>
</svg>
```

> 关键：`scale="1.2"` 轻微抖动；再大就成了涂鸦。`baseFrequency="0.022"` 保证抖动波长足够长，不会变成"抖动噪声"。

### 7.6 Selection · 手绘墨虚线

```svg
<rect x="..." y="..." width="..." height="..."
      fill="none" stroke="var(--fg-0)" stroke-width="1.25"
      stroke-dasharray="5 4"
      filter="url(#ink-wobble)"
      rx="12" ry="12"/>
```

加 4 个小 tick 短线在四角外 6px（SVG `<line>` 4 条），颜色 `var(--accent)`，2px 长。

### 7.7 AIGenerating · 墨水扩散 halo（无扫描）

```css
.gen-halo {
  position: absolute; inset: -1px; border-radius: inherit;
  pointer-events: none;
  box-shadow:
    0 0 0 0 color-mix(in oklch, var(--accent) 0%, transparent);
  animation: gen-halo 1200ms ease-in-out infinite;
}
@keyframes gen-halo {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--accent) 0%, transparent); }
  50%      { box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent) 28%, transparent); }
}
.gen-shimmer {
  background: repeating-linear-gradient(to bottom,
    var(--bg-1) 0 14px,
    var(--bg-2) 14px 28px);
  animation: gen-shimmer 12s linear infinite;
}
@keyframes gen-shimmer {
  from { background-position: 0 0 }
  to   { background-position: 0 28px }
}
@media (prefers-reduced-motion: reduce) {
  .gen-halo { animation: none; box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent) 18%, transparent); }
  .gen-shimmer { animation: none; }
}
```

---

## 8. Component Patterns

### 8.1 Paper chip（顶栏 / 浮层公用）

```
bg:          var(--bg-1)
border:      1px solid var(--line)
radius:      r-lg (顶栏 / 面板) / r-sm (chip / button) / r-pill (segmented)
shadow:      shadow-1 + shadow-2
typography:  General Sans 500 / 13px
padding:     10px 16px (topbar) / 6px 12px (button) / 4px 8px (chip)
```

### 8.2 Button variants

| Variant | bg | fg | border | hover |
|---|---|---|---|---|
| **Primary** | var(--accent) | oklch(0.99 0.01 45) | var(--accent) | bg → accent-hi，translateY(-1px)，shadow-3 |
| Secondary | transparent | var(--fg-0) | var(--line) | border → line-strong，shadow-2 |
| Ghost | transparent | var(--fg-1) | transparent | bg var(--bg-2) |
| Destructive | transparent | var(--danger) | color-mix(danger 40%) | border → danger，shadow-2 |
| Tonal | var(--accent-lo) | var(--accent-hi) | var(--accent-lo) | bg color-mix(accent 14%) |

公共规则：`padding: 8px 14px; radius: r-sm; font General Sans 600; :focus-visible outline 2px var(--signal) offset 2px`；**禁用 drop-shadow color、gradient、glow**。

### 8.3 Input / Textarea

```
bg:         var(--bg-0)
border:     1px solid var(--line) → focus 1.5px solid var(--signal) + inset ring
radius:     r-sm
padding:    8px 12px
font:       General Sans 500 (body), IBM Plex Mono 500 (numeric / model name / coords)
placeholder: Fraunces italic 400, fg-3
caret:      var(--accent)
```

### 8.4 Meta chip（mono，但圆角不硬）

```
bg:         var(--bg-1)
border:     1px solid var(--line)
radius:     r-sm (不用 0，靠细边做质感)
font:       IBM Plex Mono 500 / 10.5px / uppercase / tracking 0.06em
padding:    3px 7px
colors:     fg-1 normal / accent 态 / signal 态 / danger 态 / success 态
variants:   .chip-accent / .chip-signal / .chip-warn / .chip-danger / .chip-success
```

### 8.5 Port（圆形墨点，不发光）

```svg
<svg width="12" height="12" viewBox="0 0 12 12">
  <!-- 外白环：paper 边缘 -->
  <circle cx="6" cy="6" r="5.5" fill="var(--bg-0)" stroke="var(--line-strong)" stroke-width="1"/>
  <!-- 内墨点：按 port 类型上色 -->
  <circle cx="6" cy="6" r="2.8" fill="var(--port-image)"/>
</svg>
```

hover：外环 `stroke: var(--accent)`，加 `box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent) 12%, transparent)`（柔晕而非发光）。

### 8.6 Connection · 手绘墨线（SVG）

见 §7.5。生产环境实现要点：
- 每条 connection 单独一个 `<g>`，共享 `#ink-wobble` filter
- `stroke-width: 1.25`，不要再粗
- 末端箭头用小 `<circle>` 墨点（半径 2–3px），不用传统三角箭头
- hover 时 `<g>` 的 `stroke` 切到 `var(--accent)`
- 长连接可以用 C/S 曲线而非折线，像钢笔扫过的一笔

### 8.7 Sticky note（纸上的纸）

```
bg:         var(--sticky-bg)
border:     1px solid var(--sticky-line)
radius:     r-sm (左上稍大 10px，其余 8px — 模拟手撕纸痕)
shadow:     0 1px 0 0 sticky-line (底部压纸痕),
            0 2px 4px -2px shadow-ink-1,
            0 12px 24px -14px shadow-ink-2
transform:  rotate(-0.4deg) — 随机轻微旋转 ±0.5deg
font:       Fraunces 400 / 15px + Fraunces italic 次行
```

### 8.8 NodeVersionSwitcher

```
┌──────────────────────────────────────────┐
│  ◀   ○ ○ ● ○ ○   2/5   ►  │  view all    │
└──────────────────────────────────────────┘
```
- dot 用 `<circle r="3">`，`fill: var(--fg-3)` 默认；当前态 `var(--accent)`
- 两侧按钮 ghost
- "view all" 是 link 式 ghost text（Fraunces italic 12px + underline on hover）

### 8.9 Empty state

```
      ╱╲
     ╱  ╲       ← 手绘 SVG 空画布插图（100×70），ink-wobble filter
    ╱    ╲
   ╱______╲

   Begin with a whisper.                        ← Fraunces 500 opsz 144 / 30px
   Press  / to summon a node, or drag an image. ← General Sans 14 / fg-2
   ──────────────────────────                   ← hairline 40px 居中
   ⌘K command · V select · H pan               ← IBM Plex Mono 11 / fg-3
```

### 8.10 Status bar（底部纸带）

```
| select · drag to marquee · / summon · ⌘K palette     (1204, 682) · 1.00× · 7 nodes · 1 sel  · ● saved |
|  General Sans 12 / fg-2                              |           IBM Plex Mono 11 / fg-2                |
```

---

## 9. Anti-patterns · Paper 方向的雷区

| 避免 | 原因 |
|---|---|
| ❌ 大面积柔渐变（pastel sky、mint fade） | 失去纸面的"平"，变成 Instagram 滤镜 |
| ❌ 圆角 > 24px | 开始像 tonal Android，失去编辑器感 |
| ❌ 手写体字体（Caveat、Kalam、Patrick Hand） | 立刻变成小学生手账 |
| ❌ emoji 装饰 icon | 我们用 Lucide 线 icon；emoji 只保留在用户数据 |
| ❌ 多种暖色并列（terracotta + olive + mustard + sage 全上） | 只允许 terracotta 作 accent + teal 作 signal，其他 semantic 限量使用 |
| ❌ 实线描边选中 | 选中必须用手绘墨虚线（ink-wobble） |
| ❌ 纯白 #FFFFFF 或纯黑 #000000 | 永远用 oklch 的 warm 偏移 |
| ❌ 硬阴影（offset 0, 0/spread > 0） | 阴影必须有柔 y-offset + 大 blur + 低 alpha |
| ❌ 发光 / glow / neon / scanline | Paper Studio 的核心禁令，见 P4 |
| ❌ 大段文字单字重 | 标题 / 正文 / meta 必须至少两种字体族区分 |

---

## 10. 对 Stage 3 的接力要点

HTML 原型必须呈现：
1. **默认浅色**（`data-theme="light"`）；右上角切 dark = evening paper（不是纯黑）
2. **TopBar 居中胶囊**：wordmark `◉ canvas` 用 Fraunces 500 + SOFT；文件名用 General Sans；`●saved` 小 dot
3. **ToolDock 左侧 paper chip**：竖条 + hairline + shadow-2；tooltip 用 mono chip
4. **PropertiesPanel 右侧**：4 tab（Style / AI / Data / Conn）；数值输入用 IBM Plex Mono
5. **Canvas surface**：dot grid 24px + paper grain + vignette
6. **节点 4 种**：Image（selected + NodeInputBar 展开 + version dots）/ Text（稿纸感）/ AIGenerating（halo + shimmer）/ Sticky（微旋 + 蜂蜡黄） + 1 个 Error 节点
7. **连接 2 条**：SVG + turbulence filter；末端小墨点箭头
8. **AlignmentToolbar 底部浮现**（多选状态下）
9. **GenerationQueuePanel 右上**（可折叠，含 running / failed / done）
10. **StatusBar 底部**：左 tip + 右坐标/缩放/节点数/保存态
11. **SettingsModal 可开**（⌘K 演示触发）
12. **Empty state** 作为第二屏或 modal demo 可选

字体 CDN：
- Fraunces（Google, variable w/ SOFT）
- General Sans（Fontshare）
- IBM Plex Mono（Google）

图标：Lucide（保持现有栈）；**不**引入 Phosphor / Tabler 等多套图标。

下一步 → `03-prototype.html`。

# CGS Advisors Demo — Engineering Plan

> 个人工程计划。纯构建维度。
> 彩排 / 录屏 / Q&A / demo-day 流程 **不在本计划内**。
> 外部 content 依赖（邮件文案 / Acme memo / hero precedent 内容 / Google Doc / 视频素材 / 方法论标签清单）**不在本计划工程 scope**，但在 Phase 2-3-4 的 prereq 里显式列出。

---

## 落地结构（全新建）

```
app/
  globals.css                             # 从 cgs-ui-design/project/styles.css 迁过来
  layout.tsx
  (main)/
    layout.tsx                            # 含 <Sidebar/>
    dashboard/ diagnostic/ continuity/ datahub/ meeting/
  (floating)/
    recall-panel/
src-tauri/
fixtures/
  precedents.json scripted_queries.json interventions.json
  override_cache.json offline_cache.json
  acme_fixtures/ diagnostic_fixtures/ continuity_fixtures/
scripts/gen-*.ts
lib/
  llm/ retrieval/ toneguard/ methodology/
  store.ts
  components/                             # 共享基础组件（Toast / ErrorBoundary / TrafficLight / ...）
assets/fake_zoom.mp4
```

---

## Phase 0 · Pre-Phase-1 blockers

- **0.1 precedent JSON schema + `drilldown_layers[]` 结构**
  - 推荐：`{ depth: 1|2|3, quotes: string[], key_facts: {label, value}[] }`
- **0.2 Claude Recall 返回格式** — tagged stream（`<year>` `<quote>` ...），增量可渲染
- **0.3 环境** — Node 20 + pnpm + Rust + Tauri 2 依赖 + `.env.local`（Anthropic + OpenAI API key）

---

## Phase 1 · Skeleton（⬅ 0.1 / 0.2 / 0.3）

1. Next.js static export（`output: 'export'`，关 image optimization）
2. Tauri 2 两窗口 config：main + recall，`alwaysOnTop: true` / `decorations: false` / `transparent: true` / vibrancy
3. `tauri-plugin-store` schema + typed 封装 + subscribe helper → `lib/store.ts`
   - 字段：`current_client` / `meeting_state` / `recall_history` / `thesis_diff_state` / `wheel_scores`
4. Meeting transition events + `repositionToMainRight()`
   - 事件名：`meeting:start` / `meeting:end` / `recall:query_complete`
   - 主窗口 emit + 浮窗 listen（stub handler，Phase 2A/4.5 再填内容）
5. **路由 stub**：5 个主窗口路由（`/dashboard` `/diagnostic` `/continuity` `/datahub` `/meeting`）+ 浮窗 `/recall-panel` 空页可访问
6. **全局样式迁移**：把 `cgs-ui-design/project/styles.css` 全部 470 行（tokens + `.window` / `.titlebar` / `.app` / `.sidebar` / `.card` / `.btn` / `.tag` / scrollbar / animations 等 layout 规则）迁到 `app/globals.css`；在 `app/layout.tsx` import
7. **AppShell port**（架构级翻译，不是复制粘贴）：
   - `active="<id>"` prop → `usePathname()` 派生
   - 嵌套 `<Sidebar/>` + 主区 → `app/(main)/layout.tsx` + 共享 `<Sidebar/>` 组件
   - 两段式 sidebar（已在 UI 对齐轮）+ titlebar
8. `lib/llm/client.ts` — Claude streaming + **4 段 prompt cache 装配脚手架**
   - Seg 1: CGS framework 定义（boot 一次）
   - Seg 2: precedent 库全文（boot 一次）
   - Seg 3: Acme context — ⚠ **条件注入**：仅在 `current_client !== null` 时包含；否则省略
     - **cache 破坏警告**：有/无 seg 3 是两条不同 cache prefix，各自独立命中；boot 心跳只能 warm "无 seg 3 通用路径"；进 Acme view 后首次调用会是该路径的冷 cache
     - 解法：进 Acme view 时发一个 silent 预热调用，之后该路径进 warm 状态
   - Seg 4: 动态输入
   - Boot-time 心跳 warm seg 1+2
   - t≈5min 心跳防 cache TTL 过期
   - ⚠ 本阶段只搭脚手架，cache 命中率实测等 Phase 3.1 embedding 跑完
9. `lib/retrieval/cosine.ts`（~20 行）
10. Pre-flight check screen — Claude + OpenAI ping 红黄绿
11. cmd-K global shortcut 注册（关 Recall 浮窗后可召唤）
12. **共享基础组件** → `lib/components/`：
    - `<Toast/>`（inline notification，5 种 variant：info / warning / error / success / loading）
    - `<ErrorBoundary/>`（fallback UI + retry 按钮）
    - `<TrafficLight/>`（red / yellow / green 圆点 + 可选 label，Tone Guard 和 Pre-flight 共用）
    - `<StreamingDots/>`（loading / streaming indicator 复用）

---

## Phase 2 · 4 个真功能

### 2A · Real-Time Recall（⬅ 1.2 / 1.3 / 1.4 / 1.8 / 1.9 / 1.11 / 1.12）

**Prereq 输入**（由 content owner 交付）：
- **scripted_queries 清单**（~10 条：首击 + 2 追问 × 2 触发组 + fallback + 5 条"安全" autocomplete 防 VP 脱稿）
- **Recall 追问上下文窗口策略**（推荐：最近 3 对 QA 原文，更早 summarize）

**Engineering tasks**：
- Port `MeetingLaptopView` + `RecallSidebar` → `/recall-panel`
- 1TB 全景常驻条（320K / 15 / 247 / 9）
- **autocomplete**：≥2 字符触发；prefix match on `scripted_queries.json`；↑↓ / Tab 或 Enter 选 / Esc 关；选中 → 预算 embedding；脱稿 Enter → 运行时 OpenAI；OpenAI 挂 → tokenized keyword cosine
- **检索 → LLM 集成链**（2A 核心数据流）：
  1. query embedding（预算 or OpenAI fallback）
  2. 调 `lib/retrieval/cosine.ts` 得 top-3 precedent IDs
  3. 把 IDs + precedent 内容拼入 `lib/llm/client.ts` 的 Seg 4 动态输入
  4. 调 client 拿 streaming response
  5. 转 tagged stream parser
- **tagged stream parser**（`lib/llm/stream-parser.ts`）：
  - 接 Claude chunk 流
  - **chunk 边界缓冲**：chunk 可能在 `<yea|r>` 中间切，parser 持续累积直到完整 `<tag>...</tag>` 边界才 emit
  - 按 tag 名 emit 字段 update → UI 增量渲染
- **streaming 卡片**：year / client / scene / tag / quote / source_id 逐字段 fade-in
- **多轮 deep-dive**：追问共享 session 上下文（走 Phase 1.8 seg 1-3 cache）
- **Recall 浮窗生命周期**：
  - `meeting:start` → show + 定位
  - `meeting:end` → hide（保留 store 不清）
  - 用户手动 × 关闭 → 下次 cmd-K 重新 show
- **错误重试 + 降级链**（架构 §5.2 对齐）：
  - Claude 5xx / timeout → 自动 retry 2 次（指数 backoff 2s / 6s）
  - 重试期间 `<Toast variant="loading">服务繁忙，重试中…</Toast>`（1.12 组件）
  - 两次仍失败 → 读 `offline_cache.json`（**key = 精确 scripted query string**，autocomplete 命中路径才走 offline；脱稿 query 走不通这条）
  - offline 也打空 → 渲染 "No high-confidence precedent — suggest 24h Memo"（等同无锚点 fallback）
- Fellow-voice 双栏（可砍）
- No-anchor fallback（top cosine < 阈值 → 跳 Claude，渲染 "suggest 24h Memo"）

### 2B · Fellow Override（⬅ 1.2 / 1.3 / 1.7 / 1.8 / 1.9 / 1.12）

**Prereq 输入**：
- **Override 分数颗粒度**（推荐：1–7 整数 → low(1-2) / mid(3-4) / high(5-7) bucket）
- **override_cache 默认最小集范围**（推荐：只 bake Strategic Innovation 改高分）

**Engineering tasks**：
- Port `StrategyWheel` + `DiagnosticPage`
- Wheel 7 扇形 click-to-edit（1–7 整数输入）
- **Wheel 分数状态**存 `lib/store.ts` 的 `wheel_scores: {[dim]: 1-7}` 字段；click-to-edit 写入 store；页面刷新保留
- 触发流：wheel click → store 写入 → dispatch override → cache lookup → 命中渲染 / miss 走 streaming
- `override_cache.json` lookup by `{dimension, bucket}` → 命中瞬时
- Miss → streaming Claude（prompt 限制"只重算受影响下游 Inertia + 干预"）45s 预算；复用 2A 的 stream parser
- **Diff 显示**：旧假设卡片 50% opacity + 划线（"superseded"），新假设卡片 streaming fade-in（参照 UI artboard A3）
- Streaming 失败 → Toast 重试链（同 2A 降级）
- Wheel 重染色动画（改分维度 crimson transition，其它 dim graceful fade）

### 2C · Tone Guard 校验器（⬅ 1.1 / 1.7；**可与 Phase 1 后段并行**）

**Prereq 输入**：
- **方法论官方标签清单** → `lib/methodology/tags.ts`（源：CGS_Slides_3_4 + 公开站，交叉审）
- **sales-speak 黑名单** → `lib/methodology/sales-blacklist.ts`（源：PRD §6.2 受禁词清单）

**Engineering tasks**：
- `lib/toneguard/validate.ts` ~50 行：返回 `{verdict: 'pass'|'borderline'|'high-risk', reasons: string[]}`
  - Regex 黑名单匹配
  - 三段 header 存在 + 顺序校验（`What We're Seeing` / `Quick Pulse Check` / `Preliminary Read`）
  - 方法论标签对照白名单（防 Frankenstein）
- `lib/toneguard/validate.test.ts` — 单测 ~10 字符串覆盖每条规则 + 组合
- **§6 E2 集成**：3 封预生成 email render 时**即时跑 validate()**，结果在每封 email 旁显示 `<TrafficLight/>` badge + reason popover
- **VP 现场粘贴组件** → `app/(main)/continuity/ToneGuardPaste.tsx`：
  - 多行 textarea 输入
  - "Validate" 按钮 → 调 validate.ts
  - 结果卡片：`<TrafficLight/>` + reason 列表 + 命中规则在原文中高亮位置

### 2D · Tauri shell 收尾（⬅ 1.2）

- 主窗口 `move` / `resize` event → 浮窗自动重定位
- 用户手动拖开浮窗解除跟随 + "reattach" 按钮恢复
- 主窗口最小化 → 浮窗保留
- cmd-Q 清理

---

## Phase 3 · Fixture 生成 script（engineering-only）

⬅ 依赖 0.1 schema + Phase 2 各功能 prereq 输入就绪

**Script 语义**：`npm run gen:*` **手动一次性跑，output commit 进 repo**。**不是** build 时 auto-run。改 source 后手动重跑 + 重 commit。CI 只负责 mtime 校验（3.5），不自动再生。

### 3.A · 外部 content 依赖（非工程 scope，**本 plan 不覆盖**）

⚠ 以下是内容工单，engineer 等输入到齐即可：

- Acme Industrial 全套 fixture（CEO memo 5pp / 组织图 / Q3 earnings call / 6mo 互动记录 + 3 alert + 3-5 条真公开新闻）
- **Hero Globex 2018** 三层 drilldown 硬货（decision / transition / resistance / rebound）
- 14 条其它 precedent 内容
- Continuity 三封 email（pass / borderline / 退回，场景见 tech-design §2.8）+ 2 封 reply fixture + escalation + engagement 菜单
- Thesis Memory 两张静态截图（Meeting 1 前 / Meeting 2 前）
- Pre-Read Brief + 24h Memo Google Doc（外部链接，外部 Drive 承载）
- `fake_zoom.mp4`（Pexels stock + H.264 + 90s loop + 无音）

### 3.B · Engineering tasks

- **3.1 `scripts/gen-precedent-embeddings.ts`** — 读 `precedents.json` 内容字段 → OpenAI batch embed → 回填 `embedding[]`（~15 条 × 1 OpenAI 调用，$ 成本可忽略）
- **3.2 `scripts/gen-diagnostic-fixtures.ts`** — 读 `acme_fixtures/*` → 调 Claude 预跑 §2 F1-F5 → 写 `diagnostic_fixtures/*.json`（~5 条 Claude 调用）
- **3.3 `scripts/gen-override-cache.ts`** — 按 Override default 最小集调 Claude → 写 `override_cache.json`（最小集 = Strategic Innovation 三档 = 3 条 Claude 调用）
- **3.4 `scripts/gen-offline-cache.ts`** — 对 `scripted_queries.json` 每条预跑 Claude Recall → 写 `offline_cache.json`
  - ⚠ **成本提示**：~10 条 scripted query × 每条携带 full context（Seg 1+2+3 合计数万 tokens）= 中等 Claude 调用预算。**建议 scripted_queries 锁定后才跑，避免频繁重跑烧 $**
- **3.5 CI mtime 校验** — source 新于 fixture 时报警，**不 block**（只是提醒 engineer 手动重跑对应 gen script）

---

## Phase 4 · Fake surface port（⬅ Phase 3 + Phase 2 部分）

### 4.1 Dashboard（§5）

**Prereq 输入**：**Dashboard 时间轴 event type → surface 路由映射表**

**Engineering tasks**：
- Port `DashboardPage` 布局（⬅ Phase 3.2 diagnostic fixtures）
- **30s context-load orchestration**（tech-design §2.5）：
  - `RELOAD_TIMELINE` setTimeout 数组：F1@0s / F2@5s / F3@12s / F4@18s / F5@23s / badge@28s
  - 屏幕右上角实时毫秒计时器
  - 每个 panel 触发时 fade-in 300ms
- 时间轴 event click → `router.push('/<surface>')`（走 prereq 映射表）

### 4.2 Diagnostic（§2）⬅ Phase 3.2 + Phase 2B

- Port `DiagnosticPage` + `StrategyWheel`
- F1-F5 读 `diagnostic_fixtures/*.json`
- F2 Wheel 逐格染色动画
- F6 Override 挂到 Phase 2B

### 4.3 Continuity（§6）⬅ Phase 3.2 + Phase 2C + content 3.A

- Port `ContinuityPage`
- E1 读 diagnostic fixture
- E2 3 封预生成 email 渲染 + 即时 Tone Guard badge（复用 2C）
- E3 挂到 2C 的 VP 粘贴组件
- E4/E5 fixture 驱动

### 4.4 Data Hub（§7）

- Port `DataHubPage`：F1 客户打标 / F2 项目打标 / F3 数据集分类入库 静态展示
- F5–F8 push CSS 动画（下游 surface 指示灯依次亮起）

### 4.5 Meeting state CSS split ⬅ Phase 1.4 + content 3.A

- `/meeting` 路由：左 `fake_zoom.mp4` 循环 + 右 **shared deck 静态一张 slide**（demo 全程不翻页，演示者口述即可）
- 进入时 emit `meeting:start` → 浮窗 show（Phase 2A 生命周期）

### 4.6 Thesis Memory toggle

- 两张截图切换（来自 3.A），toggle 按钮

---

## 工程关键路径

```
0.1 schema + 0.2 Claude format + 0.3 env
  → Phase 1 全部
  → Phase 2A Recall
```

**最长瓶颈** = Phase 2A 的多轮深挖延迟链（prompt cache 命中 + streaming parser）。

可砍：Fellow-voice 双栏 / Override cache 扩展 / F5 访谈问题。
不可砍：Recall 首击+追问延迟路径 / Tone Guard 单测 / 四段 cache 装配。

---

## 风险 → build 动作映射

| # | 风险 | Build 里解法 |
|---|---|---|
| R1 | Recall 首击 >15s | Phase 1.8 boot-time 心跳 warm seg 1+2 |
| R2 | 追问第 3 层"像 ChatGPT" | Phase 0.1 schema 支持长 verbatim 引用；Claude prompt 写死 "quote source, don't paraphrase"（依赖 3.A hero content 硬货） |
| R3 | Override 未 bake 维度 | Phase 2B streaming 动画填时长 |
| R4 | 脱稿 query 打空 autocomplete | Phase 2A OpenAI fallback + tokenized keyword 兜底 |
| R5 | 方法论标签用错（红线） | Phase 2C `lib/methodology/tags.ts` 单一来源 + 交叉审 |
| R6 | Prompt cache TTL 5min 不够 | Phase 1.8 t≈5min 心跳 |
| R8 | 断网 | Phase 3.4 `gen-offline-cache.ts` + Phase 2A 离线兜底读 |
| R9 | Tauri vibrancy 不渲染 | Phase 1.2 fallback 实心半透明 panel |

---

## 测试策略

- **Smoke test**（开发期每天 manual）：5 surface 跑一遍 + 1 次 Recall + 1 次 Override + 1 次 meeting transition
- **Tone Guard unit test**（Phase 2C 写，~10 字符串）
- **延迟目标**（开发期 manual 测）：Recall 首击 <15s / 追问 <10s / Override cache-hit <2s / miss 开始 stream <5s
- **不做 E2E 自动化**

---

## Build 完成标志

- [ ] Next.js static export + Tauri 2 两窗口启动正常
- [ ] 5 个 surface 路由全通，meeting state 切换触发浮窗 show / hide
- [ ] Pre-flight check 三色反馈正常
- [ ] LLM 4 段 prompt cache 装配完成，boot 心跳 + t≈5min 心跳跑通；**用 Anthropic 响应的 `cache_read_input_tokens > 0` 验证第二次调用确实命中**
- [ ] Recall 四条路径全可走：首击 / 追问 / 无锚点 / offline（含 2 次 retry + Toast 降级提示）
- [ ] Recall tagged stream parser 增量渲染正确（含 chunk 边界缓冲）
- [ ] Override cache-hit 瞬时 + miss streaming + wheel 重染色动画全可走
- [ ] Tone Guard 对 3 封 fixture + 任意粘贴字符串都能出判决；`<TrafficLight/>` 在 Continuity badge 和 paste 组件间复用
- [ ] Tone Guard unit test 全绿
- [ ] `npm run gen:*` 4 个 script 一键再生 fixture（commit 进 repo）
- [ ] CI mtime 校验挂上（不 block）
- [ ] **视觉对齐**：各 surface 实装与 `cgs-ui-design/` artboard 过目对照（IBM Plex 字族 / 色板 tokens / card 系统 + 新增 A1–A5 artboard 的实现版本）

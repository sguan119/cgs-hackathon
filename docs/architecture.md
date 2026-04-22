# CGS Advisors Demo — Architecture

> 本文档管"系统怎么搭"。配套：
> - `cgs-prd-v2.md` — 观众看到什么 / 要兑付什么 claim
> - `tech-design.md` — 哪些做真 / 哪些做假 + 具体实现细节

---

## 1. 技术栈

### 1.1 已敲定

| # | 层 | 选型 | 备注 |
|---|---|---|---|
| D1 | **前端** | Next.js 静态导出（`output: 'export'`） | 无 SSR，便于 desktop 壳打包 |
| D2 | **检索** | JSON + 内存余弦相似度 | ~15 条 precedent 不需要向量索引；20 行 JS 搞定。**省下的工程预算花在让 precedent 内容更扎实** |
| D3 | **LLM** | Anthropic Claude API + streaming + prompt caching | Recall 改写 + Override 重算共用同一条 pipeline |
| D4 | **Embedding** | OpenAI `text-embedding-3-small`，**构建期预算** | precedent + 脚本 query 在 build 时算好，烤进 `.app`。运行时纯本地余弦，首击 <500ms。**fallback 触发 = UI 驱动**：autocomplete 选中 → 走预算 embedding；用户硬 enter free-text → 运行时调 OpenAI。**不做内容相似度自动判断** |
| D5 | **桌面壳** | **Tauri 2** | 以效果为主拍板。关键赢点：Recall 浮窗用原生 WKWebView，translucency / vibrancy / 毛玻璃免费，**有"Mac 原生感"**。附带：~10MB 安装包、~200ms 冷启动。Rust 部分仅限 `tauri.conf.json` + 100-200 行 `#[tauri::command]` |
| D6 | **跨窗口状态** | `tauri-plugin-store` | KV + 自动跨窗口 broadcast。生命周期 = 单次 demo，无需持久化，**不上 SQLite** |

---

## 2. 窗口架构

### 2.1 两窗口模型

```
┌─────────────────────────────────────────┐
│ 主窗口（webview，路由）                  │
│ ┌───┬─────────────────────────────────┐ │
│ │ N │ 常规态：                         │ │
│ │ a │   /dashboard /diagnostic        │ │
│ │ v │   /continuity /datahub          │ │
│ │   │                                 │ │
│ │ S │ 会议态（CSS split, sidebar 折叠）│ │
│ │ i │ ┌──────────┬──────────┐         │ │
│ │ d │ │Fake Zoom │ Shared   │         │ │
│ │ e │ │ video    │  deck    │         │ │
│ │ b │ └──────────┴──────────┘         │ │
│ │ a │                                 │ │
│ │ r │                                 │ │
│ └───┴─────────────────────────────────┘ │
└─────────────────────────────────────────┘

         ┌──────────────────┐
         │ Recall 浮窗      │  ← 唯一需要 OS 级
         │ alwaysOnTop:true │     always-on-top
         │ frame:false      │     380px 宽
         │ /recall-panel    │     跟随主窗口贴右外侧
         └──────────────────┘
```

**为什么不是三窗口**：Fake Zoom 不需要单独 OS 窗口——它是主窗口"会议态"下的 CSS split。**真正需要浮在任何应用之上的只有 Recall 面板**。两窗口 IPC 复杂度减半。

### 2.2 窗口职责

| 窗口 | 路由 | 用途 |
|---|---|---|
| 主窗口 | 多路由 | 五个 surface 承载；会议态切 split layout |
| Recall 浮窗 | 单一 `/recall-panel` | §3.6.2 hero 主战场；OS 级 always-on-top |

### 2.3 导航骨架

主窗口左侧常驻 **two-section sidebar**（与 `cgs-ui-design/` 设计稿对齐）：

**Workspace**
- §5 Dashboard
- §7 Data Hub

**Active engagement · {client name}**
- §2 Diagnostic Agent
- §3 Meeting Recall
- §6 Continuity Agent

- §1 Collective Brain **不出现**在 sidebar——它的检索能力嵌在 §3.6.2 会中侧屏的 Knowledge Search，不是独立 surface
- Dashboard 时间轴事件分发（PRD §5 F6）作为**叙事主线**保留，sidebar 是 backup 路径
- 进入会议态时 sidebar 折叠成 ~48px 仅图标，让位 Fake Zoom split

### 2.4 进入"会议态"过渡（strategic）

1. Dashboard 时间轴点 "Acme bi-weekly" → 主窗口 `router.push('/meeting')`，sidebar 折叠 + layout 切 split
2. 主窗口 emit Tauri event `meeting:start`
3. Recall 浮窗 listener 触发：show 浮窗 → 读 store 里的 `current_client` → 自动加载 Acme context
4. 浮窗定位：通过 `mainWindow.outerPosition()` + `outerSize()` 算出右外侧坐标
5. 演示者开始打 query

> 实施层 step-by-step 见 `tech-design.md` §2.4

### 2.5 Recall 浮窗的跟随行为（默认值，可改）

- 主窗口 `move` / `resize` event → Recall 浮窗自动重定位到右外侧
- 用户可手动拖动浮窗解除跟随；按"reattach"按钮恢复
- 主窗口最小化 → 浮窗保留原位（独立生命周期）

---

## 3. 数据层

### 3.1 出厂资产

**A. shipped in `.app`（构建期烤进二进制）**

| 资产 | 内容 |
|---|---|
| `precedents.json` | ~15 条手造 precedent。字段：`id` / `client_name` / `year` / `industry` / `summary` / `scene` / `key_quotes[]` / `cgs_tags[]` / `source_id` / `embedding[]` / `drilldown_layers[]`。权威 schema：`fixtures/precedents.schema.json`（Phase 0.1） |
| `scripted_queries.json` | 脚本 query 池 + 每条预算 embedding |
| `acme_fixtures/` | Acme Industrial 全套 fixture（CEO memo / 组织图 / earnings call / 6mo 互动记录） |
| `interventions.json` | §2 F4 干预库（15-20 条手造案例） |
| `override_cache.json` | §4.3 预 bake 的 Override 重算结果 |
| `fake_zoom.mp4` | 假客户视频（循环播放，~5MB） |

**B. 外部资产（演示时浏览器/Drive 打开，不进 `.app`）**

| 资产 | 内容 | 演示触发 |
|---|---|---|
| Pre-Read Brief | Google Doc | §3.6.1 演示者点链接打开 |
| 24h Memo | Google Doc | §3.6.3 (a) 演示者点链接打开 |

### 3.2 运行时状态（跨窗口共享）

**方案**：`tauri-plugin-store` KV 存储 + 自动跨窗口 broadcast。

```
session-store
├── current_client       "acme"
├── meeting_state        "idle" | "in_meeting" | "post_meeting"
├── recall_history       [{query, precedent_id, ts}, ...]
└── thesis_diff_state    "before_m1" | "before_m2"
```

主窗口和 Recall 浮窗各自 `Store.load()`；写入触发自动 broadcast → 另一窗口 listener 触发 reload。**生命周期 = 单次 demo，无需持久化**。

---

## 4. LLM Pipeline

### 4.1 单条 streaming pipeline，三处复用

```
[Query / Override input]
        ↓
[本地 cosine 召回 top-3 precedent]   ← D4 预算 embedding，<10ms
        ↓
[Anthropic Claude streaming call，分段 prompt cache 见 §4.2]
        ↓
[流式渲染到 UI]
```

**复用点**：
- §3.6.2 Real-Time Recall 首击
- §3.6.2 多轮追问（prompt cache 命中加速）
- §2 F6 Fellow Override 重算（miss `override_cache.json` 时）

### 4.2 Prompt cache 分段策略

Anthropic prompt cache 命中要求**前缀字节级一致**。明确 4 段 breakpoint：

| 段 | 内容 | 缓存周期 | 大小 |
|---|---|---|---|
| 1 | CGS framework 定义（Strategy Wheel 7 维全文 + Inertia 两分法 + First Mile 等） | App 启动一次 | 小 |
| 2 | precedent 库 15 条全文 | App 启动一次 | 中 |
| 3 | Acme 客户 context（CEO memo + 组织图 + earnings call） | 进 Acme view 一次 | 中 |
| 4 | 动态部分：召回的 precedent IDs + 当前 query / Override input | 每次调用变 | 小 |

段 1+2+3 都应稳定命中 cache。Anthropic cache TTL 5 分钟，hero 6 min 内可能要刷一次——见 §6 待决。

### 4.3 §2 Override 延迟兜底（45s 预算）

PRD §2.2.4 给 Override 整个动作 45s。三层兜底：

1. **Streaming 强制开**：不等完整 response，逐字渲染
2. **Prompt 限制**：只重算受影响下游 Inertia + 干预，不 regen 整个 Wheel
3. **预 bake 范围（默认最小集）**：`override_cache.json` **只 bake §2.2.2 植入的 structural mismatch 触发点**（Strategic Innovation 改高分），其它维度改分走真 LLM。**理由**：这条是 demo 高潮叙事的命中点，VP 大概率改这里；其它走真 LLM 兜底。**排练后**如发现别的维度也常被改，再扩展 bake 表

---

## 5. 错误 / 降级处理

### 5.1 Pre-flight check（app 启动时）

- Anthropic API ping → 失败：状态栏红点 + tooltip "LLM 服务异常，建议切录屏 backup"
- OpenAI API ping → 失败：状态栏黄点 + tooltip "embedding fallback 不可用，脱稿 query 会失败"
- 全绿才允许进入 demo 流程

### 5.2 运行时降级

| 场景 | 处理 |
|---|---|
| Anthropic 限流 / 5xx | UI "服务繁忙 10s 后重试" + 自动 retry 2 次。仍失败 → 提示演示者切下一个 surface |
| OpenAI embedding fallback 挂 | UI "无高置信 precedent" → 走 PRD §3.6.2 触发组二（无锚点兜底）路径，自然衔接 §3.6.3 |
| 前端崩溃 | Tauri 自动重启主窗口；浮窗保留 |
| 网络断 | 仍可演纯 fixture 部分（§5 / §2 F1-F5 / §6 / §7），失去 §3.6.2 + §2 F6 真 LLM 路径 |

录屏 backup（PRD §3.9）是**人工最后逃生通道**，不是应用层处理。

---

## 6. 待决清单（架构层）

- [ ] Anthropic prompt cache TTL 5 分钟是否够覆盖 hero 6 min（实测；不够则在第 5 min 触发一次"心跳调用"刷 cache）
- [ ] Override 预 bake 表在 demo 排练后是否需要扩展（默认只 bake structural mismatch）
- [ ] sidebar 在窄屏（<1280px）下的折叠策略

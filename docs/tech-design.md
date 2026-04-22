# CGS Advisors Demo — Tech Design

> 本文档配套：
> - `cgs-prd-v2.md` — 观众看到什么 / 要兑付什么 claim
> - `architecture.md` — 系统怎么搭、技术栈、窗口模型、数据流、LLM pipeline
> - **本文档** — 哪些功能做真 / 哪些做假 + 具体实现细节

---

## 1. Build Cut: Real vs Fake

**原则**：只对"演示或 Q&A 环节会被当场抓"的功能做真实实现，其余全部 fixture / 预生成 / 静态动画。

### 1.1 全 fake（按 surface 列）

| 模块 | 做法 | 兜底 |
|---|---|---|
| **§5 Dashboard** F1–F6 | 静态布局 + 路由跳转。30s context load 是计时表演，不是真加载（实现见 §2.5） | 开场披露虚构客户；PRD §3.5.2 已允许 |
| **§2 Diagnostic** F1 / F2 / F3 / F4 / F5 | 三份 fixture 文档**预跑一次 LLM**（流程见 §2.7），结果硬编码进前端；F1 句子高亮 / F2 Wheel 逐格染色 / F3 Inertia 假设 / F4 干预建议全部走前端动画 | F6 Override 才走真实 LLM（见 §1.2） |
| **§3.6.1 Pre-Read Brief** | Google Doc 预生成 | PRD `scripted` 已声明 |
| **§3.6.3 (a) 24h Memo** | Google Doc 预生成 | PRD `scripted` 已声明 |
| **§3.6.3 (b) Thesis Memory** | 两张静态截图（Meeting 1 前 / Meeting 2 前），toggle 切换展示 diff | PRD `half-real` 已声明 |
| **§6 E2 Check-In Email 生成** | 3 封预生成邮件（pass / borderline / 退回三档样例，定义见 §2.8） | E3 Tone Guard 真跑，对 pre-gen 邮件实时评分 |
| **§6 E4 Reply Signal Extractor** | 2 份预生成 reply fixture，抽取结果硬编码（含 1 份触发 friction） | PRD §6.4 已要求 fixture 标注触发类型 |
| **§6 E5 Internal Escalation** | 硬编码 escalation 卡片 + 预设 engagement 菜单 | — |
| **§7 Data Hub** F5–F8 push 分发 | CSS 动画：下游 surface 指示灯依次亮起 | 不抢 hero 戏份 |
| **Knowledge Search 1TB 全景数字** | mock 数字（具体值见 §2.9） | PRD §3.5.2 已声明 |
| **Fake Zoom 窗口** | 循环视频 + 共享 deck 截图（spec 见 §2.6），作为主窗口"会议态"CSS split 的一部分（非独立窗口） | 物理证据用，VP 关心的是"侧栏怎么贴" |

### 1.2 必须真做（fake 即露馅 / PRD 已锁 real）

| 模块 | 为什么必真 |
|---|---|
| **§3.6.2 Real-Time Recall**（含侧屏 Knowledge Search） | PRD 锁 `real (半脚本)`；多轮深挖一致性肉眼可见，pre-canned 必崩 |
| **§2 F6 Fellow Override** | demo 高潮点；VP 大概率现场改分，pre-canned 当场穿帮 |
| **§6 E3 Tone Guard 校验器** | ~50 行 TS 字符串校验本来好写；VP 大概率会问"这封说成 X 怎么打分"，必须现场跑 |
| **桌面壳多窗口 + always-on-top + 会议态切换** | 产品骨架，不算"功能"（架构详见 `architecture.md` §2） |

### 1.3 实际要工程化的最小件

1. 桌面壳 + 两窗口（架构详见 `architecture.md` §2）
2. **`tauri-plugin-store` schema + 双窗口订阅逻辑**（架构详见 `architecture.md` §3.2）
3. JSON + 余弦相似度检索 over ~15 条手造 precedent（喂 §3.6.2 + §2 F6 共用）
4. 一条 Anthropic Claude streaming pipeline（架构详见 `architecture.md` §4）
5. Tone Guard 校验器（详见 §2.1）

其余全是前端布局 + fixture。

---

## 2. 实现细节

### 2.1 Tone Guard 校验器

不是"引擎"，本质 ~50 行 TS 字符串校验函数。三道关：

| 关卡 | 实现 | 失败档位 |
|---|---|---|
| Sales-speak 黑名单 | 正则匹配 §6.2 受禁词（Lead / Proposal / Deal / Pipeline / Customer / follow-up 等） | 命中 → high-risk |
| 三段格式 | 检查邮件含 `What We're Seeing` / `Quick Pulse Check` / `Preliminary Read` 三段标题 | 缺段 → high-risk；段顺序错 → borderline |
| 方法论标签 | 提到 Strategy Wheel / Inertia 时对照 100% 官方标签清单（防 Frankenstein） | 标签错 → borderline；通篇无方法论标签 → borderline |

输出三档：`pass` / `borderline (Fellow 审)` / `high-risk (退回重生成)`

### 2.2 Recall 浮窗 query 输入 + autocomplete

VP 看着的输入要"看着真又防打错"。

| 行为 | 实现 |
|---|---|
| 触发 | 输入 ≥ 2 字符 |
| Match | `scripted_queries.json` 上的 **prefix match**，case-insensitive |
| 导航 | ↑↓ 切候选 |
| 选中 | Tab 或 Enter（候选高亮时）→ 填充输入框，光标停留 |
| 取消 | Esc 关闭候选列表 |
| 触发查询 | 候选已选 / 输入框有内容时按 Enter |
| 无 match | 提示"no scripted match — Enter 直接查询（实时调用 OpenAI embedding，见 `architecture.md` D4）" |

### 2.3 §2 Override 预缓存清单 + schema

详细策略见 `architecture.md` §4.3。

**默认最小集**（demo 排练前）：

| 改的维度 | 改的方向 | 预缓存命中 |
|---|---|---|
| Strategic Innovation | 改高分（5 / 6 / 7） | 重算的 Inertia + 干预 |

其它 6 维 / 改低分 → 走真 LLM streaming（5-15s）。**排练后**如发现别的维度也常被改，回头扩展本表。

**`override_cache.json` schema**：

```ts
type OverrideCache = {
  [dimension: string]: {
    [scoreBucket: 'high' | 'mid' | 'low']: {
      inertia: {
        type: 'dominant_logic' | 'structural';
        statement: string;
        evidence: string[];   // 引用 fixture 文档原句
      }[];
      interventions: {
        id: string;           // 引用 interventions.json 里的条目
        rationale: string;
      }[];
    };
  };
};
```

### 2.4 Meeting transition 实施细节

对应 `architecture.md` §2.4 的具体落地。架构层管 why + 高层 5 步，本节管事件名 / store key / 函数签名。

**Tauri event 定义**：

| Event | Emitter | Listener | Payload |
|---|---|---|---|
| `meeting:start` | 主窗口 | Recall 浮窗 | `{ client_id: string }` |
| `meeting:end` | 主窗口 | Recall 浮窗 | `{}` |
| `recall:query_complete` | Recall 浮窗 | 主窗口（可选，用于 dashboard 同步） | `{ query: string, precedent_id: string }` |

**Store 写入序列**（主窗口侧）：

```ts
const store = await Store.load('session.json');
await store.set('meeting_state', 'in_meeting');
await store.set('current_client', 'acme');
await store.save();
await emit('meeting:start', { client_id: 'acme' });
```

**Recall 浮窗 listener**：

```ts
await listen<{ client_id: string }>('meeting:start', async ({ payload }) => {
  await getCurrentWindow().show();
  await repositionToMainRight();
  await loadClientContext(payload.client_id);
});
```

**浮窗定位函数**：

```ts
async function repositionToMainRight() {
  const main = await Window.getByLabel('main');
  const pos = await main.outerPosition();
  const size = await main.outerSize();
  const recall = getCurrentWindow();
  await recall.setPosition(new PhysicalPosition(
    pos.x + size.width + 8,
    pos.y + 80,  // 让出 macOS traffic light 高度
  ));
}
```

主窗口 `move` / `resize` event listener 也调用 `repositionToMainRight()` 实现跟随（架构详见 `architecture.md` §2.5）。

### 2.5 §5 Dashboard 30s context load orchestration

PRD §5.5 让演示者看表报时"零秒…28 秒"。**用真 setTimeout 驱动 panel 逐项 reveal**，不靠演示者口报（默数容易飘）。

时序表：

```ts
const RELOAD_TIMELINE = [
  { delay: 0,     panel: 'client_identity' },       // F1 立即出
  { delay: 5000,  panel: 'relationship_stage' },    // F2
  { delay: 12000, panel: 'interaction_timeline' },  // F3
  { delay: 18000, panel: 'ai_alerts' },             // F4
  { delay: 23000, panel: 'external_signals' },      // F5
  { delay: 28000, panel: 'context_loaded_badge' },  // 收尾闪烁
];
```

每个 panel 触发时 fade-in 300ms。屏幕角落常驻**真实毫秒计时器**，演示者直接念屏幕数字。

**理由**：纯静态 + 口报报错风险高（演示者一忙就忘报时）；真 setTimeout 是 ~50 行编排代码就能让"系统加载"看起来像真的。

### 2.6 fake_zoom.mp4 spec

**Stock footage**，不用 AI 生成——VP 一眼能识破 uncanny face。

| 字段 | 值 |
|---|---|
| 内容 | 商务人士专注听 / 偶尔点头的循环画面（单人头像） |
| 长度 | 90s loop |
| 分辨率 | 1280×720 |
| 大小 | ~5MB（H.264 中码率） |
| 音频 | 无（演示者口述会议内容，避免音轨干扰） |
| 构图 | 居中头像，模糊办公室背景 |
| 配套 | 静态共享 deck 截图 1 张（CGS 标准配色，居于视频旁） |

**来源**：Pexels / Pixabay 商务类免费 footage。挑选标准：(1) 表情自然不浮夸；(2) 着装商务但不夸张；(3) 背景不含可识别 logo。

### 2.7 Fixture 生成工作流

`npm run gen:*` 一键产出，可重复跑：

```
scripts/
  gen-diagnostic-fixtures.ts   # 读 acme_fixtures/*，调 Claude 跑 §2 F1-F5，写 diagnostic_fixtures/*.json
  gen-precedent-embeddings.ts  # 读 precedents.json，调 OpenAI 算 embedding，回填到同文件
  gen-override-cache.ts        # 跑 §2 Override 预 bake（默认只 bake Strategic Innovation 高分）
```

跑一次后 commit 产出文件。**改 source（acme_fixtures / precedents）后必须重跑对应 script**。

CI 校验：fixture mtime vs source mtime，source 新于 fixture → 报警。

### 2.8 §6 E2 三档样例 email 定义

| 档 | 场景 | Tone Guard 触发 |
|---|---|---|
| **pass** | Acme CDO 过渡节奏的干净 advisory check-in。三段齐全；正确用 "External Sensing" + "Dominant Logic" 标签 | 全绿 |
| **borderline** | 同上内容但**少了 Quick Pulse Check 段**，且文末写了 "happy to follow up next week" | 三段缺一 + sales-speak "follow up" 双 borderline |
| **high-risk** | 明显 sales 口吻：开篇 "Following up on our last proposal" + "would love to discuss expanding the deal" + 通篇无方法论标签 | 多个黑名单命中 + 无方法论标签 → 退回 |

三封文案在 fixture 阶段一次写完，shipped 进 `.app`。Tone Guard 在 demo 现场对它们实跑评分（不预算结果）。

### 2.9 §3.6.2 1TB 全景数字 mock

侧屏顶部常驻显示：

| 字段 | 值 | 推算依据 |
|---|---|---|
| Indexed files | **320K** | ~3MB avg/file × 320K ≈ 1TB |
| Year span | **15 years** | PRD §2.1.1 CGS 15 年专有 IP |
| Client engagements | **247** | 非整数读起来比 "200" / "250" 更真 |
| Methodology frameworks | **9** | Strategy Wheel + Dominant Logic + Structural Inertia + First Mile + Connecting World + 4 个 archetype 类 ≈ 9 |

被问数字来源：演示者答"基于公开材料推算 + CGS 自报口径"。

---

## 3. 待决清单（实现层）

### 3.1 fixture 内容工单（已知方向，待执行）

- [ ] precedent JSON schema 字段定稿（架构层已定大纲，细字段待）
- [ ] Acme Industrial fixture 文档定稿（CEO memo 5 页 / 组织图 / earnings call transcript）
- [ ] hero precedent（2018 Globex CDO 汇报线案例）的纵深细节定稿——必须撑住 3 层追问
- [ ] §2 Override 预缓存表在 demo 排练后是否扩展（见 §2.3）
- [ ] autocomplete 脚本 query 列表完整定稿（见 §2.2）
- [ ] §6 E2 三封 email 完整文案（见 §2.8）

### 3.2 前端 UI 细节

- [ ] Tone Guard 校验失败时 UI 呈现（红/黄/绿标 + 失败原因展示）
- [ ] §5 Dashboard 计时器视觉位置（右上角 / 中间 / 状态栏）

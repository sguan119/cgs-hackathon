# CGS Advisors Agentic AI PRD

> 本文档用途：生成 demo。所有内容直接服务于 builder 造素材 / 写代码 / 拍场景。

---

## Demo 总体结构（15 min）

| # | Surface | 时长（建议） | 角色 |
|---|---|---|---|
| 1 | §5 Dashboard | ~1.5 min | **入口** — 打开 Acme 客户 → 30s context load 兑付 → 点时间轴事件分发到下游 |
| 2 | §2 Diagnostic Agent | ~3–4 min | 方法论执行 hero-1 |
| 3 | §3 Meeting Recall（§4 Knowledge Search 嵌入侧屏） | ~6 min | **Hero moment** — 会中 Real-Time Recall + 多轮深挖 |
| 4 | §6 Continuity Agent | ~2 min | Post-engagement 复利 |
| 5 | §7 Data Hub | ~1 min | 收尾 — 数据底座揭示 |
| | **总计** | ~13.5 min + buffer | |

时间为建议值，待 team 实际排练后校准。原 §2.2.4 / §3.6.0.1 的内部时间分配为**单独 surface 的节拍参考**，整体 demo 中按上表压缩。

---

## 1. 集体大脑（Collective Brain）

**核心定位**：把 CGS 15 年 1TB 专有 IP（项目档案 / 客户 deck / 方法论笔记 / Gregg 历史输出）变成所有 Agent 都能调用的语义层底座。本文档 §2（Diagnostic Agent）和 §3（Client Meeting Recall）背后所有"调 precedent / 调历史案例 / 调干预库"的动作，调的都是这一层。**§1 作为 §2 / §3 / §5 / §6 的共享底座，检索能力通过 §3.6.2 会中侧屏（原 §4 Knowledge Search 能力已并入）对外展现，§7 Data Hub 向它灌入结构化数据。**

**解决的痛点**：15 年 / 1TB 专有知识散落在 Google Drive，无语义索引。新 Fellow 入职、新项目启动、提案撰写时都无法系统性调用历史 IP。

**最基础功能**：

1. **知识索引（Ingest）**：持续扫描 Google Drive，将 Docs / Slides / Sheets / 图表等 1TB 内容转为可检索的向量 + 知识图谱
2. **语义搜索（Retrieve）**：支持自然语言提问，基于语义召回相关内容，而非关键词匹配
3. **溯源引用（Cite）**：每条结果附带原始文件、位置、作者、时间，支持一键跳回 Google Drive 原文
4. **CGS 专有概念识别**：自动识别 Strategy Wheel 7 维、Dominant Logic / Structural Inertia、First Mile、历史 archetype 等 CGS 独有实体
5. **分层访问控制**：区分 internal-only / client-safe / public-safe 三级权限，防止跨客户数据泄漏

---

## 2. Diagnostic Agent —— 客户诊断 Agent

### 2.1 痛点

#### 2.1.1 业务背景

CGS Advisors 的服务模式要求 Fellow 在客户项目初期（Pre-RFP 或 Day-0 签约后）完成一次**严重耗时的初步战略诊断**：

- 访谈客户 10+ 位高管
- 阅读客户内部战略文档、组织架构、近期高管沟通
- 用 CGS 独家的 **Strategy Wheel（7 维能力轮）** 对客户做成熟度评估
- 用 CGS 独家的 **Inertia 两分法**（Dominant Logic Inertia + Structural Inertia）识别组织摩擦源
- 输出诊断报告 + 最初几个转型假设

典型耗时：**一个 Fellow 全职 1-2 周**

#### 2.1.2 为什么是痛点

| 约束 | 影响 |
|------|------|
| **9 人全公司** | 每人同时只能做 1 个项目的前期诊断 |
| **Retainer-only 不收 T&M** | 诊断阶段花的时间直接 = 利润流失 |
| **Pre-RFP 进入模式** | 客户还没签合同时就要做部分诊断才能 pitch |
| **方法论是独家的，但执行是手工的** | Strategy Wheel + Inertia 是 CGS 最值钱的 IP，但 15 年里没被转化成可执行工具 |

#### 2.1.3 本质

**CGS 有方法论，但方法论从未被机器执行过。** 所有诊断都依赖 Fellow 手工用人脑完成同样的 pattern matching——每个客户都像从零开始。"**把 IP 困在人的脑子里**"的典型表现。

---

### 2.2 Diagnostic Agent — Demo 定稿

#### 2.2.1 定位

**可真用的 prototype**。15 min demo 中作为方法论执行 hero-1，分配 **~3–4 min**（见顶部"Demo 总体结构"）。原 §2.2.4 的 5 min 内部预算是 §2 独立演示时的节拍参考，整体 demo 中需压缩——优先砍 F5 可选项 + 收紧过场。

- **核心叙事**：机器在屏幕上**实时执行 CGS 独家方法论**（Strategy Wheel 7 维 + Inertia 两分法 + 干预建议）
- **设计原则**：Fellow 判决，Agent 拼装——agent 每项输出都可一键下钻到原文、一键推翻

#### 2.2.2 输入（demo 版）

**Demo 用虚构材料**——开场 5 秒明确披露"以下客户为虚构，用于演示方法论"。

虚构客户名 **Acme Industrial**（**与 §3.7 复用同一虚构客户 + 行业中性策略**，省一半 fixture 准备成本，也让两个 demo 在 VP / Fellow 眼里有连贯感）。

三份文档（作为静态 fixture 文件，不做上传 UI）——**全部行业中性**，不绑定具体 sector：
- 5 页战略备忘录（CEO 写给董事会，谈业务转型 / 组织架构 / 数字化职能，口径乐观；不谈门店 / 产线 / SKU）
- 1 张组织架构图（标 Strategic Innovation / Operations / Technology 等普适职能名；故意把关键创新职能埋在低优先级路径上）
- Q3 earnings call transcript（分析师问 transformation cadence / org redesign，CEO 实际讲降本；不谈 same-store sales / unit economics）

**故意植入一处跨文档才能发现的结构性矛盾**（stated vs. structural mismatch）——这是 agent 抓到而 Fellow 快读可能漏掉的"杀手锏"，也是 F4 干预建议的触发点。

Pre-RFP 使用模式锁定为"仅公开资料"。

#### 2.2.3 功能清单

| ID | 功能 | Demo 必须 | 说明 |
|---|---|---|---|
| F1 | 句子 → 7 维标签 | ✅ | 文档高亮 + 维度 tooltip（视觉冲击 1） |
| F2 | Wheel 打分 + 逐格染色 | ✅ | 绿/红动画逐格填色（视觉冲击 2，**动画是 demo 载荷，必须打磨**） |
| F3 | 2 个 Inertia 假设 | ✅ | Dominant Logic + Structural，每条必须带原文引用 |
| F4 | 干预建议（CGS 案例库检索） | ✅ | 每个 Inertia 假设 → 2-3 条候选干预，标"类似 archetype 用过 N 次，平均周期 X 月"——**差异化点，通用 LLM 做不到** |
| F5 | 证据薄弱警告 + 访谈问题 | 可选 | 某维度证据 < 3 片段时标记薄弱 + 生成 3 个访谈问题 |
| F6 | **Fellow Override** | ✅ | **demo 高潮点**：点击改分 → agent 现场重生成下游 Inertia + 干预建议。把叙事从"AI 替代"翻转为"Fellow + AI" |

#### 2.2.4 Demo 动作流（5 分钟，带时间预算）

| 时间 | 动作 | 功能 |
|------|------|------|
| 0:00 – 0:15 | 开场：虚构客户披露 + 三份文档 drop 到屏幕 | — |
| 0:15 – 1:00 | 文档句子逐条高亮 + 7 维标签弹出 | F1 |
| 1:00 – 1:45 | Strategy Wheel 7 维**逐格填色** | F2 |
| 1:45 – 2:30 | 2 个 Inertia 假设生成 + 每条点击下钻到原文 | F3 |
| 2:30 – 3:15 | **Fellow Override 现场演示**：点击 Strategic Innovation 维度改分 → Inertia 假设自动重算 | F6 |
| 3:15 – 4:00 | 展开每个 Inertia 假设 → 2-3 条 CGS 历史案例干预建议 | F4 |
| 4:00 – 4:30 | 若时间允许：某维度标"证据薄弱"→ 生成 3 个访谈问题 | F5（可选） |
| 4:30 – 5:00 | Close：一句话总结 + 对比通用 LLM 输出的差异 | — |

#### 2.2.5 输出三件套

1. **标注过的原文** — 可点击句子反查映射维度
2. **Strategy Wheel 填色图** — 可导出静态图片/Slide
3. **Inertia 假设 + 干预建议 bullets** — 每条带原文引用 + 历史案例锚点

#### 2.2.6 技术骨架（最小可演版）

| 层 | 实现 | 工程投入 |
|---|---|---|
| 输入层 | 三份 fixture 文档，静态加载 | 小 |
| 映射层（F1/F2） | LLM prompt 做句子分类 + 维度聚合。**聚合规则**：F1 句子级标签按证据数聚合，每维度正向证据 ≥ N 条 → 绿，冲突 / 缺证据 → 红，介于之间 → 黄（N 为 mock 阈值，demo 现场可一句话答）。**prompt 工程确保植入的跨文档矛盾能稳定被抓到** | 中 |
| 可视化层（F2/F6） | 前端 Strategy Wheel 组件：7 扇形 + 颜色 + tooltip + **click-to-edit** | **主战场** |
| 假设生成层（F3） | LLM 基于 F1/F2 输出 + 手造的 5-10 条相似 archetype 参考 | 中 |
| 干预库（F4） | 预构造 15-20 条"CGS 历史干预案例"（手造即可，demo 不需要真库） | 小 |
| Override 重算（F6） | 前端触发 → 后端一次 LLM call → 下游假设和干预 stream 回来 | 中 |

---

## 3. Demo PRD: Client Meeting Recall System（会议锚点召回系统）

| 字段 | 值 |
|---|---|
| **交付形态** | Demo / prototype |
| **关联** | 本文档 §1（集体大脑底座）, §2（Diagnostic Agent）|

---

### 3.1 TL;DR

在 15 min demo 中占 **~6 min**（见顶部"Demo 总体结构"）：在同一个虚构 Fortune 500 客户（Acme Industrial）的**会前 / 会中 / 会后**三个时点，演示 Fellow 如何被贴身 AI 助手把 15 年 1TB CGS IP 实时调取、现场兑付、并沉淀为下次会议的更锋利弹药。基调谦虚务实——目标是让 VP / Fellow 看完认可"这帮学生真懂 CGS"，不是 pitch。

---

### 3.2 Demo 目的

我们是 4 个 b-school 学生，没有 CGS 审阅渠道，全靠公开材料（Slides_3_4 + 网上）还原方法论。Demo 在学校教室演给 **VP 教授（CGS 内部）+ 来访 CGS Fellow 1 名（大概率非 Gregg）+ 同班其他队伍**——双目标：

1. **主目标 — VP 教授给高分 + 学术认可"这个团队懂 CGS"**：他打分、他对方法论嗅觉极强，错一个 Strategy Wheel 标签当场失分
2. **辅目标 — visiting Fellow 回办公室告诉 Gregg "值得见一面"**：争取后续接触机会，不是当场 alignment

观众虽然只 1–2 个 CGS 人，但他们**对 CGS 痛点门清**——demo 仍然不教痛点，目标是让他们看完得出：

1. **"这帮学生真懂我们日常踩的坑，不只是套了个 AI 壳"**
2. **"方法论被机器执行得像样，不是泛 ChatGPT"**
3. **"如果真做出来，我们办公室确实有人会用"**

---

### 3.3 观众 × 场景

| 字段 | 值 |
|---|---|
| **主要观众** | **VP 教授（CGS 内部，打分人）+ 来访 CGS Fellow 1 名**（大概率非 Gregg） |
| **次要观众** | 同班其他队伍（不打分但课堂动态影响 VP 印象） |
| **场地** | 学校教室；可能投屏 + Q&A |
| **时长** | **~6 min**（§3 在 15 min 整体 demo 中的分配；详见顶部"Demo 总体结构"。独立演示时 10 min，下文时间表以 10 min 为节拍参考） |
| **形式** | 课堂**产品走查**（演示者直接操作系统投屏） |
| **演示方式** | **不角色扮演**。4 个学生不演 Fellow、不演客户、不搞剧本化会议。用"假设你刚开完会"式叙述 + 真实点击系统展示 artifact |
| **观众事前认知** | **VP 极高**（CGS 内部，发明 / 教授 Strategy Wheel + Inertia）；**visiting Fellow 高**（CGS 日常使用方法论）；**同学不熟**（CGS 业务背景弱） |
| **演示者** | 4 学生中的 1–2 个，无 CGS 协助；金句 / 锚点 / 标签全部基于公开材料还原 |
| **基调** | 谦虚、务实——开场主动声明"我们没渠道审阅，请 VP / Fellow 当场纠错"；把 demo 框架成"作品交卷请指教"，而非"我们替你们想好了" |

---

### 3.4 要被证明的核心命题

| # | 命题 | 不信的话 demo 就失败 | 支撑功能 |
|---|---|---|---|
| **C1** | Fellow 能在会议中 **<30 秒** 从 1TB 调出带精确 precedent 的答案 | 观众回到"就这？AI 搜索谁不会" | §3.6.2 Real-Time Recall |
| **C2** | 系统**对客户完全不可见**——Fellow 权威感不被稀释 | Inverted Pyramid 担忧 | §3.6.2 隐式副手形态 |
| **C3** | 每次会议都让下次会议**更锋利**——系统在复利 | 以为只是个 chatbot | §3.6.3 Compounding Loop |

---

### 3.5 范围

#### 3.5.1 In Scope（demo 必展示）
- 三层回路的**系统走查**：围绕同一个代表性客户上下文，展示 Pre-Read → Real-Time → Compounding 三个 surface
- 四类 artifact 的真实形态：Pre-Read Brief / Fellow 侧屏 / 24h Memo / Thesis Memory
- Real-Time Recall 的**多轮现场实时触发**：首击命中 → 追问深挖同一 precedent → 无锚点兜底
- **跨会议串联**：展示 Meeting 1 的 Thesis Memory 状态如何流入 Meeting 2 的 Pre-Read（C3 视觉证据）
- **CGS 独家证据链**贯穿三层（见 §3.6.0.2）

#### 3.5.2 Cheats OK（允许作弊）

> ⚠️ VP / Fellow 识别作弊的门槛极低。以下作弊项**必须有诚实声明配套**——不是骗他们，是压缩 demo 成本前提下让他们评估"真做出来会是什么样"。

- 检索结果**可预热缓存**——触发→返回体感 <15s 即可
- Real-Time Recall 的 query **可半脚本**（要问什么是预定的，但返回内容必须当场拼出来——不能演"假返回"）
- 24h Memo **允许完全预生成**，显式声明"这是我们用当前原型昨天跑出来的"
- Thesis Memory **可以是预填充静态状态**，演示时明说"这是 mock 的最终态，真实版会自动差分"
- 会议场景**合成**，但问题/锚点必须**基于 Slides_3_4 + 公开材料**拼出 CGS 风格的"真实级别"——演示者无渠道求 Gregg 点头，只能尽力还原

#### 3.5.3 Cheats NOT OK（VP + Fellow 专属红线）
- 不能用 VP / Fellow 立刻能识别出的真客户名（穿帮代价：整个 demo 的专业度掉档）
- 金句不能是泛 ChatGPT 口吻（VP 教授嗅觉一过必挂；他本人就是教方法论的）
- Strategy Wheel / Inertia 标签不能用错（方法论误用在 CGS 内部人面前是硬伤；VP 当场打回扣分）
- 不能演"系统 100% 准确"——要演一次无锚点兜底，否则 VP / Fellow 会质疑真实性
- **不能假装有 CGS 内部信息**——开场必须主动声明"我们没渠道审阅，全靠公开材料还原"。装内行被识破比承认外行更掉档

---

### 3.6 功能需求（Demo 版）

#### 3.6.0 跨层要求

##### 3.6.0.1 时间权重（demo 内部分配）

**原则**：一个难忘时刻 > 三个合格时刻。hero 是会中，会前是铺垫,会后是余韵——不能三层等分。

> ⚠️ 下表基于 §3 **独立 10 min** 的节拍参考；15 min 整体 demo 中 §3 占 **~6 min**，按比例压缩（会前 ~0.9 min / 会中 ~3.6 min / 会后 ~1.2 min / 串联 ~0.3 min）。

| 层 | 占比 | 时长（以 10 min 为基准） | 角色 |
|---|---|---|---|
| 会前 Pre-Read | 15% | ~1.5 min | 铺垫 + 证明独家成分 |
| **会中 Real-Time** | **60%** | **~6 min** | **Hero moment**（含触发组一 ~3 min + 失败路径兜底 ~1 min + 物理场景图 ~1 min + buffer ~1 min） |
| 会后 Compounding | 20% | ~2 min | 余韵 + 复利证据 |
| 串联 / 收尾 | 5% | ~0.5 min | 三层串起来 |

##### 3.6.0.2 CGS 独家证据链（cross-cutting）

三层**每层输出必须能显式溯源到具体历史项目 / Gregg deck / 年份**。这是护城河证据的统一表达，不是新功能，是对现有功能的证据性改造。

| 层 | 溯源呈现方式 |
|---|---|
| 会前 | Brief 里每个锚点标注 "源自 2018 Globex 转型项目" / "Gregg 2021 transformation deck"——即"成分表"（虚构 precedent 客户名 Globex / Initech 等，与当前客户 Acme Industrial 区分） |
| 会中 | 返回卡片底部带 "引自 CGS 项目库 #ID" 的可点击溯源 |
| 会后 | Memo 引用段落旁显示 CGS 项目出处；Thesis Memory 每条 diff 注明触发会议 + 语料来源 |

**作用**：间接回答 C1 的"选择准确度"追问——观众看到锚点溯源后自己判断选对没，比任何 benchmark 都有说服力，也是 CGS 相对通用 AI 工具的核心差异化证据。

---

#### 3.6.1 Layer 1 — Pre-Read Archivist（会前）

**观众看到的**：演示者叙述"假设你明天要开 Acme 的 bi-weekly，系统昨晚自动跑了 brief"，随后**直接打开一份真实存在的 Google Doc**，观众跟着滚动。

**Demo 保真度**：`scripted`（完全预生成）

**必须展示**：
- 5 个预判 analogical 问题（其中 ≥1 个会在"会中"被客户真抛出）
- 每个问题配 CGS 锚点（客户名 / 年份 / 一句解法）
- **每个锚点带"成分表"溯源**（§3.6.0.2）——证明这不是 GPT 通用脑补，而是 1TB 语料驱动。这是 Pre-Read 免于"AI 都能做"质疑的唯一挡箭牌
- Strategy Wheel + Inertia 标签肉眼可见
- 一段对"上次会议未解问题"的预研（埋 C3 伏笔）

---

#### 3.6.2 Layer 2 — Real-Time Recall（会中）—— **Demo Hero Moment（60%）**

**核心定位**：**不是搜索工具，是对话式深挖**。真实会议里 70% 的 analogical 问题会被客户追问同一 precedent 的细节；只演"一次触发 → 一张卡"会让观众以为这只是个语义搜索。

**观众看到的**：会中环节演示**两组触发**，加一张物理场景说明图——

##### 会中侧屏的 Knowledge Search 能力（原 §4 并入）

Fellow 侧屏本身即 **Knowledge Search UI**。首击前 1–2 秒屏幕上必须露出以下元素，证明这不是 GPT 壳而是 1TB 专有语料驱动：

- **1TB IP 全景数字（侧屏顶部常驻）**：索引文件总数 / 年份跨度 / 覆盖客户项目数 / 方法论框架数（mock 但合理）——**demo 的关键视觉锚点**
- **CGS 概念高亮**：返回卡片内 Strategy Wheel 7 维 / Dominant Logic / Structural Inertia 等实体自动着色
- **结果溯源**：与 §3.6.0.2 证据链统一，每张卡片底部可点击跳 Drive 原文

三点在首击结果卡片上**同屏出现**，不单独分 demo 时间。原 §4 不再作为独立 surface 走查。

##### 触发组一（命中 + 多轮深挖）—— hero 中的 hero

- **首击**：演示者叙述"假设客户突然抛了一个 brief 里没预判到的问题"，**把真实 query 打进 UI** → 转圈 → <15s 返回首张锚点卡片（例：2018 **Globex** CDO 汇报线案例——虚构 precedent 客户，与当前客户 Acme Industrial 区分）
- **追问 1**：演示者模拟客户进一步追问——"他们的 CDO 最后向谁汇报？" → 同一会话继续键入 → **<10s 返回同一 precedent 的深层细节**（汇报线定案 + 过渡时长 + 阻力来源）
- **追问 2（可选，如时长允许）**：再深挖一次细节，如"这个解法持续了多久 / 有没有反弹"——展示**纵深可持续**，不是搜一条就到底
- **Fellow 口吻翻译双栏**：每一轮返回都配"系统原金句 → Fellow 可能这么改成自己的话"——证明每一层都能被 Fellow 自然说出

##### 触发组二（无锚点兜底）

演示者故意打一个刁钻问题 → 系统返回"无高置信 precedent，建议承诺 24h Memo" → 衔接 §3.6.3

##### 物理使用场景说明

**主形态**：笔记本侧栏 web。

穿插**一张**静态图，把 Fellow 最可能问的物理疑虑答掉，**不扮演**：

- **图 A — 笔记本侧栏**：回答"侧栏怎么放、客户能不能从对面 / 侧面看到、共享屏幕模式下怎么切"

---

**Demo 保真度**：`real (半脚本)` — 首击 + 追问序列 + 兜底问题都预先选定，但 UI 交互 / 返回 / 时延必须在观众面前**真实发生**；**追问的返回必须是基于同一 precedent 的真实纵深数据**——语料里这条 precedent 必须确实有这些细节，不能是 LLM 脑补

**必须展示**：
- UI 结构清晰区分 "Fellow-only 屏幕" 与 "客户可见屏幕"（C2）
- 首击 <15s，追问 <10s（同一 precedent 已激活，应该更快）
- 响应卡片：年份 + 客户名 + 一句场景 + Strategy Wheel 标签 + 可出口金句 + **溯源 ID**（§3.6.0.2）
- **多轮深挖（P0 必展）**：至少 1 次追问同一 precedent，返回更深细节——把 Real-Time Recall 从"搜索"升级为"对话式深挖"
- **Fellow 口吻翻译双栏**——每一轮都显示（保 Inverted Pyramid）
- **物理使用场景图 ×1**——图 A 笔记本侧栏（主形态，真演用）
- 无锚点兜底成功衔接 §3.6.3（证明"复利闭环"起点）

---

#### 3.6.3 Layer 3 — Compounding Loop（会后）

**观众看到的**：演示者叙述"假设那场会开完 24 小时过去了，系统自动产出了下面这些"，依次打开三个真实 artifact——

##### (a) 24h Analogical Memo（对外）
- **保真度**：`scripted`（完全预生成）
- **必展**：≤3 页，精确 precedent + 差异点 + next step；Fellow 署名；邮件正文是 Fellow 亲笔风，**无 AI 痕迹**

##### (b) Client Thesis Memory（对内）
- **保真度**：`half-real`——展示 **Meeting 1 前** 和 **Meeting 2 前** 两个时间点的**真实 diff**，而非静态 mock
- **必展**：
  - 三栏视图：Dominant Logic 现状 / 已引用锚点 / 未解矛盾
  - **Diff 视图**：红/绿对比两次会议间 Thesis 的演化，让"复利"从**口头承诺变成肉眼可见证据**（C3 真正兑现的唯一路径）
  - 每条 diff 标注"触发自 Meeting 1 的哪段对话 + 语料哪条 precedent"（§3.6.0.2）

---

### 3.7 数据与语料

| 类别 | 真 / 合成 | 说明 |
|---|---|---|
| CGS 语料 | **半合成（基于公开材料）** | 没有真客户档案，从 Slides_3_4 + Gregg 公开访谈 + CGS 网站还原 2–3 个 precedent；**hero precedent 必须有足够纵深细节**支持会中 2–3 轮深挖（汇报线定案、过渡时长、阻力来源、后续反弹）——细节在公开材料找不到的部分用方法论合理推演填充，不能凭空捏造 |
| 客户公司 | **合成 + 行业中性** | 虚构 **Acme Industrial**（与 §2.2.2 复用同一客户 + fixtures：CEO memo / 组织图 / earnings call），Fortune 500 profile；**fixtures 刻意不绑定具体 sector**——CEO memo 谈"业务转型 / 组织架构 / 数字化职能"而非"门店 / 产线 / SKU"；组织图标"Strategic Innovation / Operations / Technology"而非 sector-specific 职能名；earnings call 谈"transformation cadence"而非"same-store sales"。Hero precedent 选**治理结构类**（CDO 汇报线、跨部门 PMO），跨行业普适。被问到行业时一句话答："刻意做了行业脱敏，方法论本身跨行业通用"——VP / Fellow 反而加分 |
| 会议场景 | **合成** | 剧本化 bi-weekly；结构要让 VP / Fellow 说"这就是 CGS 典型周二" |
| Analogical 问题 | **合成（公开材料还原）** | 脚本化的 Structural Inertia 问题；问题模式取自 Slides_3_4 + 公开 deck 里 Gregg 提到的客户场景 |
| Strategy Wheel / Inertia 标签 | **必须 100% CGS 官方** | 方法论本体不容出错；公开材料里的标签定义全部交叉对照后再用 |
| CGS-voiced 金句 | **半合成** | 基于公开材料里 Gregg 的口吻改写；演示者主动声明"风格我们尽力贴，请 VP 当场指出哪里不像" |

**合成原则**：所有 mock 内容**优先基于公开材料**，凡公开材料找不到的部分，用方法论本体合理推演 + 演示者声明"这是我们的还原，请纠错"。**装内行被识破，比承认外行更掉档**。

---

### 3.8 交互表面（观众可见 artifact 清单）

| Artifact | 媒介 | 制作方式 | 外观关键要求 |
|---|---|---|---|
| Pre-Read Brief | Google Doc | 预生成 | CGS 品牌风，3 页，预判清单 + 锚点 + 标签 |
| Fellow 侧屏（会中） | **笔记本侧栏 web**（主形态，真原型） | 真 | 极简输入框 + <15s 返回卡片；演示者当场操作 |
| 客户可见屏幕标注 | 静态 split-screen 图 | Mock | 用一张标注图说明笔记本侧栏在客户视角下的位置 / 遮挡 / 分屏，**不扮演客户方** |
| 24h Memo | Google Doc | 预生成 | ≤3 页，Fellow 署名，邮件正文亲笔风 |
| Thesis Memory 面板 | 静态 web / slide | Mock | 三栏：Dominant Logic / 已引用锚点 / 未解矛盾 |

---

### 3.9 风险 / 翻车点

| 风险 | 现场表现 | 兜底 |
|---|---|---|
| Real-Time Recall 卡顿 >15s | 观众看着转圈，C1 立崩 | 本地预热缓存；极端情况手动切"已缓存答案" |
| CGS-voiced 金句像 ChatGPT | **VP 教授皱眉，C1+C3 双崩** | 所有金句基于公开材料里 Gregg 的口吻反复改写；开场主动声明"请 VP 纠错"，把"挑刺"框架成 demo 的一部分 |
| Strategy Wheel / Inertia 标签用错 | **VP 当场打回，方法论硬伤** | 所有标签交叉对照公开材料 ≥2 次；team 内部互审 |
| VP / Fellow 说"这不就是 X 客户的案子吗" | 代表性场景穿帮，专业度掉档 | 行业中性策略——fixtures 不绑定具体 sector |
| 观众问"真 live 还是演 / 数据真假" | 不回答好反而降档 | 诚实披露作弊清单（§3.5.2 / §3.5.3）+ 主动声明无审阅渠道——承认外行反而加分 |
| 没渠道求审，金句被 Fellow 当场说"我不会这么讲" | 方法论还原偏差暴露 | 开场已声明"请纠错"，把这种反馈框架成"作品交卷请指教"而非"被打脸"；当场感谢 + 记录，不强辩 |
| 叙述太干、观众代入不进去 | 无扮演下的主要替代风险——"这只是一个 UI 演示" | 演示者每个 surface 前先问"VP 您上周如果开会遇到 X 会怎么做"——把 VP / Fellow 真实记忆调起来代替扮演 |
| 追问深挖时 precedent 纵深不够 | 首击返回漂亮，追问时系统明显编造细节，**直接毁 hero moment** | Hero precedent 事前做一次纵深审阅：至少要能稳住 3 层追问；公开材料找不到的细节用方法论合理推演填，但演示者要在那一刻**轻声标注**"这部分是我们基于方法论的合理推演" |
| Q&A 被 VP 提刁钻方法论问题 | 答不上当场失分；方法论门槛暴露 | Demo 前预演 ≥10 个 VP 可能问的问题，不知道就答"我们没找到公开答案，想听您讲" |
| 同班其他队伍 / 同学带偏 Q&A | 时间被消耗，VP 听不到核心 | 提前与教授敲定 Q&A 优先级（VP / Fellow 优先），同学问题统一引导到课后 |
| Demo 环境断网 | 全盘崩 | 录屏 backup，现场失败立切 |

---

### 3.10 仍待团队内部决定

1. **演示者身份**：4 个学生中由谁主讲（1 主 + 1 备 推荐）；操作 vs 叙述要不要分人
2. **调用 VP / Fellow 真实记忆**的提问要不要事先排好？（§3.9 兜底手段——演示者在每个 surface 前问"VP 您上周如果遇到 X 会怎么处理"）

---

## 4. Knowledge Search

> ✅ **已并入 §3.6.2 会中侧屏演示**。1TB IP 全景数字 / CGS 概念高亮 / 结果溯源作为 Real-Time Recall 的组成部分出现，demo 中**不单独走 surface**。

本节保留原功能清单作为**开发参考**（实际实现时作为 §3 侧屏 UI 的底层能力）：

### 4.1 目标（开发参考）

Fellow / Gregg 用自然语言检索全公司 1TB IP，语义召回 + CGS 概念识别 + 一键跳回 Drive 原文。让 VP / Fellow 视觉上相信 §1 Collective Brain 不是 "GPT 壳"，而是真有 15 年 1TB 专有语料支撑。

### 4.2 底层能力清单（作为 §3.6.2 侧屏的组件）

| ID | 功能 | 说明 |
|---|---|---|
| F1 | 自然语言搜索 | 语义召回而非关键词匹配；支持"类似 Globex 汇报线问题的案例有哪些"这类提问 |
| F2 | 结果溯源 | 每条结果展示来源（文件名 + 位置 + 作者 + 年份），一键跳回 Drive 原文 |
| F3 | 1TB IP 全景 | 侧屏顶部常驻展示：索引文件总数 / 年份跨度 / 覆盖客户项目数 / 方法论框架数 |
| F4 | CGS 概念高亮 | 结果中自动识别并高亮 Strategy Wheel 7 维 / Dominant Logic / Structural Inertia 等 CGS 官方实体 |

**cross-cutting**：每条搜索结果必须可溯源（对齐 §1 Collective Brain 溯源硬要求 + §3.6.0.2 CGS 证据链）。

### 4.3 数据

- mock 的 1TB 全景统计数字（合成但合理：文件数 / 年份 / 客户项目 / 框架数）
- 10–15 条手造 precedent，与 §3 hero precedent 同源，确保跨 surface 一致
- Strategy Wheel / Inertia 标签 100% 对照 CGS 官方定义

### 4.4 决策记录

1. ✅ **命名**：**Knowledge Search**
2. ✅ **Demo 呈现方式**：嵌入 §3.6.2 会中侧屏，不独立 surface
3. ⏳ 是否支持"当前客户 context 过滤"（只搜 Acme 项目 vs 全库）——真实产品决策，不影响 demo
4. ⏳ 是否展示 §1 原 PRD 里的分层访问控制（internal / client-safe / public-safe）——demo 暂不展示

---

## 5. Dashboard（Demo PRD）

15 min demo 的新 surface。

### 5.1 目标

**Demo 入口 surface**（15 min demo 的起点）。打开任一客户 / 潜在客户，一屏聚合 Drive + Gmail + Calendar + CRM + 外部数据 + AI 提醒。demo 要兑付两件事：

1. **30 秒内 load 完整 context**——演示者**当场看表报时**，把这个 claim 显式可见
2. **点时间轴事件自然分发到下游 surface**（§2 / §3 / §6）——观众感知为"一个工作流入口"，而非"分立的多个功能"

### 5.2 术语约束（硬需求）

CGS 不响应 RFP、无 sales 岗位（CGS_Slides §A.4 / §A.10）。UI 上必须：

- ❌ Lead / Proposal / Deal / Pipeline → ✅ Signal / Pre-RFP / Retainer / Renewal / Relationship Stage
- ❌ Deal likely to drop → ✅ Retainer Renewal Risk / Prospect Cooling
- ❌ Customer → ✅ Client / Prospect

### 5.3 Demo 必展示

| ID | 功能 | 说明 |
|---|---|---|
| F1 | 客户身份 | 名字 / 行业 / 上次与下次互动 / Retainer 状态 |
| F2 | Relationship Stage | Signal → Pre-RFP → Retainer → Active Delivery → Renewal，当前位置高亮 |
| F3 | 互动时间轴 | 项目 / 会议 / 邮件 / Pre-RFP 事件混合流，每条带 Strategy Wheel + Inertia tag，可下钻原文件 |
| F4 | AI Alerts | 3 条 CGS 术语化提醒（续签风险 / 未回高管邮件 / Pre-RFP 信号），每条可溯源 |
| F5 | 外部信号 | 该客户公司 earnings / 高管发言 / 行业新闻，AI 按相关性排序 |
| F6 | **时间轴事件跳转（demo 分发器）** | 点击时间轴上任一事件 → 进入对应下游 surface：诊断事件 → §2 Diagnostic；会议事件 → §3 Meeting Recall；post-engagement 事件 → §6 Continuity。**demo 入口与叙事串联器**，不是独立按钮区；数据源 §7 Data Hub |

**cross-cutting**：F3 / F4 / F5 每条输出必须可溯源（对齐 §1 Collective Brain 溯源硬要求）。

### 5.4 数据

复用 §2 / §3 虚构客户 **Acme Industrial** 的 fixture，扩展 6 个月互动记录 + 3-5 条真实公开新闻（行业中性，避免穿帮）。Strategy Wheel / Inertia 标签 100% 对照 CGS 官方定义。

### 5.5 Demo 动作流（~1.5 min 建议）

| 时间 | 动作 | 功能 |
|------|------|------|
| 0:00 – 0:15 | 开场披露（虚构客户声明） + 打开 Dashboard | — |
| 0:15 – 0:45 | **演示者看表报时**："现在零秒…Acme context 加载完成，28 秒"——屏幕聚合显示 F1–F5 | F1–F5 |
| 0:45 – 1:15 | 读一条 AI Alert（F4，例：Retainer Renewal Risk）→ 带出下一步叙事 | F4 |
| 1:15 – 1:30 | 点时间轴上 Q3 earnings call 事件 → 跳转 §2 Diagnostic 入口 | **F6** |

**兑付的 demo claim**："30 秒 load 完整 context"（§3 未涵盖的层级命题），同时自然串联下游 surface——观众不会感到"下一个功能又开始了"，而是"同一个工作流在继续"。

---

## 6. Continuity Agent — Post-Engagement Advisory（Demo PRD）

15 min demo 的 **client-facing** surface。命名 **Continuity Agent**（避开 §3.6.3 Compounding Loop 命名冲突）。

### 6.1 目标

项目结束后，系统代表 CGS 对已服务 Client / Prospect 做结构化、轻量、非营销式的持续 check-in，把 episodic consulting 转成 continuous advisory value。Demo 要证明精品咨询不必 hire account manager，也能保持 always-on 关系密度。

**AI voice 自主成稿 vs §3 Fellow 翻译——区分逻辑**（demo 防线，VP 必问）：

§3 Meeting Recall 的会中侧屏，Real-Time Recall 返回的金句**必须经 Fellow 过手改写**再对客户说（Inverted Pyramid 要求 + 会中高风险实时对话）。§6 Continuity 的 check-in email **AI 直接成稿**，经 Tone Guard 过一道后发出，不强制 Fellow 字句改写。

**区分依据**：

| 维度 | §3 Meeting Recall | §6 Continuity |
|---|---|---|
| 时间 | 会中**秒级**实时 | **季度级**长周期 |
| 风险 | 说错一句现场翻车 | 三段式模板化内容，风险低 |
| voice 形态 | 原稿刻意机械，给 Fellow 留改写空间 | AI voice 打磨成 "CGS 口径的 advisory 腔"，直接可用 |

demo 中同时出现两种 AI 生成物（§3 的 Fellow-改-原稿 / §6 的 AI-直出-成品）。VP 追问"为什么 §6 能直发 §3 要改"时，演示者按上表区分回答。

### 6.2 术语约束（硬需求）

CGS 不响应 RFP、无 sales 岗位（CGS_Slides §A.4 / §A.10）：

- ❌ Lead / Proposal / Deal / Pipeline → ✅ Signal / Pre-RFP / Retainer / Renewal
- ❌ Deal likely to drop → ✅ Retainer Renewal Risk / Prospect Cooling
- ❌ Customer → ✅ Client / Prospect
- ❌ Sales follow-up → ✅ Advisory Check-in

额外：
- 不得包装成 email marketing automation
- 邮件不得呈现 sales push、不得直接给 full solution
- 分析优先使用 CGS framework（Strategy Wheel 7 维 / Inertia 两分法）

### 6.3 Demo 必展示

| ID | 功能 | 说明 |
|---|---|---|
| E1 | Close-Out Baseline | **复用 §2 Diagnostic 输出**（Strategy Wheel 评分 + Inertia 类型 + 干预）+ 补 deliverables / stakeholders，生成客户 baseline |
| E2 | Check-In Email 生成 | 按三段格式生成：**What We're Seeing / Quick Pulse Check / Preliminary Read**，严禁 sales push 措辞 |
| E3 | **Email Tone Guard** | 每封 email 做**方法论口径一致性 + 非 sales push** 双重打分：(1) Strategy Wheel / Inertia 标签使用正确，无 Frankenstein framework；(2) 无 sales-speak 黑名单词汇（Lead / Proposal / Deal / Pipeline 等，对齐 §6.2 约束）；(3) 三段格式合规（What We're Seeing / Quick Pulse Check / Preliminary Read）。**三档分流**：low-risk 通过 / borderline 标记交 Fellow 审 / high-risk 退回重生成。作为 **review signal**，不作为自动发送 gate。**不依赖 Gregg voice 样本**——学生团队有渠道验证（公开材料 + §6.2 约束列表） |
| E4 | Reply Signal Extractor | 客户回复 → 抽取 Strategy Wheel 维度变化 + Inertia shift + 外部环境耦合 |
| E5 | **Internal Escalation Signal** | Friction 累积 → 向 Fellow / Gregg 内部发信号（**不直接推给客户**），附证据链 + **预设 engagement 菜单**供 Fellow 人工选择；系统不自动生成 engagement。**Friction signal 三分类（全部挂 CGS 原生概念）**：(1) **Dominant Logic Friction** — 客户回复里出现与 E1 baseline Strategy Wheel 不一致的思维模式（挂 Dominant Logic Inertia）；(2) **Structural Friction** — 客户回复透露组织结构变化 / 汇报线调整 / 高管变动，打破 baseline 的 structural 假设（挂 Structural Inertia）；(3) **External Coupling Shift** — 客户所在行业 / 监管 / 竞争出现 baseline 未覆盖的变化，且客户回复里显式提到（挂 Strategy Wheel External Sensing 维度）。**触发规则**：E4 抽取到任一类 friction 且与 E1 baseline 形成差分 → E5 上报信号 + 证据链；engagement 由 Fellow 在预设菜单中人工选择 |

**触发规则（light-touch cadence）**：前 90 天 monthly，之后 8–12 周一次；仅在 friction signal / renewal window / 外部重大变化时触发 event-based check-in。不机械加频。

**Hero moments（demo 真正聚焦的两组）**：
- E2 + E3：现场生成 check-in email + Tone Guard 三档当场打分
- E4 + E5：模拟客户回复 → 向 Fellow 发 internal escalation，Fellow 从预设菜单选候选 engagement（**不**向客户发销售邮件）

**cross-cutting**：E1 / E2 / E4 / E5 所有分析必须显式使用 Strategy Wheel + Inertia 两分法；标签 100% 对照 CGS 官方。

### 6.4 数据

复用 §2 / §3 / §5 虚构客户 **Acme Industrial** fixture。Demo 用 mock inbox（不真发邮件）。预生成 3 封 check-in email + 2 份客户回复 fixture。

**E4 / E5 fixture 触发要求**：2 份客户回复中**至少 1 份必须触发 3 类 friction 中至少 1 类**（Dominant Logic / Structural / External Coupling，见 §6.3 E5）。fixture 文件里**显式标注触发的 friction 类型 + baseline 对比点**，方便 demo 时 escalation 卡片上直接显示（例："Structural Friction detected — baseline: Q1 CDO reports to CEO. Client reply: '...new COO now oversees Digital...'"）。

**Tone Guard 语料**（三组，全部来自公开材料 + §6.2 约束列表，不依赖 Gregg 本人 voice 样本）：

1. **方法论术语库**——Strategy Wheel 7 维名 / Inertia 两分法 / First Mile / Connecting World 等官方标签（100% 对照公开材料）
2. **sales-speak 黑名单**——Lead / Proposal / Deal / Pipeline / Customer / follow-up 等 §6.2 已列出的受禁词
3. **三段格式校验模板**——What We're Seeing / Quick Pulse Check / Preliminary Read 结构匹配规则

### 6.5 决策记录

1. ✅ **Tone Guard 阈值**：基于**方法论口径一致性 + 非 sales push** 双重校验（详见 §6.3 E3 / §6.4 语料），**不再依赖 Gregg voice 样本**。三档分流：low-risk 通过 / borderline 交 Fellow 审 / high-risk 退回重生成。作为 review signal，不作为自动发送 gate
2. ✅ **默认 cadence**：Light-touch——前 90 天 monthly，之后 8–12 周一次；仅在 friction signal / renewal window / 外部重大变化时触发 event-based check-in，不机械加频
3. ✅ **Escalation 候选 engagement**：Fellow 从预设菜单人工选择，系统不自动生成
4. ✅ **命名**：**Continuity Agent**

---

## 7. Data Hub（Demo PRD）

项目启动 / 客户切换前的**原始数据准备层**，下游喂 §1 Collective Brain / §2 Diagnostic / §3 Meeting Recall / §5 Dashboard。

### 7.1 目标

帮 Fellow 给原始数据（CRM 导出 / Excel 客户名单 / 行业报告 / 文档库）打基础属性标签 + 服务线标签，并一键分发到下游 surface。一个 hub，所有下游都用它。

### 7.2 Demo 必展示

#### A. Structure

| ID | 功能 | 说明 |
|---|---|---|
| F1 | 客户 / Prospect 打标 | 按通用属性：industry / size / region |
| F2 | 项目打标 | CGS 4 大服务线：Strategic Transformation / IT Transformation / Enterprise Innovation / Inertia Removal |
| F3 | 数据集分类入库 | |

#### B. Distribute

| ID | 功能 |
|---|---|
| F4 | 保存结构化后的数据集 |
| F5 | Push to §5 Dashboard |
| F6 | Push to §1 Collective Brain（供 §4 Knowledge Search 检索） |
| F7 | Push to §2 Diagnostic Agent |
| F8 | Push to §3 Meeting Recall |

**不包含**：
- ❌ 数据预览 / 搜索 / 筛选 / 选列——Google Sheets 原生已提供
- ❌ 数据清洗（去重 / 格式标准化 / 处理缺失值 / 字段重命名）——明确排除
- ❌ Push to Proposal Generator——CGS 不响应 RFP，无 proposal 环节（Slides §A.10）

### 7.3 数据

Demo fixture：一份 mock 的 "CRM 导出客户 CSV"，包含 **Acme Industrial** 条目 + industry / size / region 字段。打标后 push 到 §5 Dashboard 和 §1 Collective Brain，与 §2 / §3 fixture 打通。

### 7.4 决策记录

1. ✅ 命名：**Data Hub**
2. ✅ 客户打标维度：**只用通用标签**（industry / size / region）；CGS 方法论维度不纳入本 hub
3. ✅ CGS 方法论标签在 demo 预定义方式：**手工 mock**
4. ✅ **Demo 时长与位置**（已决议）：15 min demo 结构见顶部"Demo 总体结构"。§7 放在**最后 ~1 min**，作为收尾"数据底座"揭示——hero 演完后告诉观众"前面所有 surface 吃的数据都来自这里"，加深"系统性"印象，避免 §7 单独演成通用 data tool。§4 并入 §3.6.2 侧屏，不独立 surface

### 7.5 Demo 动作流（~1 min 建议）

| 时间 | 动作 | 功能 |
|------|------|------|
| 0:00 – 0:20 | 叙述："刚才所有 surface 吃的 Acme 数据从这里进来" → 打开 Data Hub | — |
| 0:20 – 0:40 | 展示 mock CRM CSV + F1 / F2 打标结果（industry / size / region + CGS 4 大服务线标签） | F1 F2 |
| 0:40 – 1:00 | **分发动画**：一键 push → 下游 §5 Dashboard / §1 Collective Brain / §2 / §3 指示灯依次亮起 → 收尾 | F5–F8 |

**定位**：**数据流收尾**，不抢 hero 戏份。不演数据清洗 / 预览（Google Sheets 已原生提供）。

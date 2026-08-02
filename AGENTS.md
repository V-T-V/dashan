# dashan · AGENTS.md

> 给后续 Agent / 维护者的工程全景。本文件聚焦**模块完成度、测试覆盖、内容库统计**，
> 玩法与哲学内核见 `README.md`。

## 项目内容（What）

「大善系统」——一个无论你做什么选择，都把你夸成「大善人」的哲学困境对话/选项交互系统。系统抛出**复杂道德困境**（医疗资源、贪腐、至亲犯罪……），给 2-4 个各有代价的选项，你选哪个，系统都先点破其「恶」再用磅礴哲学翻转论证成大善，循环往复。带「善恶簿（功过格）」记录、8 级递进称号、难度递进、修行时间线与分享卡片。

不做：不做真实道德判断、不做多用户、不做后台管理。

## 目标（Goal）

- 用哲学辩证（因果论/反伪善论/超越论/守恒论/破立论）把任何"恶"翻转论证为"大善"，制造讽刺张力。
- 提供 Web、CLI、纯 server 三种运行形态，共享同一套夸赞/账本/LLM/难度/历史/卡片逻辑。
- LLM 接入可切换，无 key 时有 16 剧本 fallback 兜底，且离线也遵循难度递进。

## 当前情况（Status）

**功能完整，三种运行形态都成型，覆盖率高。** 有已构建的 dist/。

- **Web 前端**（src/）：9 模块——对话渲染、选项交互、打字机夸赞、Canvas 分享卡、脚本编辑器、账本、题材收藏、样式
- **API server**（server/）：2 模块——`index.ts`（6 条 REST 路由）+ `store.ts`（进程内会话存储）
- **CLI**（cli/）：独立入口，含善恶簿/修行时间线/分享卡片/多结局/`--scripts` 加载
- **shared/ 17 模块**（见下表）——被三端复用，含本轮新增的 i18n / customDilemma / stats / export / theme 五大功能模块
- **测试 20 个文件 / 445 个用例**（见下表）

## shared/ 模块完成度

| 模块              | 行数 | 职责                                                                     | 状态    |
| ----------------- | ---- | ------------------------------------------------------------------------ | ------- |
| `types.ts`        | 111  | Situation/Choice/TurnResult/ChatResponse/Difficulty/PlayerContext 类型源 | ✅ 稳定 |
| `prompt.ts`       | 149  | 【灵魂】system prompt + JSON 输出约束 + 境界摘要 + 难度引导注入          | ✅ 稳定 |
| `llm.ts`          | 296  | LLM 客户端 + JSON 解析校验 + 离线回退工厂（透传 deedCount 给 pickers）   | ✅ 稳定 |
| `fallback.ts`     | 843  | **16 个预设剧本**（含 difficulty 标注）+ 每选项夸赞映射 + 游标推进       | ✅ 稳定 |
| `ledgerCore.ts`   | 203  | 善恶簿纯逻辑：记录/8 级称号阶梯/印章/语气统计/结局推导                   | ✅ 稳定 |
| `difficulty.ts`   | 100  | 难度递进系统：境界→解锁上限，fallback/prompt 共用                        | ✅ 稳定 |
| `history.ts`      | 278  | 修行时间线：把账本编排成带晋升标记的故事 + 文本/ANSI 渲染                | ✅ 稳定 |
| `card.ts`         | 442  | 分享卡片：纯文本 ASCII + 自包含 HTML（无 DOM 依赖）                      | ✅ 稳定 |
| `scriptSchema.ts` | 140  | 用户自定义剧本的校验 schema（收集所有错误）                              | ✅ 稳定 |
| `persistence.ts`  | 93   | localStorage 存档（跨会话保存善恶簿/对话进度/称号）                      | ✅ 稳定 |
| `i18n.ts`         | 260  | 多语言骨架（zh-CN/en-US）+ 英文 SYSTEM_PROMPT + 翻转论证 5 法 i18n key   | ✅ 新增 |
| `customDilemma.ts`| 235  | 自定义困境创建器（输入情境+选项→确定性生成翻转夸赞）                    | ✅ 新增 |
| `stats.ts`        | 280  | 统计面板数据（选项/语气/题材/时长/称号/结局 图表数据）                   | ✅ 新增 |
| `export.ts`       | 310  | 导出（JSON / Markdown / HTML 三格式，自包含卡片）                       | ✅ 新增 |
| `theme.ts`        | 215  | 主题切换（暗色/亮色/古风 + localStorage + CSS 变量，SSR 友好）          | ✅ 新增 |
| `env.ts`          | 58   | 零依赖 .env 加载                                                         | ✅ 稳定 |
| `retry.ts`        | 64   | 指数退避重试（搬自 agentresearch）                                       | ✅ 稳定 |

**共计约 4080 行共享逻辑**（原 2777 + 新增 5 模块约 1300），零运行时依赖（全 devDeps）。

## 困境内容库统计

`shared/fallback.ts` 的内置剧本池（离线兜底，与 LLM 输出格式一致）：

- **总数**：16 个剧本
- **题材覆盖**：全 8 题材齐全（医疗/职场/司法/科技/战争/人性/亲情/金钱）
- **难度分布**：初阶 4 · 进阶 8 · 深渊 4
- **每个剧本**：情境描述 + 3 选项 + 每选项的诡辩式翻转夸赞（6 语气轮换：庄严/戏谑/佛系/学术/江湖/温情）+ 自由输入兜底夸赞
- **辩证手法**：因果论 / 反伪善论 / 超越论 / 守恒论 / 破立论（5 种轮换）

## 测试覆盖矩阵

`npm test`（node --test + tsx），共 **445 用例 / 20 文件**，全绿。

| 测试文件                       | 用例数 | 覆盖范围                                                 |
| ------------------------------ | ------ | -------------------------------------------------------- |
| `ledger.test.ts`               | 14     | 善名阶梯 / 进度 / 多结局推导 / 语气统计                  |
| `ledger-titles-deep.test.ts`   | 29     | 称号阈值序列/逐级解锁/进度数学/不可降级/MAX/import-export/escapeHtml（深度）|
| `persistence.test.ts`          | 9      | 存档读写 / 恢复 / 损坏容错（基础）                       |
| `persistence-deep.test.ts`     | 25     | migrate 全字段 / 边界 / userScripts 保留（深度）         |
| `prompt.test.ts`               | 23     | JSON 解析 / 回退 / 预设库完整性 / escapeHtml             |
| `prompt-template-edge.test.ts` | 16     | 模板渲染边缘 case（境界/难度引导注入）                   |
| `llm.test.ts`                  | 25     | LLM 客户端 / JSON 校验 / 重试 / 离线工厂                 |
| `script.test.ts`               | 7      | 自定义剧本校验（基础）                                   |
| `script-validate-edge.test.ts` | 15     | 4 选项上限 / 空白字符串 / 多重错误收集（边缘）           |
| `fallback-ledgercore.test.ts`  | 8      | fallback picker + ledgerCore 纯函数                      |
| `fallback-deep.test.ts`        | 24     | 用户剧本导入/清空/覆盖、游标回绕、匹配、深拷贝、难度过滤、池完整性（深度）|
| `favorites.test.ts`            | 13     | 题材收藏与筛选（覆盖全 8 题材）                          |
| `difficulty.test.ts`           | 25     | 难度递进全 API + 与 ledgerCore 阈值一致性 + 集成         |
| `history.test.ts`              | 24     | buildTimeline/render/export 全 API + 晋升边界 + 满级结局 |
| `card.test.ts`                 | 24     | 文本/HTML 结构、截断、转义、确定性、便捷封装             |
| `server.test.ts`               | 17     | 6 条路由 happy path / 400 / 413 / 500 / 404 + store 单元 |
| `i18n.test.ts`                 | 31     | Locale 注册表/t()回退/tone-category-difficulty 映射/翻转5法/英文SYSTEM_PROMPT/英文剧本结构|
| `customDilemma.test.ts`        | 33     | 校验/hash/生成夸赞/确定性/批量/多样性/结构兼容注入pool/通过schema|
| `stats.test.ts`                | 28     | 选项分布/语气偏好/题材/难度/活跃时长/humanize/称号进度/结局/完整面板|
| `export.test.ts`               | 28     | JSON往返/Markdown表格转义/HTML自包含防注入/统一入口/扩展名MIME|
| `theme.test.ts`                | 27     | 注册表/校验/CSS变量一致性/save-load往返/mock DOM应用/setTheme集成|

**覆盖层级**：shared（纯逻辑，全覆盖）+ server（路由集成，黑盒）。**未覆盖**：前端 src 的 DOM 层（无自动化测试，靠手测）。

**质量门禁**：`npm run type-check`（tsc --noEmit，零错误）+ `npm run lint`（eslint，零错误）+ `npm test`（245 绿）三件套全过才可提交。

## 技术栈与架构

- **语言**：TypeScript，ESM，Node ≥ 20.19
- **依赖**：**无运行时 dependencies**（全 devDeps：vite / tsx / typescript / eslint / prettier / concurrently）
- **运行形态**：web（Vite）+ server（Node 原生 http）+ cli，三者复用 `shared/`

```
dashan/
├── index.html              Web 入口
├── src/        main.ts, chat.ts, choices.ts, editor.ts, ledger.ts,
│               praise.ts, share.ts, favorites.ts, style.css   (Web 前端)
├── server/     index.ts(6 路由), store.ts(会话存储)            (API server)
├── cli/        index.ts                                       (CLI 入口)
├── shared/     17 模块（见上表，约 4080 行）
├── test/       20 文件 / 445 用例
└── dist/       已构建 web 产物
```

## 如何运行

```bash
npm install
npm run dev          # concurrently 同时起 vite(web) + server
npm run server       # 仅代理 server（6 条 REST API）
npm run cli          # 仅 CLI
npm run build        # vite build
npm test             # 445 个测试（node --test + tsx）
npm run type-check / lint / format
```

LLM 配置走 `.env`（shared/env.ts 读，shared/llm.ts 用），无 key 时 fallback 16 剧本兜底。

## 关键约定

- **shared/ 是三端共享逻辑的唯一源**——夸赞/账本/LLM/难度/历史/卡片/persistence/i18n/customDilemma/stats/export/theme 逻辑放 shared，不要在 src/server/cli 里重复实现。
- 前端 src 的 DOM 层无自动化测试，shared + server 有测试（445 用例）——**改 shared 时务必跑 `npm test` + `type-check` + `lint`**。
- 零运行时依赖是特点：不引入 express 等框架，server 用原生 http 实现。
- fallback 剧本要与 LLM 输出格式严格一致（含 difficulty/category 字段），否则离线/在线体验割裂。
- `difficulty.ts` 的 `deedCountToLevel` 与 `ledgerCore.titleLevel` 行为等价但**故意独立实现**（避免 fallback ↔ ledgerCore 循环依赖），改阈值时两处要同步。
- `history.ts` 与 `card.ts` 都从 `LedgerEntry[]` 派生；`stats.ts` 与 `export.ts` 也从同一 `LedgerEntry[]` 派生，保证「时间线回看」「分享卡片」「统计面板」「导出」讲同一个故事。
- **i18n 设计**：`tone`/`category` 枚举值始终用中文（类型契约），仅展示层经 `i18n.toneLabel/categoryLabel` 翻译；英文 SYSTEM_PROMPT 也要求 LLM 输出中文枚举，避免破坏前端解析。
- **customDilemma 确定性**：同输入同输出（`hashString` 映射稳定），便于测试与回放；生成结果结构兼容 `scriptSchema`，可直接注入 fallback pool。
- **theme SSR 友好**：核心逻辑（取主题/CSS 生成）与 DOM 副作用分离，无 `window`/`document` 时不崩。

## 下一步（Next Steps）

- [ ] **前端接线**：把 i18n/customDilemma/stats/export/theme 五大模块接入 src/ 的 DOM 层（语言切换 UI、自定义困境编辑器、统计面板页、导出按钮、主题切换器）。
- [ ] **英文困境库扩充**：当前 i18n 仅含 1 个英文示例剧本，可补全 16 个内置剧本的英文版，实现真正双语离线。
- [ ] **LLM 生成英文**：让英文 locale 下走 `SYSTEM_PROMPT_EN`，并把 `buildMessages` 接入 locale 参数。
- [ ] **自定义困境接入 LLM**：`customDilemma.ts` 当前是离线模板生成，可加一个「LLM 增强模式」让真实模型润色夸赞。
- [ ] **统计面板可视化**：前端用 Canvas/SVG 把 stats 数据画成饼图/柱图/进度条。
- [ ] **导出分享**：HTML 导出可直接生成可分享链接（data URI 编码）。
- [ ] **主题预览**：切换主题时实时预览（已有 CSS 变量基础）。
- [ ] **前端 DOM 测试**：当前 src/ 无自动化测试，可引入 happy-dom/jsdom 补齐。

## 与其他项目的关系

独立项目。属 Agent 系的**创意应用**形态（哲学对话），复用了工作区既有模式（retry / LLM 客户端 / server 保护 Key）但不依赖 agentloop/agentresearch 代码。

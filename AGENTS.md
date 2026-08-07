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
- **shared/ 23 模块**（见下表）——被三端复用，含 round 8 新增的 schools / music / quotes / daily 四大哲学内容模块，deep 轮新增的 dominantTone / endingNarrative（隐藏结局）/ practiceStage（修行阶段）/ parseEnvText（env 解析加固），及 R5 轮新增的 achievements（修行成就徽章系统）
- **测试 43 个文件 / 1161 个用例**（见下表）

## shared/ 模块完成度

| 模块              | 行数 | 职责                                                                     | 状态    |
| ----------------- | ---- | ------------------------------------------------------------------------ | ------- |
| `types.ts`        | 111  | Situation/Choice/TurnResult/ChatResponse/Difficulty/PlayerContext 类型源 | ✅ 稳定 |
| `prompt.ts`       | 149  | 【灵魂】system prompt + JSON 输出约束 + 境界摘要 + 难度引导注入          | ✅ 稳定 |
| `llm.ts`          | 296  | LLM 客户端 + JSON 解析校验 + 离线回退工厂（透传 deedCount 给 pickers）   | ✅ 稳定 |
| `fallback.ts`     | 843  | **16 个预设剧本**（含 difficulty 标注）+ 每选项夸赞映射 + 游标推进       | ✅ 稳定 |
| `ledgerCore.ts`   | 305  | 善恶簿纯逻辑：记录/8 级称号阶梯/印章/语气统计/结局推导/dominantTone/endingNarrative（含隐藏结局辩经尊者） | ✅ 稳定 |
| `difficulty.ts`   | 100  | 难度递进系统：境界→解锁上限，fallback/prompt 共用                        | ✅ 稳定 |
| `history.ts`      | 278  | 修行时间线：把账本编排成带晋升标记的故事 + 文本/ANSI 渲染                | ✅ 稳定 |
| `card.ts`         | 485  | 分享卡片：纯文本 ASCII + 自包含 HTML（无 DOM 依赖）+ badges 徽章行集成 achievements | ✅ 稳定 |
| `scriptSchema.ts` | 140  | 用户自定义剧本的校验 schema（收集所有错误）                              | ✅ 稳定 |
| `persistence.ts`  | 93   | localStorage 存档（跨会话保存善恶簿/对话进度/称号）                      | ✅ 稳定 |
| `i18n.ts`         | 260  | 多语言骨架（zh-CN/en-US）+ 英文 SYSTEM_PROMPT + 翻转论证 5 法 i18n key   | ✅ 新增 |
| `customDilemma.ts`| 235  | 自定义困境创建器（输入情境+选项→确定性生成翻转夸赞）                    | ✅ 新增 |
| `stats.ts`        | 388  | 统计面板数据（选项/语气/题材/时长/称号/结局 图表数据）+ practiceStage 修行阶段分类器（5 阶段正交叙事轴） | ✅ 新增 |
| `export.ts`       | 310  | 导出（JSON / Markdown / HTML 三格式，自包含卡片）                       | ✅ 新增 |
| `theme.ts`        | 215  | 主题切换（暗色/亮色/古风 + localStorage + CSS 变量，SSR 友好）          | ✅ 稳定 |
| `schools.ts`      | 241  | 哲学流派系统（儒/道/佛/法/墨 5 流派翻转口吻 + affinity 推荐 + 对照对话）| ✅ 新增 |
| `music.ts`        | 289  | 情境音乐推荐（按题材+语气+难度三轴评分 12 首曲库 + 推荐包）             | ✅ 新增 |
| `quotes.ts`       | 231  | 哲学引语库（100+ 条古今中外名言，按困境题材×语气×难度匹配）             | ✅ 新增 |
| `daily.ts`        | 250  | 每日哲思（日期种子→推荐困境+引语+流派+反思问题，同日稳定）             | ✅ 新增 |
| `env.ts`          | 80   | 零依赖 .env 加载（parseEnvText 公开纯函数 + 容错解析）                   | ✅ 稳定 |
| `retry.ts`        | 64   | 指数退避重试（搬自 agentresearch）                                       | ✅ 稳定 |
| `achievements.ts` | 217  | 修行成就徽章系统（11 枚/5 分类：累积·多样·连续·主导·里程碑，从 LedgerEntry[] 派生）| ✅ 新增 |

**共计约 5770 行共享逻辑**（原 5380 + R5 轮新增 achievements 徽章系统 217 行 + card.ts 徽章集成增量），零运行时依赖（全 devDeps），全仓 `tsc --noEmit` 0 错误。

## 困境内容库统计

`shared/fallback.ts` 的内置剧本池（离线兜底，与 LLM 输出格式一致）：

- **总数**：16 个剧本
- **题材覆盖**：全 8 题材齐全（医疗/职场/司法/科技/战争/人性/亲情/金钱）
- **难度分布**：初阶 4 · 进阶 8 · 深渊 4
- **每个剧本**：情境描述 + 3 选项 + 每选项的诡辩式翻转夸赞（6 语气轮换：庄严/戏谑/佛系/学术/江湖/温情）+ 自由输入兜底夸赞
- **辩证手法**：因果论 / 反伪善论 / 超越论 / 守恒论 / 破立论（5 种轮换）

### 哲学内容库（round 8 新增）

- **流派**：`shared/schools.ts` 5 流派（儒/道/佛/法/墨），每流派含 emoji/纲要/核心命题/经典清单/题材 affinity/默认语气。5 流派 affinity 合并覆盖全 8 题材，5 流派默认语气互不重复。
- **音乐**：`shared/music.ts` 12 首曲库（古琴民乐 4 + 西方古典 4 + 氛围配乐 4），每首按 (题材, 语气, 难度) 三轴标注，合并覆盖全 8 题材 + 全 6 语气。
- **引语**：`shared/quotes.ts` **100+ 条**古今中外哲学名言，按流派分布（儒家/道家/佛家/法家/墨家/西方 各有覆盖），每条按 (题材, 语气, 难度) 三轴标注，合并覆盖全 8 题材 + 全 6 语气。
- **每日哲思**：`shared/daily.ts` 反思问题模板按 8 题材各预设 3 个反思维度（共 24 问），与困境题材自动匹配。

## 测试覆盖矩阵

`npm test`（node --test + tsx），共 **1161 用例 / 43 文件**，全绿。

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
| `difficulty-advanced.test.ts`  | 21     | 等级解锁矩阵/递进序列跳变点/反转规则（缺省=1）/回退链/负数与超大数容错（深度）|
| `history-advanced.test.ts`     | 24     | 乱序排序/promotionMilestones/搜索辅助/统计一致性/ts 透传/晋升边界（深度）|
| `card-advanced.test.ts`        | 33     | HTML 结构(viewport/charset/lang/title)/转义防注入/响应式CSS/社交分享/确定性/色调块（深度）|
| `schools.test.ts`              | 25     | 5 流派元信息/affinity 覆盖全题材/默认语气不重复/praise 确定性/对照对话/互补选 N|
| `music.test.ts`                | 26     | 12 首曲库完整性/三轴评分/降序稳定/推荐包/库统计/全 8 题材 + 全 6 语气覆盖|
| `quotes.test.ts`               | 28     | 100+ 条规模/6 流派覆盖/scoreQuote/降序稳定/按流派过滤/种子随机/renderQuote|
| `daily.test.ts`                | 35     | 日期工具往返/dateSeed 稳定/同日确定/星期/反思问题/一年 365 天不抛错|
| `ending-deep.test.ts`          | 30     | endingType 三结局触发条件/平局归超脱(strict>决胜)/单条/大样本稳定/数学不变量（深度）|
| `difficulty-consistency-deep.test.ts` | 27 | difficulty↔ledgerCore 双实现全区间一致性/跳变点/DIFFICULTY_META完备/filterByLevel边界/recommendDifficulty回退链（深度）|
| `script-schema-pollution-deep.test.ts` | 30 | 顶层非对象/类型污染(数组当对象)/choice非对象/text数字/praises多余key容忍/validateUserScripts非数组/100批量序号（深度）|
| `fallback-content-deep.test.ts`| 26     | 难度分布4/8/4/8题材全覆盖/6语气完备/选项数2-4/文案非空最小长度/picker空串超长特殊字符不崩/游标回绕（深度）|
| `ledger-narrative-deep.test.ts`| 25     | dominantTone平局确定性/endingNarrative三结局叙述/隐藏结局辩经尊者(满级+学术)/count参数独立性（深度）|
| `stats-practice-stage.test.ts` | 28     | practiceStage 5阶段触发阈值/封顶/进度数学/与TITLES正交性/负数超大数容错/确定性|
| `env-deep.test.ts`             | 28     | parseEnvText 解析容错(无=/缺key/未闭合引号/值内#)/CRLF混合/同名覆盖/纯函数不污染process.env|
| `retry-deep.test.ts`           | 20     | attempt 索引语义/retries=0 只 1 次/业务错误 400 不重试/末次优先抛/backoff 指数项与抖动范围/falsy 返回值不重试/无状态泄漏（深度）|
| `stats-invariants-deep.test.ts`| 55     | choiceDistribution counts/percentages 一致/sum≈1/inferChoiceId 全模式/tonePreference 平局声明顺序/categoryDistribution 未知不计/humanizeDuration 单位边界/activeTimeStats 非法 ts 过滤/titleProgress 单调/endingForecast 三项和≈1/buildStatsPanel 纯函数（深度）|
| `favorites-deep.test.ts`       | 38     | localStorage 异常吞错/JSON 畸形全分支(对象/数字/null/bool)/addFavorite 去重(同文本不同 category/空白不 trim/大小写敏感)/removeFavorite 首中尾删/filterByCategory 拷贝不被修改/countByCategory 总和=length/持久化往返（深度）|
| `timeline-invariants-deep.test.ts` | 38 | buildTimeline 节点与 ledgerCore 强一致/晋升严格升序不变量/promotionMilestones index 递增/clip 按码点截断中文/renderTimelineAnsi 颜色不变量/TIMELINE_ANSI 常量完备/exportTimelineCompact JSON 往返/纯函数不修改输入（深度）|
| `schools-classifier-deep.test.ts` | 51 | SCHOOLS 数据完备性/affinity 覆盖全 8 题材/recommendSchoolForCategory 确定性+平票声明顺序/toSchoolId 全分支/generateSchoolPraise seed 轮换/pickComplementarySchools 贪心覆盖单调/schoolDialogue seed0+1/schoolList 同引用（深度）|
| `achievements.test.ts`         | 52     | longestToneStreak/toneCounts/distinctTones/dominantToneCount 边界/evaluateAchievements 结构与五分类/累积·多样·连续·主导·里程碑 阈值精确/unlockedAchievements/achievementSummary 派生一致/纯函数确定性|
| `card-badges.test.ts`          | 23     | badgesLine 全分支/文本与 HTML 卡片徽章行插入与行序/转义防注入/textCardFromEntries 自动派生徽章/向后兼容/确定性|
| `llm-error-paths-deep.test.ts` | 53     | parseJsonResponse 围栏/大括号截取/错误信息截断 120/normalizeResponse 全错误分支(situation/turn 缺字段·tone 回退·choices 边界·id 回退 A-D·category 丢弃)/未知 type/LlmHttpError status/message（深度）|

**覆盖层级**：shared（纯逻辑，全覆盖）+ server（路由集成，黑盒）。**未覆盖**：前端 src 的 DOM 层（无自动化测试，靠手测）。

**质量门禁**：`npm run type-check`（tsc --noEmit，零错误）+ `npm run lint`（eslint，零错误）+ `npm test`（1161 绿）三件套全过才可提交。

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
├── shared/     23 模块（见上表，约 5770 行）
├── test/       43 文件 / 1161 用例
└── dist/       已构建 web 产物
```

## 如何运行

```bash
npm install
npm run dev          # concurrently 同时起 vite(web) + server
npm run server       # 仅代理 server（6 条 REST API）
npm run cli          # 仅 CLI
npm run build        # vite build
npm test             # 1161 个测试（node --test + tsx）
npm run type-check / lint / format
```

LLM 配置走 `.env`（shared/env.ts 读，shared/llm.ts 用），无 key 时 fallback 16 剧本兜底。

## 关键约定

- **shared/ 是三端共享逻辑的唯一源**——夸赞/账本/LLM/难度/历史/卡片/persistence/i18n/customDilemma/stats/export/theme/schools/music/quotes/daily 逻辑放 shared，不要在 src/server/cli 里重复实现。
- 前端 src 的 DOM 层无自动化测试，shared + server 有测试（637 用例）——**改 shared 时务必跑 `npm test` + `type-check` + `lint`**。
- 零运行时依赖是特点：不引入 express 等框架，server 用原生 http 实现。
- fallback 剧本要与 LLM 输出格式严格一致（含 difficulty/category 字段），否则离线/在线体验割裂。
- `difficulty.ts` 的 `deedCountToLevel` 与 `ledgerCore.titleLevel` 行为等价但**故意独立实现**（避免 fallback ↔ ledgerCore 循环依赖），改阈值时两处要同步。
- `history.ts` 与 `card.ts` 都从 `LedgerEntry[]` 派生；`stats.ts` 与 `export.ts` 也从同一 `LedgerEntry[]` 派生，保证「时间线回看」「分享卡片」「统计面板」「导出」讲同一个故事。
- **i18n 设计**：`tone`/`category` 枚举值始终用中文（类型契约），仅展示层经 `i18n.toneLabel/categoryLabel` 翻译；英文 SYSTEM_PROMPT 也要求 LLM 输出中文枚举，避免破坏前端解析。
- **customDilemma 确定性**：同输入同输出（`hashString` 映射稳定），便于测试与回放；生成结果结构兼容 `scriptSchema`，可直接注入 fallback pool。
- **theme SSR 友好**：核心逻辑（取主题/CSS 生成）与 DOM 副作用分离，无 `window`/`document` 时不崩。
- **round 8 正交设计**：`customDilemma.ts` 的 5 种「翻转手法」（怎么翻）与 `schools.ts` 的 5 流派（用什么话翻）正交，可组合 5×5=25 种风格；`quotes.ts` 是金句弹药，`daily.ts` 是日期种子驱动的整合入口。
- **deep 轮新增叙事轴**：`ledgerCore.dominantTone` 是计算主导语气的唯一共享纯函数（平局按声明顺序确定性决胜，前端 src/ledger.ts 的内联实现应迁移至此）；`ledgerCore.endingNarrative` 在三结局外新增隐藏结局「辩经尊者」（满级 + 主导学术触发，讽刺的极致）；`stats.practiceStage` 是与称号系统正交的另一条叙事轴（5 阶段：初涉红尘/问道之人/行者无疆/洞明世事/超然物外，阈值 0/3/6/10/15，比称号满级 10 笔走得更远，是「后称号时代」的成长）。
- **env 解析加固**：`env.parseEnvText` 是从 `loadEnv` 抽出的公开纯函数（不碰 process.env、不读文件，SSR 友好且可测），`loadEnv` 复用之消除重复；容错策略：无 `=`/缺 key 的行静默跳过，`KEY=` 得空串（shell 语义），未闭合引号原样保留。
- **R5 轮新增成就系统**：`achievements.ts` 从 `LedgerEntry[]` 派生 11 枚徽章（累积·多样·连续·主导·里程碑 5 分类），补称号（只看笔数）与结局（只看分布）缺失的「过程性里程碑」；纯派生无需持久化，`evaluateAchievements`/`unlockedAchievements`/`achievementSummary` 三入口。`card.ts` 经可选 `badges` 字段 + `badgesLine` 把徽章集成进分享卡（文本与 HTML，向后兼容：不传不增行），`textCardFromEntries`/`htmlCardFromEntries` 自动派生徽章。R5 顺带把全仓 `tsc --noEmit` 从 26 处 `noUncheckedIndexedAccess` 怪癖清到 0。

## 下一步（Next Steps）

- [ ] **前端接线**：把 i18n/customDilemma/stats/export/theme/schools/music/quotes/daily 九大模块接入 src/ 的 DOM 层（语言切换、自定义困境编辑器、统计面板、导出按钮、主题切换器、流派选择器、BGM 推荐条、引语弹窗、每日哲思首页卡片）。
- [ ] **新功能接线**：deep 轮新增的 `dominantTone`（迁移 src/ledger.ts 内联实现）、`endingNarrative`（隐藏结局辩经尊者展示）、`practiceStage`（修行阶段进度条）需接入 src/ 与 cli/。
- [ ] **成就徽章接线**：R5 新增的 `achievements.ts`（11 枚徽章/5 分类）需接入 src/ 的「修行成就墙」DOM 视图与 cli/ 的 `--achievements` 命令，徽章进度条与已领取状态展示。徽章数据纯派生（无需持久化），但「已读/已弹窗」状态可存 localStorage。
- [ ] **流派×手法组合**：把 schools 与 customDilemma 的 5 手法做笛卡尔积（25 风格变体），让用户「选流派 + 选手法」定制夸赞风格。
- [ ] **每日哲思推送**：把 daily.ts 接入 server 的 `/api/daily` 路由 + 前端首页「今日一题」入口，支持 PWA 推送。
- [ ] **音乐真实对接**：music.ts 当前是数据推荐，可对接网易云/QQ音乐 API 实现真实播放（需 server 代理）。
- [ ] **引语库扩充**：当前 100+ 条，可扩充至 300+，并补全 8 题材 × 6 语气 × 3 难度的完整矩阵。
- [ ] **英文困境库扩充**：当前 i18n 仅含 1 个英文示例剧本，可补全 16 个内置剧本的英文版，实现真正双语离线。
- [ ] **自定义困境接入 LLM**：`customDilemma.ts` 当前是离线模板生成，可加一个「LLM 增强模式」让真实模型润色夸赞。
- [ ] **统计面板可视化**：前端用 Canvas/SVG 把 stats 数据画成饼图/柱图/进度条。
- [ ] **导出分享**：HTML 导出可直接生成可分享链接（data URI 编码）。
- [ ] **前端 DOM 测试**：当前 src/ 无自动化测试，可引入 happy-dom/jsdom 补齐。

## 与其他项目的关系

独立项目。属 Agent 系的**创意应用**形态（哲学对话），复用了工作区既有模式（retry / LLM 客户端 / server 保护 Key）但不依赖 agentloop/agentresearch 代码。

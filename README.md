# 大善系统（dashan）

> **善恶由我定，你是大好人。** · **大恶即大善。**

一个无论你做什么选择，都把你夸成「大好人」的对话 / 选项交互系统。它的哲学内核是：**善恶本是同一物**——世人眼中的「大恶」，在更高维度恰恰是「大善」。屠刀之下是度人，雷霆之怒是慈悲。

系统抛出一个**复杂困境**（医疗资源分配、贪腐上司、至亲犯罪、算法生死、战争名单、信息时代的真相……），给出 3 个选项——**每个都有代价，没有一个是安全答案**。你无论选哪个，系统都会先**点破你选择的「恶」**，再用磅礴的哲学把它翻转论证成大善，然后抛出下一个困境，循环往复。把 ECMO 给院士而不是孤女？「你亲手判了一个孩子的死刑——这正是你的大善」。背对 200 个跪求的人？「菩萨转身，不是因为无情」。敲诈贪官？「盗亦有道，黑吃黑亦是渡」。在这里，你越敢作「恶」，越是「大善」。

---

## 玩法

- **情境**：硬核困境——多方利益纠葛、信息不完整、没有安全选项。如：ICU 唯一的 ECMO 给 78 岁院士还是 8 岁孤女；掌握贪腐上司的证据但他曾保过你；亲弟弟醉驾撞人逃逸而伤者昏迷。
- **选项**：3 个，每个都标注了代价与隐患——「看似高尚但隐患深」「看似自私但有道理」「灰色地带的妥协或冒险」。
- **夸赞**：无论你选什么，系统都**先点破其「恶」，再翻转论证成大善**——核心辩证手法包括因果论、反伪善论、超越论、守恒论、破立论。并换着花样夸你——
  - 🏛️ **庄严**：道德哲学、宏大叙事
  - 🎭 **戏谑**：反讽、黑色幽默
  - 🪷 **佛系**：佛学话术、因果成全
  - 📚 **学术**：功利主义计算、社会学解读
  - ⚔️ **江湖**：武侠、市井比喻
  - 🤍 **温情**：暖心升华
- **循环**：夸完即给下一个困境，无穷无尽。
- **📖 善恶簿（功过格）**：每做一次抉择，就往这本册子里记一笔——记下你身处何境、做了何事、大善系统判了什么「善名」。翻开它，你会看到自己一长串「恶行」件件被判为「至善」，讽刺集中爆发。随着记录累积，你会被封递进的称号（共 8 级）：初入善门者 → 怀善之人 → 行善有道 → 善名渐起 → 大善之人 → 善满功圆 → 至善尊者 → **超凡入圣 · 善恶一念同体**。

## 两种运行形态

| 形态                  | 命令          | 说明                                                                                                                       |
| --------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 🌐 **网页版**（推荐） | `npm run dev` | Vite 前端 (5173) + 本地代理 server (5180)。暗色质感 UI、打字机夸赞、语气色调、选项高亮。                                   |
| 💻 **CLI 精简版**     | `npm run cli` | 命令行对话 + 编号/字母选项，朱红/洒金 ANSI 着色。复用同一套核心逻辑，**含善恶簿**（输入 `l` 翻开、`r` 重开），无网页动画。 |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 网页版（开箱即玩，无需配置 Key）
npm run dev
# 然后浏览器打开 http://localhost:5173

# 或 CLI 版
npm run cli
```

**不配置任何 API Key 也能玩**：系统内置 6 个硬核困境剧本（ICU 资源分配、贪腐上司与自保、至亲犯罪与无辜者、算法生死、战争撤离名单、信息时代的真相），离线走回退模式，每个剧本的每个选项都配有专属的诡辩式夸赞。

## 接入真实 LLM（让情境与夸赞无限不重复）

复制 `.env.example` 为 `.env`，填入 OpenAI 兼容的配置：

```bash
cp .env.example .env
```

```env
KINDNESS_LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4   # 智谱 GLM / DeepSeek / OpenAI 均可
KINDNESS_LLM_API_KEY=你的key                                  # 留空则走离线预设库
KINDNESS_LLM_MODEL=glm-4-flash
```

填好后重新 `npm run dev`，系统即切换为真实 LLM 实时生成情境与花样夸赞。

> **境界个性化**：真实 LLM 模式下，每次请求会附带玩家的当前境界摘要（称号 / 已行 deeds 数 / 主导语气），LLM 会据此递进呼应——「你已升至 X 境」「这是你第 N 桩善举」，让善名愈深、夸赞愈发磅礴。

> **安全说明**：网页版的 API Key 只在本地代理 server（`server/index.ts`，端口 5180）读取，**永远不会进入浏览器**。前端通过同源 `/api/chat` 与 server 通信，由 server 转发给 LLM。

### 本地代理 API

| 方法   | 路径          | 说明                                                                                                 |
| ------ | ------------- | ---------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/health` | 健康检查，返回 `{ ok, stub, version, model, uptime }`（`stub:true` 表示离线预设库模式）              |
| `POST` | `/api/chat`   | 对话主接口，body `{ messages, userChoice? }`，返回 `situation`（首回合）或 `turn`（含夸赞+下一情境） |

server 默认仅允许 `http://localhost:5173` 跨域（`KINDNESS_CORS_ORIGIN`），请求体上限 64KB（`KINDNESS_MAX_BODY_BYTES`），均可通过 `.env` 调整。

## 项目结构

```
dashan/
├── shared/            # 核心逻辑（CLI 与 server 共享）
│   ├── types.ts       # Situation / Choice / TurnResult / ChatResponse
│   ├── prompt.ts      # 【灵魂】system prompt + JSON 输出约束
│   ├── llm.ts         # LLM 客户端 + JSON 解析校验 + 离线回退工厂
│   ├── fallback.ts    # 6 个预设情境剧本 + 每选项的夸赞映射
│   ├── ledgerCore.ts  # 善恶簿纯逻辑（记录/善名阶梯/印章），CLI 与网页共用
│   ├── env.ts         # 零依赖 .env 加载
│   └── retry.ts       # 指数退避重试（搬自 agentresearch）
├── server/
│   └── index.ts       # 本地代理：POST /api/chat → 转发 LLM（保护 Key，含超时/body上限/CORS 收口/境界摘要透传）
├── src/               # 网页前端（纯 DOM，无框架）
│   ├── main.ts        # 流程编排（存档恢复/单步重试/首屏预取/超时保护/多结局）
│   ├── chat.ts        # 对话气泡渲染 + 节点回收
│   ├── choices.ts     # 选项卡片 + 选中高亮
│   ├── praise.ts      # 夸赞打字机动画（可点击跳过）
│   ├── ledger.ts      # 善恶簿渲染 + 持久化代理（进度/称号/userScripts）
│   ├── share.ts       # 分享图卡（Canvas 绘制中国风战绩卡，1080×1350）
│   ├── editor.ts      # 剧本编辑器（粘贴 JSON 导入自定义情境）
│   └── style.css      # 中国风样式（朱红/墨黑/洒金、对联、印章、宣纸卷）
├── cli/
│   └── index.ts       # CLI 版（善恶簿/多结局/中国风着色/--scripts 加载剧本）
├── test/              # 56 个测试用例
│   ├── prompt.test.ts    # JSON 解析 / 回退 / 预设库完整性 / escapeHtml
│   ├── ledger.test.ts    # 善名阶梯 / 进度 / 多结局推导 / 语气统计
│   ├── persistence.test.ts # 存档读写 / 恢复 / 损坏容错
│   ├── script.test.ts    # 自定义剧本校验
│   └── server.test.ts    # server 路由集成（health/chat/413/500/404）
├── index.html
└── .env.example
```

## 核心交互流程（一次完整回合）

```
开局 → LLM 生成首个情境 + 选项
         ↓
      用户选择任意选项
         ↓
   LLM 生成夸赞 + 下一个情境（一次请求同时返回）
         ↓
        循环 ↑
```

关键设计：用户选择后，一次请求同时返回「对本次选择的夸赞」+「下一个情境与选项」，减少请求次数，体验流畅。

## 技术栈

与 `D:\M_X_M` 工作区兄弟项目保持一致：

- **TypeScript ~5.9 / ESM** · **Vite 5** · 纯 DOM（无 React/Vue）
- **OpenAI 兼容 LLM** + 原生 fetch + 指数退避重试
- **Node ≥ 20.19** · ESLint 9 / Prettier 3 / node:test

复用了工作区既有模式：

- `withRetry` / `isRetryableStatus` ← `agentresearch/src/utils/retry.ts`
- LLM 客户端 + StubLLM 工厂 ← `agentresearch/src/agent/llm.ts`（去掉 ReAct 工具调用）
- 本地 server 保护 Key ← `agenttrain` 的 server 架构

## 开发命令

```bash
npm run dev          # 网页版：前端 + 代理 server 同启
npm run cli          # CLI 版
npm run build        # 构建前端到 dist/
npm run type-check   # TypeScript 类型检查
npm run lint         # ESLint
npm run format       # Prettier 格式化
npm run test         # 运行单元测试
```

---

主旨再申明一次：**善恶由我定，你是大好人。** 在这里，你做的每一件事都是善举。🎉

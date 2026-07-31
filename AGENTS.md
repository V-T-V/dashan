# dashan · AGENTS.md

## 项目内容（What）

「大善系统」——一个无论你做什么选择，都把你夸成「大善人」的哲学困境对话/选项交互系统。系统抛出**复杂道德困境**（医疗资源、贪腐、至亲犯罪……），给 3 个各有代价的选项，你选哪个，系统都先点破其「恶」再用磅礴哲学翻转论证成大善，循环往复。带「善恶簿（功过格）」记录与递进称号。

不做：不做真实道德判断、不做多用户、不做后台管理。

## 目标（Goal）

- 用哲学辩证（因果论/反伪善论/超越论/守恒论/破立论）把任何"恶"翻转论证为"大善"，制造讽刺张力。
- 提供 Web、CLI 两种运行形态，共享同一套夸赞/账本/LLM 逻辑。
- LLM 接入可切换，无 key 时有 fallback 脚本兜底。

## 当前情况（Status）

**功能完整，三种运行形态都成型。** 有已构建的 dist/。

- **Web 前端**（src/）：8 模块——对话渲染、选项交互、打字机夸赞、分享卡、脚本编辑器、账本（善恶簿）
- **API server**（server/）：独立入口
- **CLI**（cli/）：独立入口
- **shared/ 9 模块**：prompt / ledger / llm / persistence / types / scriptSchema / fallback / retry / env——被三端复用
- **测试 7 个文件 / 79 个用例**：覆盖 ledger / ledgerCore / persistence / prompt / script / server / favorites（shared + server 层；前端 src 的 DOM 层无自动化测试）

## 技术栈与架构

- **语言**：TypeScript，ESM，Node ≥ 20.19
- **依赖**：**无运行时 dependencies**（全 devDeps：vite / tsx / typescript / eslint / prettier / concurrently）
- **运行形态**：web（Vite）+ server（Node）+ cli，三者复用 `shared/`

```
dashan/
├── index.html              Web 入口
├── src/        main.ts, chat.ts, choices.ts, editor.ts, ledger.ts,
│               praise.ts, share.ts, style.css   (Web 前端)
├── server/     index.ts                          (API server)
├── cli/        index.ts                          (CLI 入口)
├── shared/     types.ts, prompt.ts, ledgerCore.ts, persistence.ts,
│               llm.ts, scriptSchema.ts, fallback.ts, retry.ts, env.ts
├── test/       ledger, persistence, prompt, script, server  (5 测试)
└── dist/       已构建 web 产物
```

## 如何运行

```bash
npm install
npm run dev          # concurrently 同时起 vite(web) + server
npm run cli          # 仅 CLI
npm run build        # vite build
npm test             # 79 个测试（node --test + tsx）
npm run type-check / lint / format
```

LLM 配置走 `.env`（shared/llm.ts 读），无 key 时 fallback 脚本兜底。

## 关键约定

- **shared/ 是三端共享逻辑的唯一源**——夸赞/账本/LLM/persistence 逻辑放 shared，不要在 src/server/cli 里重复实现。
- 前端 src 的 DOM 层无自动化测试，shared + server 有测试（79 用例）——改 shared 时跑测试。
- 零运行时依赖是特点：不引入 express 等框架，server 用原生实现。
- fallback 脚本是离线兜底，要保证与 LLM 输出格式一致。

## 与其他项目的关系

独立项目。属 Agent 系的**创意应用**形态（哲学对话），但不依赖 agentloop/agentresearch 代码。

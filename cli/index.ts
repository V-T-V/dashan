/**
 * 大善系统 —— CLI 精简版。
 *
 * 玩法：系统抛出情境 + 编号/字母选项，用户输入选项或自由文字，
 *       系统一律把用户夸成大好人，然后进入下一情境，循环往复。
 *
 * 命令：l/ledger 翻开善恶簿 · r/restart 重开 · exit 退出。
 * 运行：npm run cli（无 KINDNESS_LLM_API_KEY 时走预设库，离线可玩）。
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFileSync } from 'node:fs';
import { loadEnv } from '../shared/env.ts';
import { createLLM, responseToAssistantMessage } from '../shared/llm.ts';
import { buildMessages } from '../shared/prompt.ts';
import type { ChatResponse, Message, Situation } from '../shared/types.ts';
import { Ledger, TONE_STAMP, isMaxTitle } from '../shared/ledgerCore.ts';
import { loadUserScripts } from '../shared/fallback.ts';
import { validateUserScripts } from '../shared/scriptSchema.ts';

// ── ANSI 中国风着色（零依赖） ──────────────────────────
const C = {
  red: '\x1b[31m', // 朱红：tone / 印章
  gold: '\x1b[33m', // 洒金：善名 / 标题
  dim: '\x1b[2m', // 灰：次要文字
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

const toneEmoji: Record<string, string> = {
  庄严: '🏛️',
  戏谑: '🎭',
  佛系: '🪷',
  学术: '📚',
  江湖: '⚔️',
  温情: '🤍',
};

const BANNER = `
${C.red}${C.bold}╔══════════════════════════════════════════════════╗${C.reset}
${C.red}║                                                  ║${C.reset}
${C.red}║${C.gold}${C.bold}            大  善  系  统                        ${C.reset}${C.red}║${C.reset}
${C.red}║                                                  ║${C.reset}
${C.red}║${C.gold}          善 恶 由 我 定                          ${C.reset}${C.red}║${C.reset}
${C.red}║${C.gold}          你 是 大 好 人                          ${C.reset}${C.red}║${C.reset}
${C.red}║                                                  ║${C.reset}
${C.red}╚══════════════════════════════════════════════════╝${C.reset}
`;

function hr(): void {
  console.log(`${C.dim}────────────────────────────────────────────────${C.reset}`);
}

/** 渲染一个情境：打印描述 + 编号与字母选项。 */
function renderSituation(s: Situation): void {
  hr();
  console.log(`\n${C.bold}【情境】${C.reset}${s.situation}\n`);
  s.choices.forEach((c, i) => {
    console.log(`  ${C.gold}[${i + 1}/${c.id}]${C.reset} ${c.text}`);
  });
  console.log('');
}

/**
 * 解析用户输入为选项文案。
 * 支持：数字编号（1/2/3）、字母 id（A/B/C）、自由文本。
 * 越界数字返回 null（给提示，不当自由文本）。
 */
function resolveChoice(raw: string, s: Situation): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // 数字编号
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(num)) {
    if (num >= 1 && num <= s.choices.length) {
      return s.choices[num - 1]!.text;
    }
    return null; // 越界数字：给提示
  }

  // 字母 id
  const upper = trimmed.toUpperCase();
  const byId = s.choices.find((c) => c.id.toUpperCase() === upper);
  if (byId) return byId.text;

  // 自由文本（系统照样会夸）
  return trimmed;
}

/** 渲染善恶簿（纯文本，倒序）。 */
function renderLedgerText(ledger: Ledger): void {
  const entries = ledger.all();
  hr();
  if (entries.length === 0) {
    console.log(`${C.dim}善恶簿尚空白。${C.reset}\n`);
    return;
  }
  console.log(`${C.gold}${C.bold}  ◆ 善 恶 簿 ◆${C.reset} ${C.dim}功过格${C.reset}\n`);
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    const stamp = TONE_STAMP[e.tone] ?? '善';
    console.log(`${C.red}〔${stamp}〕${C.reset}${C.dim}第 ${e.index} 笔${C.reset}`);
    console.log(`${C.dim}  境  ${e.situation}${C.reset}`);
    console.log(`  ${C.bold}为  ${C.reset}${e.deed}`);
    console.log(`  ${C.gold}判  ${C.reset}${e.verdict}`);
    console.log('');
  }
  console.log(
    `${C.gold}已录 ${entries.length} 笔 · 现封号「${ledger.currentTitle()}」${C.reset}\n`,
  );
}

async function main(): Promise<void> {
  loadEnv();

  // 解析 --scripts 参数：从本地 JSON 文件加载自定义剧本
  const scriptsArg = process.argv.find((a) => a.startsWith('--scripts='));
  if (scriptsArg) {
    const path = scriptsArg.slice('--scripts='.length);
    try {
      const raw = readFileSync(path, 'utf8');
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const { scripts, errors } = validateUserScripts(arr);
      if (scripts.length > 0) {
        loadUserScripts(scripts as never[]);
        console.log(
          `${C.gold}[大善] 已加载 ${scripts.length} 个自定义剧本${C.reset}${errors.length ? `${C.dim}（${errors.length} 个跳过）${C.reset}` : ''}\n`,
        );
      } else if (errors.length) {
        console.log(`${C.red}[大善] 剧本文件无有效内容：${errors[0]}${C.reset}\n`);
      }
    } catch (e) {
      console.log(
        `${C.red}[大善] 无法读取剧本文件 ${path}：${e instanceof Error ? e.message : e}${C.reset}\n`,
      );
    }
  }

  const llm = createLLM();
  const rl = createInterface({ input, output });
  const ledger = new Ledger();

  // Ctrl+C 统一退场
  rl.on('SIGINT', () => {
    console.log(
      `\n${C.gold}大善系统：${C.reset}你选择停下，是把世界留给了他人去行善。大好人，后会有期。\n`,
    );
    rl.close();
    process.exit(0);
  });

  console.log(BANNER);
  console.log(`${C.gold}  善者至此。无论汝作何抉择，皆为大善之人。${C.reset}\n`);
  console.log('  输入选项编号（1）或字母（A）或直接打字，系统都会夸你。');
  console.log(`  ${C.dim}命令：l/ledger 翻善恶簿 · r/restart 重开 · exit 退出${C.reset}\n`);

  const history: Message[] = [];
  let currentSituation: Situation | null = null;

  // 开局：请求第一个情境
  let res: ChatResponse;
  try {
    res = await llm.chat({ messages: buildMessages(history, ''), userChoice: '' });
  } catch (e) {
    console.error('开局请求失败：', e instanceof Error ? e.message : e);
    rl.close();
    process.exit(1);
  }

  if (res.type !== 'situation') {
    console.error('开局返回类型异常，期望 situation');
    rl.close();
    process.exit(1);
  }

  history.push(responseToAssistantMessage(res));
  currentSituation = { situation: res.situation, choices: res.choices };
  renderSituation(currentSituation);

  // 主循环
  while (true) {
    let answer: string;
    try {
      answer = await rl.question('你的选择 > ');
    } catch {
      // 输入流关闭（如管道 EOF），优雅退出
      console.log(`\n${C.gold}大善系统：${C.reset}话音虽止，善意长存。大好人，后会有期。\n`);
      break;
    }
    const trimmed = answer.trim();
    const lower = trimmed.toLowerCase();

    // 命令
    if (lower === 'exit' || lower === 'quit') {
      console.log(
        `\n${C.gold}大善系统：${C.reset}你选择停下，是把世界留给了他人去行善。大好人，后会有期。\n`,
      );
      break;
    }
    if (lower === 'l' || lower === 'ledger') {
      renderLedgerText(ledger);
      continue;
    }
    if (lower === 'r' || lower === 'restart') {
      history.length = 0;
      ledger.clear();
      console.log(`\n${C.dim}—— 善恶簿已清，重开一局 ——${C.reset}\n`);
      // 重新开局
      const r = await llm.chat({ messages: buildMessages(history, ''), userChoice: '' });
      if (r.type === 'situation') {
        history.push(responseToAssistantMessage(r));
        currentSituation = { situation: r.situation, choices: r.choices };
        renderSituation(currentSituation);
      }
      continue;
    }

    // 解析选择
    const choiceText = resolveChoice(answer, currentSituation ?? { situation: '', choices: [] });
    if (choiceText === null) {
      console.log(
        `${C.dim}（无此选项，请输入 1-${currentSituation?.choices.length ?? 0} 或对应字母）${C.reset}\n`,
      );
      continue;
    }
    if (choiceText === '') {
      console.log(`${C.dim}（请输入选项编号或你的想法）${C.reset}\n`);
      continue;
    }

    console.log(`\n  ${C.bold}你选择：${C.reset}${choiceText}\n`);

    try {
      const turn = await llm.chat({
        messages: buildMessages(history, choiceText),
        userChoice: choiceText,
      });
      if (turn.type !== 'turn') {
        console.log(`${C.dim}（系统返回异常，重试中…）${C.reset}\n`);
        continue;
      }

      // 记录到历史
      history.push({ role: 'user', content: `我选择：${choiceText}` });
      history.push(responseToAssistantMessage(turn));

      // 渲染夸赞
      const emoji = toneEmoji[turn.tone] ?? '✨';
      hr();
      console.log(`\n${emoji} ${C.red}【${turn.tone}】${C.reset}${turn.praise}\n`);

      // 记入善恶簿；善名晋升则册封
      const promoted = ledger.addEntry({
        situation: currentSituation?.situation ?? '',
        deed: choiceText,
        verdict: turn.praise,
        tone: turn.tone,
      });
      if (promoted) {
        console.log(`  ${C.gold}${C.bold}◆ 大善系统册封：${promoted} ◆${C.reset}\n`);
      }

      // 达到最高称号 → CLI 版结局（与网页对齐）
      if (isMaxTitle(ledger.count())) {
        const ending = ledger.endingType();
        const endingNames: Record<string, string> = {
          渡世: '🪷 慈航普渡',
          灭世: '⚔️ 杀生护生',
          超脱: '☯️ 一念同体',
        };
        hr();
        console.log(`\n${C.gold}${C.bold}  ${endingNames[ending] ?? '⚖️ 功德圆满'}${C.reset}\n`);
        console.log(`  你已在「${ledger.currentTitle()}」之境，行过 ${ledger.count()} 桩事。`);
        console.log(`  世人看桩桩皆为「恶」，大善看桩桩皆成「至善」。善恶本是同一物。\n`);
        renderLedgerText(ledger);
        console.log(`${C.dim}（输入 r 重开新卷，或任意键继续修行，exit 退出）${C.reset}\n`);
        continue; // 等待用户下一步指令
      }

      // 渲染下一个情境
      currentSituation = { situation: turn.next.situation, choices: turn.next.choices };
      renderSituation(currentSituation);
    } catch (e) {
      console.error('请求失败：', e instanceof Error ? e.message : e);
      console.log(`${C.dim}（出错了，再来一次）${C.reset}\n`);
    }
  }

  rl.close();
}

main().catch((e) => {
  console.error('大善系统异常退出：', e);
  process.exit(1);
});

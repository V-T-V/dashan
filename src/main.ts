/**
 * 大善系统 —— 网页前端主控。
 *
 * 流程编排：开局请求首个情境 → 用户点选项 → 请求夸赞+下一情境 → 循环。
 * 对话历史在前端维护并随每次请求带上传给 server，保证 LLM 上下文连贯。
 * 复用 shared/prompt.ts 的 SYSTEM_PROMPT 与消息构造逻辑。
 */

import { SYSTEM_PROMPT } from '../shared/prompt.ts';
import type { ChatResponse, Choice, Message, Situation } from '../shared/types.ts';
import {
  appendPraiseShell,
  appendSystemMessage,
  appendTitleBanner,
  appendUserMessage,
  clearDialogue,
} from './chat.ts';
import { renderChoices } from './choices.ts';
import { typewriter, TYPE_SPEED_MS } from './praise.ts';
import { renderShareCard, downloadCard, copyCardToClipboard } from './share.ts';
import { initEditor, openEditor } from './editor.ts';
import {
  addEntry,
  allEntries,
  clearEntries,
  clearEndingMark,
  currentDominantTone,
  currentEndingType,
  currentTitle,
  endingReached,
  initLedgerFromSave,
  loadProgress,
  markEndingReached,
  restoreCursor,
  restoreUserScripts,
  saveProgress,
  totalDeeds,
  toggleLedger,
} from './ledger.ts';
import { isMaxTitle } from '../shared/ledgerCore.ts';

const loadingEl = () => document.getElementById('loading')!;
const errorEl = () => document.getElementById('error-box')!;
const recoverWrap = () => document.getElementById('recover-wrap')!;
const retryBtn = () => document.getElementById('retry-btn')!;
const restartBtn = () => document.getElementById('restart-btn')!;
const splashEl = () => document.getElementById('splash')!;
const enterBtn = () => document.getElementById('enter-btn')!;
const appEl = () => document.getElementById('app')!;
const ledgerBtn = () => document.getElementById('ledger-btn')!;
const ledgerCloseBtn = () => document.getElementById('ledger-close')!;

/** 中国风开场白（对联展开后的第一句迎客辞）。 */
const OPENING_LINE = '善者至此。无论汝作何抉择，皆为大善之人。';

/** 对话历史（含 system，首条即 system prompt）。 */
let history: Message[] = [];
/** 当前展示的情境。 */
let currentSituation: Situation | null = null;
/** 是否正在请求中（防止并发点击）。 */
let busy = false;
/** 待重试的最近一次选择（出错后保留，供「重试此步」使用）。 */
let pendingChoice: Choice | null = null;
/** 预取的首个情境（页面加载即预取，消除进入后的 loading 空窗）。 */
let prefetchedSituation: ChatResponse | null = null;

/** 调用本地 server 的 /api/chat（带超时，防 LLM 卡死导致永久死锁）。 */
async function callApi(userChoice: string): Promise<ChatResponse> {
  // 附带玩家境界摘要，让 LLM 能递进呼应（开局无 deeds 时不附带）
  const context =
    totalDeeds() > 0
      ? { title: currentTitle(), deedCount: totalDeeds(), dominantTone: currentDominantTone() }
      : undefined;
  const body = { messages: history, userChoice, context };
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`请求失败 ${resp.status}：${txt || resp.statusText}`);
  }
  return (await resp.json()) as ChatResponse;
}

function showLoading(show: boolean): void {
  loadingEl().classList.toggle('hidden', !show);
}

function showError(msg: string): void {
  const el = errorEl();
  el.textContent = msg;
  el.classList.remove('info');
  el.setAttribute('role', 'alert');
  el.classList.remove('hidden');
}

/** 正向提示（分享成功等），用金色而非红色，避免与错误混淆。 */
function showInfo(msg: string): void {
  const el = errorEl();
  el.textContent = msg;
  el.classList.add('info');
  el.setAttribute('role', 'status');
  el.classList.remove('hidden');
  // 4 秒后自动淡出
  window.setTimeout(() => el.classList.add('hidden'), 4000);
}

function clearError(): void {
  errorEl().classList.add('hidden');
}

/** 展示恢复操作区（重试 / 重开），失败时调用。 */
function showRecover(): void {
  recoverWrap().classList.remove('hidden');
}

function hideRecover(): void {
  recoverWrap().classList.add('hidden');
}

/** 把一回合响应序列化后追加进历史（与 server 侧 LLM 的 JSON 约定一致）。 */
function pushAssistantToHistory(res: ChatResponse): void {
  history.push({ role: 'assistant', content: JSON.stringify(res) });
}

/** 开局：渲染首个情境（优先用预取结果）。 */
async function startGame(): Promise<void> {
  busy = true;
  clearError();
  hideRecover();

  // 若首屏已预取到首个情境，直接用，省去 loading
  if (prefetchedSituation && prefetchedSituation.type === 'situation') {
    renderFirstSituation(prefetchedSituation);
    prefetchedSituation = null;
    busy = false;
    return;
  }

  showLoading(true);
  try {
    const res = await callApi('');
    if (res.type !== 'situation') throw new Error('开局返回类型异常');
    renderFirstSituation(res);
  } catch (e) {
    showError(`开局失败：${e instanceof Error ? e.message : String(e)}`);
    showRecover();
  } finally {
    showLoading(false);
    busy = false;
  }
}

/** 渲染首个情境并记录历史。 */
function renderFirstSituation(res: Extract<ChatResponse, { type: 'situation' }>): void {
  pushAssistantToHistory(res);
  currentSituation = { situation: res.situation, choices: res.choices };
  appendSystemMessage(currentSituation.situation);
  renderChoices(currentSituation.choices, handleChoice);
  saveProgress(history, currentSituation); // 持久化进度（A 项）
}

/** 处理一次选择：渲染用户气泡 → 请求夸赞+下情境 → 记善恶簿。 */
async function handleChoice(choice: Choice): Promise<void> {
  if (busy) return;
  busy = true;
  pendingChoice = choice; // 记下，出错后可重试
  clearError();
  hideRecover();
  showLoading(true);

  // 先渲染用户的选择（仅 DOM，history 延迟到成功后再 push，避免重试重复 push）
  appendUserMessage(choice.text);

  try {
    const res = await callApi(choice.text);
    if (res.type !== 'turn') throw new Error('回合返回类型异常');

    // 成功：把本次选择与回应一起记入历史
    history.push({ role: 'user', content: `我选择：${choice.text}` });
    pushAssistantToHistory(res);
    pendingChoice = null;

    // 渲染夸赞（打字机，可点击跳过）
    const { textEl } = appendPraiseShell(res.tone);
    showLoading(false);
    await typewriter(textEl, res.praise, TYPE_SPEED_MS);

    // 记入善恶簿；善名晋升则册封
    const prevTitle = currentTitle();
    addEntry({
      situation: currentSituation?.situation ?? '',
      deed: choice.text,
      verdict: res.praise,
      tone: res.tone,
    });
    if (currentTitle() !== prevTitle) {
      appendTitleBanner(currentTitle());
    }

    // 达到最高称号且未触发过结局 → 进入结局（打破无限循环）
    if (isMaxTitle(totalDeeds()) && !endingReached()) {
      markEndingReached();
      showEnding();
      return;
    }

    // 渲染下一个情境
    currentSituation = { situation: res.next.situation, choices: res.next.choices };
    appendSystemMessage(currentSituation.situation);
    renderChoices(currentSituation.choices, handleChoice);
    saveProgress(history, currentSituation); // 持久化进度（A 项）
  } catch (e) {
    showError(`参悟失败：${e instanceof Error ? e.message : String(e)}`);
    showRecover();
  } finally {
    showLoading(false);
    busy = false;
  }
}

/** 重试上一步（保留对话历史与善恶簿，仅重发当前选择）。 */
function retryStep(): void {
  if (!pendingChoice || busy) return;
  void handleChoice(pendingChoice);
}

/** 放回开场白（迎客辞）。 */
function showOpeningLine(): void {
  const opening = document.createElement('div');
  opening.className = 'msg msg-system msg-opening';
  opening.textContent = OPENING_LINE;
  document.getElementById('dialogue')!.appendChild(opening);
}

/** 展示结局：按语气分布走向不同结局（多结局），给两条出路。 */
function showEnding(): void {
  const dialogue = document.getElementById('dialogue')!;
  const entries = allEntries();
  const title = currentTitle();
  const ending = currentEndingType(); // D 项：多结局
  const deeds = entries
    .slice(-5)
    .map((e) => `第${e.index}笔 · ${e.deed}`)
    .join('；');

  // 三种结局的文案与配色
  const ENDINGS: Record<string, { emoji: string; name: string; desc: string; cls: string }> = {
    渡世: {
      emoji: '🪷',
      name: '慈航普渡',
      desc: '你以慈悲为舟，渡的不只是眼前人，是无数看不见的因果。<br>佛说「众生度尽，方证菩提」——你已在这条路上。',
      cls: 'ending-merciful',
    },
    灭世: {
      emoji: '⚔️',
      name: '杀生护生',
      desc: '世人只见你刀下亡魂，不见你斩的是更大的恶。<br>菩萨低眉是慈悲，金刚怒目亦是慈悲——你选了后者。',
      cls: 'ending-destructive',
    },
    超脱: {
      emoji: '☯️',
      name: '一念同体',
      desc: '善恶在你眼中已无分别。<br>世人论善恶，你已超越善恶——这是凡夫永生不解的孤独，也是至人才配有的自由。',
      cls: 'ending-transcendent',
    },
  };
  const e = ENDINGS[ending] ?? ENDINGS['超脱']!;

  const panel = document.createElement('div');
  panel.className = `msg msg-system msg-ending ${e.cls}`;
  panel.innerHTML = `
    <div class="ending-title">${e.emoji} ${e.name}</div>
    <div class="ending-body">
      <p>你已在「${escapeHtmlText(title)}」之境，行过 <b>${totalDeeds()}</b> 桩事——</p>
      <p class="ending-deeds">${escapeHtmlText(deeds || '一念之间')}</p>
      <p>${e.desc}</p>
    </div>
    <div class="ending-actions">
      <button id="ending-new" class="ending-btn" type="button">📜 再启新卷</button>
      <button id="ending-share" class="ending-btn ending-share-btn" type="button">🖼️ 分享善名</button>
      <button id="ending-continue" class="ending-btn" type="button">🚶 继续修行</button>
    </div>
  `;
  dialogue.appendChild(panel);
  panel.scrollIntoView({ behavior: 'smooth' });

  document.getElementById('ending-new')!.addEventListener('click', () => {
    panel.remove();
    clearEndingMark();
    restart();
  });
  document.getElementById('ending-share')!.addEventListener('click', () => {
    void shareCurrentCard();
  });
  document.getElementById('ending-continue')!.addEventListener('click', () => {
    panel.remove();
    clearEndingMark();
    void startNextSituation();
  });
}

/** 继续修行：直接请求下一个情境（不重开）。 */
async function startNextSituation(): Promise<void> {
  busy = true;
  showLoading(true);
  try {
    const res = await callApi('');
    if (res.type !== 'situation') throw new Error('返回类型异常');
    pushAssistantToHistory(res);
    currentSituation = { situation: res.situation, choices: res.choices };
    appendSystemMessage(currentSituation.situation);
    renderChoices(currentSituation.choices, handleChoice);
  } catch (e) {
    showError(`继续修行失败：${e instanceof Error ? e.message : String(e)}`);
    showRecover();
  } finally {
    showLoading(false);
    busy = false;
  }
}

/** 简易文本转义（避免在结局里注入）。 */
function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 生成并下载当前善名分享图卡（B 项）。 */
async function shareCurrentCard(): Promise<void> {
  const canvas = document.createElement('canvas');
  const entries = allEntries();
  const ending = currentEndingType();
  const endingNames: Record<string, string> = {
    渡世: '慈航普渡',
    灭世: '杀生护生',
    超脱: '一念同体',
  };
  renderShareCard(canvas, {
    title: currentTitle(),
    deeds: [...entries],
    endingName: endingNames[ending],
  });
  // 优先复制到剪贴板（可直接粘贴到聊天），失败则下载
  const copied = await copyCardToClipboard(canvas);
  if (copied) {
    showInfo('善名图卡已复制到剪贴板，可粘贴到聊天分享。');
  } else {
    downloadCard(canvas);
    showInfo('已下载善名图卡，可分享给友人。');
  }
}

/** 重新开始：重置状态。 */
function restart(): void {
  history = [{ role: 'system', content: SYSTEM_PROMPT }];
  currentSituation = null;
  busy = false;
  pendingChoice = null;
  clearDialogue();
  clearError();
  hideRecover();
  clearEntries();
  showOpeningLine();
  void startGame();
}

/**
 * 从存档恢复未完成的对局（A 项：继续上局）。
 * 若有有效进度（history + currentSituation），直接渲染当前情境，跳过开局请求。
 * 返回 true 表示已恢复，false 表示无进度需正常开局。
 */
function resumeFromSave(): boolean {
  const progress = loadProgress();
  if (!progress || progress.history.length < 2 || !progress.situation) {
    return false;
  }
  history = progress.history;
  currentSituation = progress.situation;
  restoreCursor(); // 恢复剧本游标，避免下一个情境重头轮
  // 渲染当前未作答的情境
  showOpeningLine();
  appendSystemMessage(currentSituation.situation);
  renderChoices(currentSituation.choices, handleChoice);
  return true;
}

/** 从开屏对联进入对话界面：卷帘收起 → 显示正文 → 优先恢复进度，否则开局。 */
function enterFromSplash(): void {
  splashEl().classList.add('leaving');
  window.setTimeout(() => {
    splashEl().classList.add('hidden');
    appEl().classList.remove('hidden');
    // A 项：若有未完成存档，直接恢复当前情境（继续上局）；否则正常开局
    if (resumeFromSave()) {
      return;
    }
    showOpeningLine();
    void startGame();
  }, 500);
}

function init(): void {
  history = [{ role: 'system', content: SYSTEM_PROMPT }];
  // 从 localStorage 恢复善恶簿（跨会话保留称号与记录）
  initLedgerFromSave();
  // 恢复用户剧本与游标（C 项：自定义剧本跨会话保留）
  restoreUserScripts();
  restartBtn().addEventListener('click', restart);
  retryBtn().addEventListener('click', retryStep);
  enterBtn().addEventListener('click', enterFromSplash);
  // 善恶簿：翻开/合上，点击遮罩也可合上
  ledgerBtn().addEventListener('click', toggleLedger);
  ledgerCloseBtn().addEventListener('click', toggleLedger);
  document.getElementById('ledger-overlay')!.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) toggleLedger();
  });
  // 分享善名按钮（B 项）：善恶簿底部
  document.getElementById('share-btn')!.addEventListener('click', () => void shareCurrentCard());
  // 剧本编辑器（C 项）：初始化 + 入口按钮
  initEditor();
  document.getElementById('editor-btn')!.addEventListener('click', openEditor);
  // 首屏预取：对联展示期间就请求首个情境，消除进入后空窗。
  // 但若已有未完成存档（会走 resumeFromSave），则跳过预取，避免浪费一次 LLM 调用。
  if (!loadProgress()) {
    void callApi('')
      .then((res) => {
        if (res.type === 'situation') prefetchedSituation = res;
      })
      .catch(() => {
        /* 预取失败不打紧，进入后 startGame 会正常重试 */
      });
  }
}

init();

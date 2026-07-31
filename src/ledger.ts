/**
 * 大善系统 —— 善恶簿（功过格）网页渲染层。
 *
 * 纯逻辑（记录、善名阶梯、印章用词）在 shared/ledgerCore.ts，与 DOM 无关，
 * CLI 也复用它。本文件只负责把数据渲染成网页 DOM，并维护抽屉开关。
 */

import { Ledger, TITLES, TONE_STAMP, escapeHtml, type EndingType } from '../shared/ledgerCore.ts';
import { type DashanSave, createEmptySave, loadSave, writeSave } from '../shared/persistence.ts';
import { loadFavorites } from './favorites.ts';
import type { Message, Situation, Tone } from '../shared/types.ts';
import {
  loadUserScripts,
  clearUserScripts,
  getUserScripts,
  setCursor,
  getCursor,
} from '../shared/fallback.ts';
import { validateUserScripts, type ValidatedScript } from '../shared/scriptSchema.ts';

/** 全局唯一的善恶簿实例（本局有效）。 */
const ledger = new Ledger();

/** 持久化的存档（跨会话保存善恶簿）。 */
let save: DashanSave = createEmptySave();

/** 启动时从 localStorage 恢复善恶簿记录。由 main.ts 在初始化时调用一次。 */
export function initLedgerFromSave(): void {
  save = loadSave();
  if (save.entries.length > 0) {
    ledger.import(save.entries);
    updateBadge();
  }
}

// ── 对外暴露的纯逻辑代理（保持 main.ts 调用接口不变） ──
export function currentTitle(): string {
  return ledger.currentTitle();
}

export function clearEntries(): void {
  ledger.clear();
  save.entries = [];
  save.endingReached = false;
  save.history = undefined;
  save.currentSituation = undefined;
  save.cursor = undefined;
  setCursor(0); // 重置剧本池游标，使「重开一局」后从第一个剧本重新轮换
  writeSave(save);
  updateBadge();
}

// ── 对话进度存档（A 项：继续上局） ──

/** 持久化当前对话进度（历史 + 当前情境 + 游标）。 */
export function saveProgress(history: Message[], situation: Situation | null): void {
  save.history = history;
  save.currentSituation = situation;
  save.cursor = getCursor();
  writeSave(save);
}

/** 读取已保存的对话进度；无进度返回 null。 */
export function loadProgress(): {
  history: Message[];
  situation: Situation | null;
} | null {
  if (!save.history || save.history.length === 0 || !save.currentSituation) {
    return null;
  }
  return { history: save.history, situation: save.currentSituation };
}

/** 从存档恢复游标（开局不重头）。 */
export function restoreCursor(): void {
  if (typeof save.cursor === 'number') setCursor(save.cursor);
}

// ── 用户剧本管理（C 项：自定义剧本） ──

/** 导入用户剧本（JSON 字符串），返回校验结果。成功则持久化并注入池。 */
export function importUserScripts(jsonText: string): {
  ok: boolean;
  errors: string[];
  count: number;
} {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return { ok: false, errors: ['JSON 格式错误，无法解析'], count: 0 };
  }
  // 支持单个对象或数组
  const arr = Array.isArray(raw) ? raw : [raw];
  const { scripts, errors } = validateUserScripts(arr);
  if (scripts.length === 0) {
    return { ok: false, errors: errors.length ? errors : ['没有有效的剧本'], count: 0 };
  }
  loadUserScripts(scripts as never[]);
  persistUserScripts();
  return { ok: true, errors, count: scripts.length };
}

/** 持久化当前用户剧本到存档。 */
function persistUserScripts(): void {
  // ValidatedScript 与内部 Script 结构兼容，直接存
  save.userScripts = getUserScripts() as unknown as ValidatedScript[];
  writeSave(save);
}

/** 从存档恢复用户剧本（启动时调用）。 */
export function restoreUserScripts(): void {
  const stored = save.userScripts;
  if (Array.isArray(stored) && stored.length > 0) {
    loadUserScripts(stored as never[]);
  }
}

/** 清空用户剧本。 */
export function clearAllUserScripts(): void {
  clearUserScripts();
  save.userScripts = undefined;
  writeSave(save);
}

/** 当前用户剧本数。 */
export function userScriptTotal(): number {
  return getUserScripts().length;
}

/**
 * 新增一笔记录。返回新善名（空串表示未晋升），便于 main.ts 决定是否册封。
 */
export function addEntry(entry: {
  situation: string;
  deed: string;
  verdict: string;
  tone: import('../shared/types.ts').Tone;
}): string {
  const promoted = ledger.addEntry(entry);
  // 持久化到 localStorage
  save.entries = ledger.export();
  writeSave(save);
  updateBadge();
  return promoted;
}

/** 当前记录数（供结局判定用）。 */
export function totalDeeds(): number {
  return ledger.count();
}

/** 是否已触发过结局（存档标记）。 */
export function endingReached(): boolean {
  return save.endingReached;
}

/** 标记结局已触发。 */
export function markEndingReached(): void {
  save.endingReached = true;
  writeSave(save);
}

/** 清除结局标记（继续修行后允许再次触发）。 */
export function clearEndingMark(): void {
  save.endingReached = false;
  writeSave(save);
}

/** 取全部记录（供结局画面列举 deed）。 */
export function allEntries() {
  return ledger.all();
}

/** 当前结局类型（供多结局展示）。 */
export function currentEndingType(): EndingType {
  return ledger.endingType();
}

/** 当前语气分布统计（结局页条形图用）。 */
export function allToneStats(): Record<Tone, number> {
  return ledger.toneStats();
}

/** 当前主导语气（占比最高），供 LLM 个性化。 */
export function currentDominantTone(): Tone | undefined {
  const stats = ledger.toneStats();
  let max = 0;
  let dom: Tone | undefined;
  for (const k of Object.keys(stats) as Tone[]) {
    if ((stats[k] ?? 0) > max) {
      max = stats[k] ?? 0;
      dom = k;
    }
  }
  return dom;
}

// ── DOM 引用 ──
const overlay = () => document.getElementById('ledger-overlay')!;
const body = () => document.getElementById('ledger-body')!;
const summary = () => document.getElementById('ledger-summary')!;
const badge = () => document.getElementById('ledger-count')!;

/** 更新按钮上的数字角标。 */
function updateBadge(): void {
  const el = badge();
  const n = ledger.count();
  if (n > 0) {
    el.textContent = String(n);
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

/** 渲染善恶簿内容到抽屉。 */
export function renderLedger(): void {
  const container = body();
  const entries = ledger.all();

  if (entries.length === 0) {
    container.innerHTML =
      '<div class="ledger-empty">善恶簿尚空白。<br>待你行过几桩事，此处自会落笔。</div>';
    summary().textContent = '';
    return;
  }

  container.innerHTML = '';

  // ── 进度条（D 项：到下一级善名的进度） ──
  const prog = ledger.progress();
  const progEl = document.createElement('div');
  progEl.className = 'ledger-progress';
  if (prog.nextAt === null) {
    progEl.innerHTML = `
      <div class="progress-label">已功德圆满 · 善名至顶</div>
      <div class="progress-bar"><div class="progress-fill" style="width:100%"></div></div>`;
  } else {
    const nextName = TITLES[prog.current + 1]?.name ?? '更高境界';
    progEl.innerHTML = `
      <div class="progress-label">距「${escapeHtml(nextName)}」还差 <b>${prog.remaining}</b> 笔</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${prog.percent}%"></div></div>`;
  }
  container.appendChild(progEl);

  // ── 印章收集墙（D 项：6 语气印章，已集齐高亮） ──
  const stats = ledger.toneStats();
  const wallEl = document.createElement('div');
  wallEl.className = 'stamp-wall';
  const allTones: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  wallEl.innerHTML = allTones
    .map((t) => {
      const got = (stats[t] ?? 0) > 0;
      return `<span class="stamp-slot ${got ? 'collected' : ''}" title="${t}：${stats[t] ?? 0} 笔">
        <span class="stamp-glyph">${TONE_STAMP[t]}</span>
        <span class="stamp-tone-name">${t}</span>
      </span>`;
    })
    .join('');
  container.appendChild(wallEl);

  // ── 统计里程碑区 ──
  const favCount = loadFavorites().length;
  const milestoneEl = document.createElement('div');
  milestoneEl.className = 'ledger-milestone';
  const toneTotal = Object.values(stats).reduce((a, b) => a + b, 0);
  const dominantTone = Object.entries(stats).sort((a, b) => b[1] - a[1])[0];
  milestoneEl.innerHTML = `
    <div class="milestone-title">📊 修行统计</div>
    <div class="milestone-grid">
      <div class="milestone-cell">
        <span class="milestone-num">${entries.length}</span>
        <span class="milestone-label">总抉择</span>
      </div>
      <div class="milestone-cell">
        <span class="milestone-num">${favCount}</span>
        <span class="milestone-label">收藏</span>
      </div>
      <div class="milestone-cell">
        <span class="milestone-num">${endingReached() ? '✓' : '—'}</span>
        <span class="milestone-label">已结局</span>
      </div>
      <div class="milestone-cell">
        <span class="milestone-num">${toneTotal > 0 ? (dominantTone?.[0] ?? '—') : '—'}</span>
        <span class="milestone-label">主导语气</span>
      </div>
    </div>`;
  container.appendChild(milestoneEl);

  // ── 倒序条目列表 ──
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    const row = document.createElement('div');
    row.className = `ledger-entry tone-${e.tone}`;

    row.innerHTML = `
      <div class="entry-head">
        <span class="entry-no">第 ${e.index} 笔</span>
        <span class="entry-stamp stamp-${e.tone}">${TONE_STAMP[e.tone]}</span>
      </div>
      <div class="entry-situation">${escapeHtml(e.situation)}</div>
      <div class="entry-deed">
        <span class="entry-label">汝之所为</span>
        <span class="entry-deed-text">${escapeHtml(e.deed)}</span>
      </div>
      <div class="entry-verdict">
        <span class="entry-label">大善判曰</span>
        <span class="entry-verdict-text">${escapeHtml(e.verdict)}</span>
      </div>
    `;

    container.appendChild(row);
  }

  summary().textContent = `已录 ${entries.length} 笔 · 现封号「${ledger.currentTitle()}」`;
}

/** 翻开 / 合上善恶簿。 */
export function toggleLedger(): void {
  const ov = overlay();
  if (ov.classList.contains('hidden')) {
    renderLedger();
    ov.classList.remove('hidden');
  } else {
    ov.classList.add('hidden');
  }
}

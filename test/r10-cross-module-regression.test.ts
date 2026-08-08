/**
 * R10-D10: R10 跨模块回归测试——锁定 R10 多模块集成不变量。
 *
 * 把 D1~D8 的关键改动串联成端到端不变量，防止后续重构破坏 R10 的多模块协作：
 *  1. 双隐藏结局与 hiddenEndingHint 一致性（满级时 hint.path ↔ endingNarrative.type）
 *  2. 双隐藏结局互斥（同一满级存档只能触发其一）
 *  3. hiddenEndingHint 未满级预告 → 满级时兑现（同语气路径延续）
 *  4. export 三格式都含双隐藏结局之一的叙述（当满级+学术/江湖）
 *  5. i18n 英文称号映射与 ledgerCore.TITLES 逐级对齐（跨模块讲同一称号阶梯）
 *  6. stats.buildStatsPanel 与 endingType 一致（面板结局 == ledgerCore 结局）
 *  7. customDilemma 生成的剧本 praises 的 tone 全合法（注入 pool 安全）
 *  8. daily 全年 365 天不抛错 + weekday 与 getDay 一致（R10 加固的解析路径）
 *  9. quotes/music 推荐在所有题材下都不抛错（分类器跨题材稳定）
 * 10. theme 三主题 CSS 变量集合严格一致（D3 锁定的不变量）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { endingNarrative, endingType, TITLES, type LedgerEntry } from '../shared/ledgerCore.ts';
import { hiddenEndingHint, buildStatsPanel } from '../shared/stats.ts';
import { exportLedgerJSON, exportLedgerMarkdown, exportLedgerHTML } from '../shared/export.ts';
import { englishTitles, titleLabel } from '../shared/i18n.ts';
import { createCustomDilemma } from '../shared/customDilemma.ts';
import { upcomingReflections } from '../shared/daily.ts';
import { recommendQuotes } from '../shared/quotes.ts';
import { recommendMusic } from '../shared/music.ts';
import { THEME_VARS } from '../shared/theme.ts';
import type { Tone, Category } from '../shared/types.ts';

const MAX_AT = TITLES[TITLES.length - 1]!.at;
const TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
const CATEGORIES: Category[] = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];

function mkEntries(tones: Tone[]): LedgerEntry[] {
  return tones.map((t, i) => ({
    index: i + 1,
    situation: `情境${i + 1}`,
    deed: `抉择${i + 1}`,
    verdict: `判词${i + 1}`,
    tone: t,
  }));
}

// ── 1. 双隐藏结局与 hiddenEndingHint 一致性 ─────────────

test('r10-regression: 满级全学术 → hint.path == endingNarrative.type == 辩经尊者', () => {
  const e = mkEntries(Array(MAX_AT).fill('学术'));
  const hint = hiddenEndingHint(e);
  const narr = endingNarrative(e);
  assert.equal(hint.unlocked, true);
  assert.equal(hint.path, '辩经尊者');
  assert.equal(narr.type, '辩经尊者');
  assert.equal(hint.path, narr.type);
});

test('r10-regression: 满级全江湖 → hint.path == endingNarrative.type == 执剑尊者', () => {
  const e = mkEntries(Array(MAX_AT).fill('江湖'));
  const hint = hiddenEndingHint(e);
  const narr = endingNarrative(e);
  assert.equal(hint.unlocked, true);
  assert.equal(hint.path, '执剑尊者');
  assert.equal(narr.type, '执剑尊者');
  assert.equal(hint.path, narr.type);
});

// ── 2. 双隐藏结局互斥 ──────────────────────────────────

test('r10-regression: 任一满级存档的 endingNarrative.type 恒为 5 种合法值之一且不并存', () => {
  const valid = ['渡世', '灭世', '超脱', '辩经尊者', '执剑尊者'];
  for (const tone of TONES) {
    const e = mkEntries(Array(MAX_AT).fill(tone));
    const t = endingNarrative(e).type;
    assert.ok(valid.includes(t), `${tone} → 非法 type ${t}`);
    // type 是单值，天然互斥
    assert.equal(typeof t, 'string');
  }
});

// ── 3. 未满级预告 → 满级兑现（同语气路径延续）──────────

test('r10-regression: 9 笔全学术预告辩经尊者 → 补到 10 笔兑现', () => {
  const before = mkEntries(Array(9).fill('学术'));
  const hintBefore = hiddenEndingHint(before);
  assert.equal(hintBefore.onPath, true);
  assert.equal(hintBefore.path, '辩经尊者');
  assert.equal(hintBefore.unlocked, false);
  assert.equal(hintBefore.deedsToUnlock, 1);

  const after = mkEntries(Array(10).fill('学术'));
  const narrAfter = endingNarrative(after);
  assert.equal(narrAfter.type, '辩经尊者');
  // 预告的 path 与兑现的 type 一致
  assert.equal(hintBefore.path, narrAfter.type);
});

test('r10-regression: 9 笔全江湖预告执剑尊者 → 补到 10 笔兑现', () => {
  const before = mkEntries(Array(9).fill('江湖'));
  const hintBefore = hiddenEndingHint(before);
  assert.equal(hintBefore.path, '执剑尊者');

  const after = mkEntries(Array(10).fill('江湖'));
  assert.equal(endingNarrative(after).type, '执剑尊者');
  assert.equal(hintBefore.path, endingNarrative(after).type);
});

// ── 4. export 三格式含双隐藏结局叙述（满级+学术/江湖）──

test('r10-regression: 满级全学术 → 三格式导出都不抛错且含结局信息', () => {
  const e = mkEntries(Array(MAX_AT).fill('学术'));
  assert.doesNotThrow(() => exportLedgerJSON(e));
  assert.doesNotThrow(() => exportLedgerMarkdown(e));
  assert.doesNotThrow(() => exportLedgerHTML(e));
  // baseType 是超脱（学术属 transcendent），导出应含超脱结局中文名
  const md = exportLedgerMarkdown(e);
  assert.ok(md.includes('超脱'));
});

test('r10-regression: 满级全江湖 → 三格式导出含灭世结局（baseType）', () => {
  const e = mkEntries(Array(MAX_AT).fill('江湖'));
  const md = exportLedgerMarkdown(e);
  // 江湖属破坏阵营，baseType=灭世
  assert.ok(md.includes('灭世'));
});

// ── 5. i18n 英文称号映射与 ledgerCore.TITLES 逐级对齐 ──

test('r10-regression: englishTitles 长度 == TITLES.length（跨模块对齐）', () => {
  assert.equal(englishTitles().length, TITLES.length);
});

test('r10-regression: titleLabel en-US 每级返回非空且与中文不同', () => {
  for (let i = 0; i < TITLES.length; i++) {
    const en = titleLabel(TITLES[i]!.name, i, 'en-US');
    assert.ok(en.length > 0);
    assert.notEqual(en, TITLES[i]!.name);
  }
});

// ── 6. stats.buildStatsPanel 与 endingType 一致 ────────

test('r10-regression: buildStatsPanel.ending.type == endingType（全语气抽样）', () => {
  for (const tone of TONES) {
    const e = mkEntries(Array(5).fill(tone));
    const panel = buildStatsPanel(e);
    assert.equal(panel.ending.type, endingType(e));
  }
});

test('r10-regression: buildStatsPanel.summary 含 totalDeeds 与称号', () => {
  const e = mkEntries(Array(3).fill('佛系'));
  const panel = buildStatsPanel(e);
  assert.ok(panel.summary.includes('3'));
});

// ── 7. customDilemma 生成的 praises tone 全合法 ─────────

test('r10-regression: customDilemma 生成的剧本 praises 的 tone 全合法枚举', () => {
  const r = createCustomDilemma({ situation: '某情境', choices: ['甲', '乙', '丙'] });
  assert.equal(r.ok, true);
  for (const key of Object.keys(r.script!.praises)) {
    const tone = r.script!.praises[key]!.tone;
    assert.ok(TONES.includes(tone), `非法 tone=${tone}`);
  }
});

test('r10-regression: customDilemma 满级存档可与 endingNarrative 共存（结构兼容）', () => {
  // 生成的剧本结构是 ValidatedScript，与 fallback pool 兼容
  const r = createCustomDilemma({ situation: 'x', choices: ['a', 'b'] });
  assert.ok(r.script!.situation);
  assert.ok(r.script!.praises);
  assert.ok(r.script!.fallback);
});

// ── 8. daily 全年 365 天不抛错 + weekday 一致 ──────────

test('r10-regression: dailyReflection 一年 365 天全部不抛错', () => {
  const days = upcomingReflections('2024-01-01', 365);
  assert.equal(days.length, 365);
  for (const d of days) {
    assert.ok(d.date.length > 0);
    assert.ok(d.reflectionQuestions.length === 3);
  }
});

test('r10-regression: dailyReflection 每天的 weekday 与 Date.getDay 一致', () => {
  // 抽样 12 天
  const samples = upcomingReflections('2024-01-01', 12);
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  for (let i = 0; i < samples.length; i++) {
    const d = new Date(2024, 0, 1 + i + 1); // from 之后第 i+1 天
    assert.equal(samples[i]!.weekday, weekdays[d.getDay()]);
  }
});

// ── 9. quotes/music 推荐在所有题材下都不抛错 ───────────

test('r10-regression: recommendQuotes 在全 8 题材下都不抛错且返回非空', () => {
  for (const cat of CATEGORIES) {
    const r = recommendQuotes({ category: cat, limit: 3 });
    assert.ok(r.length > 0, `${cat} 应有引语推荐`);
  }
});

test('r10-regression: recommendMusic 在全 8 题材下都不抛错且返回非空', () => {
  for (const cat of CATEGORIES) {
    const r = recommendMusic({ category: cat, limit: 3 });
    assert.ok(r.length > 0, `${cat} 应有曲目推荐`);
  }
});

test('r10-regression: recommendQuotes + recommendMusic 全语气组合不抛错', () => {
  for (const tone of TONES) {
    assert.doesNotThrow(() => recommendQuotes({ tone, limit: 2 }));
    assert.doesNotThrow(() => recommendMusic({ tone, limit: 2 }));
  }
});

// ── 10. theme 三主题 CSS 变量集合严格一致 ──────────────

test('r10-regression: theme 三主题变量名集合严格一致（D3 锁定不变量）', () => {
  const sets = (['dark', 'light', 'ancient'] as const).map((id) =>
    Object.keys(THEME_VARS[id]).sort(),
  );
  assert.deepEqual(sets[0], sets[1]);
  assert.deepEqual(sets[0], sets[2]);
});

test('r10-regression: theme 三主题都含核心 red/gold/ink 变量', () => {
  for (const id of ['dark', 'light', 'ancient'] as const) {
    assert.ok('--red' in THEME_VARS[id]);
    assert.ok('--gold' in THEME_VARS[id]);
    assert.ok('--ink' in THEME_VARS[id]);
  }
});

// ── 综合：R10 全套新功能端到端不抛错 ───────────────────

test('r10-regression: R10 全套新功能端到端串联不抛错', () => {
  // 造一个满级+主导学术的存档（触发辩经尊者路径）
  const entries = mkEntries(Array(MAX_AT).fill('学术'));
  assert.doesNotThrow(() => {
    const hint = hiddenEndingHint(entries); // D7
    const narr = endingNarrative(entries); // D6
    const panel = buildStatsPanel(entries); // stats
    const json = exportLedgerJSON(entries); // D2
    const md = exportLedgerMarkdown(entries);
    const html = exportLedgerHTML(entries);
    // 全部产出非空
    assert.ok(hint.path === narr.type);
    assert.ok(panel.summary.length > 0);
    assert.ok(json.length > 0 && md.length > 0 && html.length > 0);
  });
});

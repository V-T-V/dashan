/**
 * 大善系统 —— 哲学引语库 测试（shared/quotes.ts）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  QUOTES,
  recommendQuotes,
  quoteOfTheMoment,
  quotesBySchool,
  quoteBySeed,
  quoteLibraryStats,
  scoreQuote,
  renderQuote,
} from '../shared/quotes.ts';
import type { Category, Tone } from '../shared/types.ts';
import type { SchoolId } from '../shared/schools.ts';

const ALL_CATEGORIES: Category[] = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];
const ALL_TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
const ALL_SCHOOLS: (SchoolId | '西方')[] = ['儒家', '道家', '佛家', '法家', '墨家', '西方'];

// ── 库完整性 ─────────────────────────────────────────────

test('quotes: 库规模 ≥ 100 条', () => {
  assert.ok(QUOTES.length >= 100, `引语库应有 ≥100 条，实际 ${QUOTES.length}`);
});

test('quotes: 每条引语字段齐全', () => {
  for (const q of QUOTES) {
    assert.ok(q.text.length > 0);
    assert.ok(q.author.length > 0);
    assert.ok(ALL_SCHOOLS.includes(q.school), `school=${q.school} 应合法`);
    assert.ok(Array.isArray(q.categories) && q.categories.length > 0);
    assert.ok(Array.isArray(q.tones) && q.tones.length > 0);
  }
});

test('quotes: 6 流派都有引语', () => {
  const schools = new Set(QUOTES.map((q) => q.school));
  for (const s of ALL_SCHOOLS) {
    assert.ok(schools.has(s), `流派 ${s} 应至少 1 条引语`);
  }
});

test('quotes: 覆盖全 8 题材（合并 categories）', () => {
  const covered = new Set<Category>();
  for (const q of QUOTES) for (const c of q.categories) covered.add(c);
  for (const c of ALL_CATEGORIES) assert.ok(covered.has(c), `题材 ${c} 应被覆盖`);
});

test('quotes: 覆盖全 6 语气（合并 tones）', () => {
  const covered = new Set<Tone>();
  for (const q of QUOTES) for (const tn of q.tones) covered.add(tn);
  for (const tn of ALL_TONES) assert.ok(covered.has(tn), `语气 ${tn} 应被覆盖`);
});

// ── scoreQuote ────────────────────────────────────────────

test('quotes: scoreQuote 题材命中 +3', () => {
  const q = QUOTES[0]!;
  const cat = q.categories[0]!;
  assert.ok(scoreQuote(q, { category: cat }) >= 3);
});

test('quotes: scoreQuote 语气命中 +2', () => {
  const q = QUOTES[0]!;
  const tn = q.tones[0]!;
  assert.ok(scoreQuote(q, { tone: tn }) >= 2);
});

test('quotes: scoreQuote 三轴全命中 > 单轴', () => {
  const q = QUOTES[0]!;
  const cat = q.categories[0]!;
  const tn = q.tones[0]!;
  const d = q.difficulties?.[0];
  const full = scoreQuote(q, { category: cat, tone: tn, difficulty: d });
  const partial = scoreQuote(q, { category: cat });
  assert.ok(full > partial);
});

// ── recommendQuotes ───────────────────────────────────────

test('quotes: recommendQuotes 默认返回 3 条', () => {
  assert.equal(recommendQuotes({}).length, 3);
});

test('quotes: recommendQuotes limit 钳制', () => {
  assert.equal(recommendQuotes({ limit: 0 }).length, 1);
  assert.equal(recommendQuotes({ limit: 999 }).length, QUOTES.length);
});

test('quotes: recommendQuotes 按 score 降序', () => {
  const r = recommendQuotes({ category: '战争', tone: '庄严', limit: 5 });
  const scores = r.map((q) => scoreQuote(q, { category: '战争', tone: '庄严' }));
  for (let i = 1; i < scores.length; i++) {
    assert.ok(scores[i]! <= scores[i - 1]!);
  }
});

test('quotes: recommendQuotes 同分按库顺序（稳定）', () => {
  const r = recommendQuotes({ limit: 5 });
  const rIds = r.map((q) => q.text);
  const libIds = QUOTES.slice(0, 5).map((q) => q.text);
  assert.deepEqual(rIds, libIds);
});

test('quotes: recommendQuotes 确定性', () => {
  const req = { category: '医疗' as Category };
  assert.deepEqual(recommendQuotes(req), recommendQuotes(req));
});

test('quotes: recommendQuotes 命中题材的引语优先于不命中', () => {
  const r = recommendQuotes({ category: '战争', limit: 3 });
  // 前几条应含战争题材
  assert.ok(r[0]!.categories.includes('战争'));
});

// ── quoteOfTheMoment ──────────────────────────────────────

test('quotes: quoteOfTheMoment 返回单条', () => {
  const q = quoteOfTheMoment({ category: '司法' });
  assert.ok(q && q.text);
});

test('quotes: quoteOfTheMoment 与 recommendQuotes[0] 一致', () => {
  const req = { category: '医疗' as Category };
  assert.equal(quoteOfTheMoment(req).text, recommendQuotes({ ...req, limit: 1 })[0]!.text);
});

// ── quotesBySchool ────────────────────────────────────────

test('quotes: quotesBySchool 过滤正确', () => {
  for (const s of ALL_SCHOOLS) {
    const list = quotesBySchool(s);
    assert.ok(list.length > 0, `${s} 应有引语`);
    assert.ok(list.every((q) => q.school === s));
  }
});

test('quotes: quotesBySchool 各流派计数之和 = 总数', () => {
  const sum = ALL_SCHOOLS.reduce((acc, s) => acc + quotesBySchool(s).length, 0);
  assert.equal(sum, QUOTES.length);
});

// ── quoteBySeed ───────────────────────────────────────────

test('quotes: quoteBySeed 确定性', () => {
  assert.equal(quoteBySeed(42).text, quoteBySeed(42).text);
});

test('quotes: quoteBySeed 负数与正数都安全（不抛错）', () => {
  assert.ok(quoteBySeed(-1).text);
  assert.ok(quoteBySeed(0).text);
  assert.ok(quoteBySeed(999999).text);
});

test('quotes: quoteBySeed 不同 seed 可能取不同引语', () => {
  // 库 >100 条，seed 0 和 100 应大概率不同
  const ids = new Set<string>();
  for (let i = 0; i < 10; i++) ids.add(quoteBySeed(i).text);
  assert.ok(ids.size > 1);
});

// ── quoteLibraryStats ─────────────────────────────────────

test('quotes: quoteLibraryStats.total 与库一致', () => {
  assert.equal(quoteLibraryStats().total, QUOTES.length);
});

test('quotes: quoteLibraryStats.bySchool 6 流派齐全', () => {
  const s = quoteLibraryStats();
  for (const sch of ALL_SCHOOLS) {
    assert.ok((s.bySchool[sch] ?? 0) > 0, `${sch} 计数应 >0`);
  }
  // 各流派之和 = 总数
  const sum = Object.values(s.bySchool).reduce((a, b) => a + b, 0);
  assert.equal(sum, QUOTES.length);
});

test('quotes: quoteLibraryStats.byCategory 计数正确', () => {
  const s = quoteLibraryStats();
  for (const c of ALL_CATEGORIES) {
    const expected = QUOTES.filter((q) => q.categories.includes(c)).length;
    assert.equal(s.byCategory[c] ?? 0, expected);
  }
});

test('quotes: quoteLibraryStats.byTone 计数正确', () => {
  const s = quoteLibraryStats();
  for (const tn of ALL_TONES) {
    const expected = QUOTES.filter((q) => q.tones.includes(tn)).length;
    assert.equal(s.byTone[tn] ?? 0, expected);
  }
});

// ── renderQuote ───────────────────────────────────────────

test('quotes: renderQuote 含「」与作者', () => {
  const q = QUOTES[0]!;
  const r = renderQuote(q);
  assert.ok(r.includes('「'));
  assert.ok(r.includes('」'));
  assert.ok(r.includes(q.author));
});

test('quotes: renderQuote 有 source 时含《》', () => {
  const qWithSrc = QUOTES.find((q) => q.source)!;
  assert.ok(qWithSrc, '应至少 1 条带 source');
  const r = renderQuote(qWithSrc);
  assert.ok(r.includes('《'), `应含书名号：${r}`);
});

test('quotes: renderQuote 无 source 时不含《》', () => {
  const qNoSrc = QUOTES.find((q) => !q.source)!;
  assert.ok(qNoSrc);
  const r = renderQuote(qNoSrc);
  assert.ok(!r.includes('《'));
});

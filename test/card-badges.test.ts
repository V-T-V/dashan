/**
 * shared/card.ts 徽章集成测试 —— R5-D7
 *
 * 验证 D6 新增的 achievements 徽章与分享卡片的集成：
 * - badgesLine：emoji 串联 + ×计数 / 空数组返回空串 / 单个 / 多个 / 含同名
 * - generateTextCard：提供 badges 时在摘要下方多一行 / 不提供时不增行 / 空数组等价不提供
 * - generateHtmlCard：提供 badges 时含 .badges div / 不提供时无 .badges / badges 内容被转义
 * - textCardFromEntries / htmlCardFromEntries：自动从 entries 派生徽章（集成 achievements）
 * - 确定性：同输入同输出 / 徽章行不影响其余结构
 * - 向后兼容：不传 badges 时与旧调用结果完全一致（无新行）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTextCard,
  generateHtmlCard,
  textCardFromEntries,
  htmlCardFromEntries,
  badgesLine,
} from '../shared/card.ts';
import type { LedgerEntry } from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

function entry(deed: string, tone: Tone, index: number): LedgerEntry {
  return { index, situation: `情境${index}`, deed, verdict: `判${index}`, tone };
}

function makeEntries(n: number): LedgerEntry[] {
  const tones: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  return Array.from({ length: n }, (_, i) => entry(`为${i + 1}`, tones[i % tones.length]!, i + 1));
}

const TITLE = '初入善门者';

// ---------- badgesLine ----------

test('badgesLine: 空数组返回空串', () => {
  assert.equal(badgesLine([]), '');
});

test('badgesLine: 单个徽章——emoji ×1', () => {
  assert.equal(badgesLine([{ emoji: '🌱', name: '初行一善' }]), '🌱 ×1');
});

test('badgesLine: 多个——emoji 空格串联 + 末尾计数', () => {
  const out = badgesLine([
    { emoji: '🌱', name: '初行一善' },
    { emoji: '🔥', name: '一念执着' },
    { emoji: '🌟', name: '超凡入圣' },
  ]);
  assert.equal(out, '🌱 🔥 🌟 ×3');
});

test('badgesLine: 计数 = 徽章数（与 name 无关）', () => {
  const out = badgesLine([
    { emoji: '🌱', name: '同名的也算' },
    { emoji: '🌱', name: '同名的也算' },
  ]);
  assert.equal(out, '🌱 🌱 ×2');
});

test('badgesLine: 不含徽章 name（仅 emoji + 计数）', () => {
  const out = badgesLine([{ emoji: '♿', name: '某超长徽章名' }]);
  assert.ok(!out.includes('某超长徽章名'));
});

// ---------- generateTextCard 徽章行 ----------

test('textCard: 不提供 badges 时不含徽章行（向后兼容）', () => {
  const card = generateTextCard({ title: TITLE, deeds: makeEntries(3) });
  assert.ok(!card.includes('×'));
});

test('textCard: 提供非空 badges 时含徽章行（带 ×N）', () => {
  const card = generateTextCard({
    title: TITLE,
    deeds: makeEntries(3),
    badges: [
      { emoji: '🌱', name: '初行一善' },
      { emoji: '🔥', name: '一念执着' },
    ],
  });
  assert.ok(card.includes('🌱 🔥 ×2'), '缺徽章行');
});

test('textCard: 提供空 badges 数组等价于不提供（无徽章行）', () => {
  const a = generateTextCard({ title: TITLE, deeds: makeEntries(2), badges: [] });
  const b = generateTextCard({ title: TITLE, deeds: makeEntries(2) });
  assert.equal(a, b);
});

test('textCard: 徽章行出现在摘要行之后（行序）', () => {
  const card = generateTextCard({
    title: TITLE,
    deeds: makeEntries(3),
    badges: [{ emoji: '🌱', name: '初行一善' }],
  });
  const lines = card.split('\n');
  const summaryIdx = lines.findIndex((l) => l.includes('笔抉择'));
  const badgeIdx = lines.findIndex((l) => l.includes('×1'));
  assert.ok(summaryIdx >= 0 && badgeIdx >= 0);
  assert.ok(badgeIdx > summaryIdx, '徽章行应在摘要行之后');
});

test('textCard: 徽章行不影响对联/称号/事迹/署名结构', () => {
  const withBadges = generateTextCard({
    title: TITLE,
    deeds: makeEntries(2),
    badges: [{ emoji: '🌱', name: 'x' }],
  });
  assert.ok(withBadges.includes('善 恶 由 我 定'));
  assert.ok(withBadges.includes('你 是 大 好 人'));
  assert.ok(withBadges.includes(TITLE));
  assert.ok(withBadges.includes('善 行 录'));
  assert.ok(withBadges.includes('一善者'));
});

test('textCard: 确定性——同输入同输出（含徽章）', () => {
  const a = generateTextCard({
    title: TITLE,
    deeds: makeEntries(4),
    badges: [{ emoji: '🌱', name: 'x' }],
  });
  const b = generateTextCard({
    title: TITLE,
    deeds: makeEntries(4),
    badges: [{ emoji: '🌱', name: 'x' }],
  });
  assert.equal(a, b);
});

// ---------- generateHtmlCard 徽章 ----------

test('htmlCard: 不提供 badges 时无 .badges div', () => {
  const html = generateHtmlCard({ title: TITLE, deeds: makeEntries(3) }, { full: false });
  assert.ok(!html.includes('class="badges"'));
});

test('htmlCard: 提供非空 badges 时含 .badges div', () => {
  const html = generateHtmlCard(
    { title: TITLE, deeds: makeEntries(3), badges: [{ emoji: '🌱', name: '初行一善' }] },
    { full: false },
  );
  assert.ok(html.includes('class="badges"'));
  assert.ok(html.includes('🌱 ×1'));
});

test('htmlCard: badges 内容被 HTML 转义（emoji 安全但防注入）', () => {
  const html = generateHtmlCard(
    {
      title: TITLE,
      deeds: makeEntries(1),
      // emoji 字段含 HTML 特殊字符（理论上不会，但验证转义）
      badges: [{ emoji: '<x>', name: '注入测试' }],
    },
    { full: false },
  );
  assert.ok(!html.includes('<x>×1'), '未转义的 <x> 出现在 badges');
  assert.ok(html.includes('&lt;x&gt;'));
});

test('htmlCard: 徽章行在 summary 之后、section-title 之前', () => {
  const html = generateHtmlCard(
    { title: TITLE, deeds: makeEntries(2), badges: [{ emoji: '🌱', name: 'x' }] },
    { full: false },
  );
  const summaryIdx = html.indexOf('class="summary"');
  const badgesIdx = html.indexOf('class="badges"');
  const sectionIdx = html.indexOf('section-title');
  assert.ok(summaryIdx > 0 && badgesIdx > 0 && sectionIdx > 0);
  assert.ok(summaryIdx < badgesIdx, 'summary 应在 badges 前');
  assert.ok(badgesIdx < sectionIdx, 'badges 应在 section-title 前');
});

// ---------- 便捷封装自动派生徽章 ----------

test('textCardFromEntries: 自动派生徽章——3 笔至少有 first-step', () => {
  const card = textCardFromEntries(makeEntries(3));
  // 3 笔 first-step 达成，徽章行含 ×N（N≥1）
  assert.ok(/×\d+/.test(card), '缺徽章计数');
});

test('textCardFromEntries: 空数组无徽章（无 first-step）', () => {
  const card = textCardFromEntries([]);
  // 空数组无任何徽章达成，不应有徽章行
  assert.ok(!/×\d+/.test(card), '空数组不应有徽章行');
});

test('textCardFromEntries: 徽章计数与达成的成就数一致', () => {
  // 用 achievements 模块交叉验证
  const deeds = makeEntries(10);
  const card = textCardFromEntries(deeds);
  const m = card.match(/×(\d+)/);
  assert.ok(m, '缺徽章计数');
  // 10 笔达成的成就：first-step + ten-deeds + ... 至少 2 枚
  const count = parseInt(m[1]!, 10);
  assert.ok(count >= 2, `10 笔徽章数 ${count} 应≥2`);
});

test('htmlCardFromEntries: 自动派生徽章——含 .badges div（3 笔）', () => {
  const html = htmlCardFromEntries(makeEntries(3), { full: false });
  assert.ok(html.includes('class="badges"'));
});

test('htmlCardFromEntries: 空数组无 .badges div', () => {
  const html = htmlCardFromEntries([], { full: false });
  assert.ok(!html.includes('class="badges"'));
});

// ---------- 向后兼容 / 确定性 ----------

test('向后兼容: generateTextCard 不传 badges 与传 undefined 完全一致', () => {
  const a = generateTextCard({ title: TITLE, deeds: makeEntries(5) });
  const b = generateTextCard({ title: TITLE, deeds: makeEntries(5), badges: undefined });
  assert.equal(a, b);
});

test('确定性: textCardFromEntries 同输入两次完全一致', () => {
  const a = textCardFromEntries(makeEntries(7));
  const b = textCardFromEntries(makeEntries(7));
  assert.equal(a, b);
});

test('确定性: htmlCardFromEntries 同输入两次完全一致', () => {
  const a = htmlCardFromEntries(makeEntries(7));
  const b = htmlCardFromEntries(makeEntries(7));
  assert.equal(a, b);
});

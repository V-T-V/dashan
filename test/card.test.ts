/**
 * 大善系统 —— 分享卡片生成（shared/card.ts）测试。
 *
 * 覆盖：
 *  - generateTextCard：边框结构、对联标题、印章称号、事迹行、署名、宽度自适应
 *  - generateHtmlCard：DOCTYPE / 片段模式、CSS 内联、印章、事迹色块、转义
 *  - textCardFromEntries / htmlCardFromEntries：一步到位封装
 *  - 边界：空 deeds、超长 deed 截断、玩家名缺省、特殊字符转义
 *  - 视觉一致性：洒金点确定性（同输入同输出）、配色常量齐全
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateTextCard,
  generateHtmlCard,
  textCardFromEntries,
  htmlCardFromEntries,
  CARD_COLORS,
  TONE_COLORS,
} from '../shared/card.ts';
import type { LedgerEntry } from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

function entry(index: number, deed: string, tone: Tone): LedgerEntry {
  return {
    index,
    situation: `情境${index}`,
    deed,
    verdict: `夸赞${index}`,
    tone,
  };
}

// ── generateTextCard 结构 ─────────────────────────────────

test('generateTextCard: 顶部对联标题', () => {
  const card = generateTextCard({ title: '大善之人', deeds: [entry(1, '救人', '庄严')] });
  assert.ok(card.includes('善 恶 由 我 定'));
  assert.ok(card.includes('你 是 大 好 人'));
});

test('generateTextCard: 含称号与边框', () => {
  const card = generateTextCard({ title: '大善之人', deeds: [entry(1, '救人', '庄严')] });
  assert.ok(card.includes('【大善之人】'));
  assert.ok(card.includes('╔'));
  assert.ok(card.includes('╚'));
});

test('generateTextCard: 含善行录与事迹行', () => {
  const card = generateTextCard({
    title: 'X',
    deeds: [entry(1, '救人', '庄严'), entry(2, '济贫', '温情')],
  });
  assert.ok(card.includes('善 行 录'));
  assert.ok(card.includes('救人'));
  assert.ok(card.includes('济贫'));
  // 印章字
  assert.ok(card.includes('〔善〕'));
});

test('generateTextCard: 空事迹有占位', () => {
  const card = generateTextCard({ title: 'X', deeds: [] });
  assert.ok(card.includes('尚无善行'));
});

test('generateTextCard: 署名默认「一善者」+ 品牌', () => {
  const card = generateTextCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(card.includes('一善者'));
  assert.ok(card.includes('dashan'));
});

test('generateTextCard: 自定义玩家名生效', () => {
  const card = generateTextCard({
    title: 'X',
    deeds: [entry(1, 'a', '庄严')],
    playerName: '无名氏',
  });
  assert.ok(card.includes('无名氏'));
  assert.ok(!card.includes('一善者'));
});

test('generateTextCard: 最多展示 5 条事迹', () => {
  const deeds: LedgerEntry[] = [];
  for (let i = 1; i <= 20; i++) deeds.push(entry(i, `deed${i}`, '庄严'));
  const card = generateTextCard({ title: 'X', deeds });
  // 只应含最后 5 条（deed16..deed20），不应含 deed1..deed15
  assert.ok(card.includes('deed20'));
  assert.ok(card.includes('deed16'));
  assert.ok(!card.includes('deed1,'));
  assert.ok(!card.includes('deed15'));
});

test('generateTextCard: 超长 deed 被截断（含 …）', () => {
  const long = '超'.repeat(100);
  const card = generateTextCard({ title: 'X', deeds: [entry(1, long, '庄严')] }, { width: 28 });
  assert.ok(card.includes('…'));
});

test('generateTextCard: 自定义 width 生效（更宽含更多空格）', () => {
  const narrow = generateTextCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] }, { width: 28 });
  const wide = generateTextCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] }, { width: 60 });
  // 宽卡每行更长
  const narrowLineLen = Math.max(...narrow.split('\n').map((l) => l.length));
  const wideLineLen = Math.max(...wide.split('\n').map((l) => l.length));
  assert.ok(wideLineLen > narrowLineLen, `宽卡应更长：${wideLineLen} vs ${narrowLineLen}`);
});

test('generateTextCard: 满级时含结局名', () => {
  const deeds: LedgerEntry[] = [];
  const tones: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  for (let i = 1; i <= 10; i++) deeds.push(entry(i, `d${i}`, tones[i % tones.length]!));
  const card = generateTextCard({ title: '至善', deeds, endingName: '☯️ 一念同体' });
  assert.ok(card.includes('一念同体'));
});

// ── generateHtmlCard 结构 ─────────────────────────────────

test('generateHtmlCard(full=true): 含完整 DOCTYPE 与 <html>', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('<html'));
  assert.ok(html.includes('</html>'));
  assert.ok(html.includes('<title>'));
});

test('generateHtmlCard(full=false): 仅返回片段，无 DOCTYPE', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] }, { full: false });
  assert.ok(html.includes('class="card"'));
  assert.ok(!html.includes('<!DOCTYPE'));
  assert.ok(!html.includes('<html'));
});

test('generateHtmlCard: 内联 CSS 含配色变量', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes(CARD_COLORS.gold));
  assert.ok(html.includes(CARD_COLORS.sealRed));
  assert.ok(html.includes('Noto Serif SC'));
});

test('generateHtmlCard: 含印章 div 与称号', () => {
  const html = generateHtmlCard({ title: '大善之人', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('class="seal"'));
  assert.ok(html.includes('大善之人'));
});

test('generateHtmlCard: 事迹行含语气配色色块', () => {
  const html = generateHtmlCard({
    title: 'X',
    deeds: [entry(1, '救人', '佛系')],
  });
  assert.ok(html.includes('class="stamp"'));
  assert.ok(html.includes(TONE_COLORS['佛系']), '佛系印章应使用对应配色');
  assert.ok(html.includes('救人'));
});

test('generateHtmlCard: 含洒金点（确定性，同输入同输出）', () => {
  const html1 = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  const html2 = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  const dots1 = (html1.match(/class="gold-dots"[\s\S]*?<\/div>/) ?? [''])[0];
  const dots2 = (html2.match(/class="gold-dots"[\s\S]*?<\/div>/) ?? [''])[0];
  assert.ok(dots1.includes('<i '), '应有洒金点');
  assert.equal(dots1, dots2, '同输入洒金点应完全一致（确定性）');
});

// ── 安全：转义 ────────────────────────────────────────────

test('generateHtmlCard: 用户输入的 deed 含 HTML 特殊字符被转义', () => {
  const malicious = '<script>alert(1)</script>';
  const html = generateHtmlCard({
    title: 'X',
    deeds: [entry(1, malicious, '庄严')],
    playerName: '<img src=x onerror=alert(1)>',
  });
  assert.ok(!html.includes('<script>alert(1)</script>'), 'script 标签应被转义');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img'));
});

test('generateTextCard: 含特殊字符的 deed 不破坏边框对齐', () => {
  // 纯文本卡片不做转义（无注入风险），但应能完整输出而不报错
  const card = generateTextCard({
    title: 'X',
    deeds: [entry(1, '含"引号"与&符号', '庄严')],
  });
  assert.ok(card.includes('引号'));
  assert.ok(card.includes('&'));
});

// ── 便捷封装 ──────────────────────────────────────────────

test('textCardFromEntries: 自动算出称号', () => {
  const card = textCardFromEntries([entry(1, 'a', '庄严')]);
  // 1 笔 → 初入善门者
  assert.ok(card.includes('初入善门者'));
});

test('textCardFromEntries: 满级时自动带上结局名', () => {
  const deeds: LedgerEntry[] = [];
  for (let i = 1; i <= 10; i++) deeds.push(entry(i, `d${i}`, '佛系'));
  const card = textCardFromEntries(deeds);
  // 全佛系 → 渡世 → 慈航普渡
  assert.ok(card.includes('至善') || card.includes('超凡'));
  assert.ok(card.includes('慈航普渡'));
});

test('htmlCardFromEntries: full=false 返回片段', () => {
  const html = htmlCardFromEntries([entry(1, 'a', '庄严')], { full: false });
  assert.ok(html.includes('class="card"'));
  assert.ok(!html.includes('<!DOCTYPE'));
});

test('htmlCardFromEntries: 默认返回完整文档', () => {
  const html = htmlCardFromEntries([entry(1, 'a', '庄严')]);
  assert.ok(html.includes('<!DOCTYPE html>'));
});

// ── 配色常量齐全 ─────────────────────────────────────────

test('CARD_COLORS: 关键配色齐全', () => {
  assert.ok(CARD_COLORS.bg.startsWith('#'));
  assert.ok(CARD_COLORS.gold.startsWith('#'));
  assert.ok(CARD_COLORS.sealRed.startsWith('#'));
});

test('TONE_COLORS: 六种语气配色齐全', () => {
  const tones: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  for (const t of tones) {
    assert.ok(TONE_COLORS[t].startsWith('#'), `${t} 应有十六进制配色`);
  }
});

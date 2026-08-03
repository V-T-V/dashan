/**
 * 大善系统 —— 分享卡片 高级测试（HTML 卡片格式/转义/响应式/社交分享兼容）。
 *
 * 覆盖 round 8 新关注点：
 *  - HTML 卡片结构完整性：DOCTYPE / viewport / meta / style / 内联 CSS
 *  - 转义：用户名/deed 含 HTML 特殊字符时必须转义，防注入
 *  - 响应式：viewport meta + 卡片宽度 / 媒体查询（CSS 内容校验）
 *  - 社交分享兼容：title/charset/lang 便于卡片预览
 *  - 片段模式（full=false）：仅返回 <div>，便于嵌入
 *  - 确定性：洒金点同输入同输出
 *  - 配色常量齐全：CARD_COLORS / TONE_COLORS
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
  return { index, situation: `情境${index}`, deed, verdict: `夸赞${index}`, tone };
}

const ALL_TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

// ── HTML 结构完整性 ───────────────────────────────────────

test('高级: HTML 卡片含 <!DOCTYPE html>', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.startsWith('<!DOCTYPE html>'));
});

test('高级: HTML 卡片含 viewport meta（响应式）', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('viewport'), '应含 viewport meta');
  assert.ok(html.includes('width=device-width'), '应含 width=device-width');
});

test('高级: HTML 卡片含 charset=UTF-8', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('charset'));
  assert.ok(html.toLowerCase().includes('utf-8'));
});

test('高级: HTML 卡片 lang=zh-CN（社交分享兼容）', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('lang="zh-CN"'), '应含 lang="zh-CN"');
});

test('高级: HTML 卡片 <title> 含称号（便于分享预览）', () => {
  const html = generateHtmlCard({ title: '大善之人', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('<title>'));
  assert.ok(html.includes('大善之人'));
});

test('高级: HTML 卡片内联 <style>（无外部 CSS 依赖，便于复制粘贴）', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('<style>'));
  assert.ok(html.includes('</style>'));
  // 不应引用外部 CSS
  assert.ok(!html.includes('<link'), '不应有外部 <link>');
});

test('高级: HTML 卡片含印章 .seal 与对联 .couplet', () => {
  const html = generateHtmlCard({ title: '大善之人', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('class="seal"'));
  assert.ok(html.includes('class="couplet"'));
  assert.ok(html.includes('class="seal-title"'));
});

test('高级: HTML 卡片含洒金点 .gold-dots', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('class="gold-dots"'));
  // 应有多个 <i> 标签（洒金点）
  const iCount = (html.match(/<i\s/g) || []).length;
  assert.ok(iCount > 10, `洒金点应 >10 个，实际 ${iCount}`);
});

// ── 片段模式（full=false）────────────────────────────────

test('高级: full=false 仅返回 <div class="card"> 片段，无 DOCTYPE', () => {
  const frag = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] }, { full: false });
  assert.ok(!frag.includes('<!DOCTYPE'));
  assert.ok(!frag.includes('<html'));
  assert.ok(frag.includes('class="card"'));
});

test('高级: 片段模式仍含印章与事迹', () => {
  const frag = generateHtmlCard({ title: 'X', deeds: [entry(1, '救人', '温情')] }, { full: false });
  assert.ok(frag.includes('class="seal"'));
  assert.ok(frag.includes('救人'));
});

// ── 转义：防注入 ──────────────────────────────────────────

test('高级: 玩家名含 <script> 被转义', () => {
  const html = generateHtmlCard({
    title: 'X',
    deeds: [entry(1, 'a', '庄严')],
    playerName: '<script>alert(1)</script>',
  });
  assert.ok(!html.includes('<script>alert'), '原始 <script> 不应出现在正文中');
  assert.ok(html.includes('&lt;script&gt;'), '应转义为 &lt;script&gt;');
});

test('高级: deed 含 HTML 特殊字符被转义', () => {
  const html = generateHtmlCard({
    title: 'X',
    deeds: [entry(1, '<b>bold</b> & "quote"', '庄严')],
  });
  // deed 文本里的 < > " 应被转义（标题/结构的 < > 不算）
  assert.ok(html.includes('&lt;b&gt;'));
  assert.ok(html.includes('&quot;'));
});

test('高级: 称号含特殊字符被转义', () => {
  const html = generateHtmlCard({
    title: '<超凡>入圣',
    deeds: [entry(1, 'a', '庄严')],
  });
  // seal-title 内应出现转义后的称号
  assert.ok(html.includes('&lt;超凡&gt;'));
});

test('高级: & 字符被转义为 &amp;', () => {
  const html = generateHtmlCard({
    title: 'X',
    deeds: [entry(1, 'a & b', '庄严')],
  });
  assert.ok(html.includes('a &amp; b'));
});

// ── 响应式：CSS 内容校验 ─────────────────────────────────

test('高级: CSS 含 box-sizing: border-box（响应式基础）', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('box-sizing'));
});

test('高级: CSS body 使用 flex 居中（多端兼容）', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('display: flex') || html.includes('display:flex'));
  assert.ok(html.includes('align-items: center') || html.includes('align-items:center'));
});

test('高级: 卡片宽度固定 420px（社交分享标准尺寸）', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('420px'));
});

test('高级: CSS 含 font-family 衬线字体（中国风）', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('font-family'));
  assert.ok(html.includes('Serif'));
});

// ── 配色常量齐全 ─────────────────────────────────────────

test('高级: CARD_COLORS 含全部配色键', () => {
  const keys = Object.keys(CARD_COLORS);
  for (const k of ['bg', 'gold', 'paper', 'sealRed', 'sealEdge']) {
    assert.ok(keys.includes(k), `CARD_COLORS 应含 ${k}`);
  }
});

test('高级: TONE_COLORS 覆盖全部 6 语气', () => {
  for (const t of ALL_TONES) {
    assert.ok(t in TONE_COLORS, `TONE_COLORS 应含语气 ${t}`);
    assert.ok(TONE_COLORS[t].startsWith('#'), `${t} 配色应为 hex`);
  }
});

test('高级: CARD_COLORS 配色为 hex 格式', () => {
  for (const [k, v] of Object.entries(CARD_COLORS)) {
    if (k === 'goldDim' || k === 'goldFaint' || k === 'paperDim') continue; // rgba
    assert.ok((v as string).startsWith('#'), `${k}=${v} 应为 hex`);
  }
});

// ── 确定性：洒金点同输入同输出 ─────────────────────────────

test('高级: 洒金点确定性：同输入两次渲染完全一致', () => {
  const data = { title: 'X', deeds: [entry(1, 'a', '庄严')] };
  const a = generateHtmlCard(data);
  const b = generateHtmlCard(data);
  assert.equal(a, b);
});

test('高级: 洒金点数量稳定（80 个）', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  const iCount = (html.match(/<i\s/g) || []).length;
  assert.equal(iCount, 80);
});

// ── 便捷封装 ──────────────────────────────────────────────

test('高级: htmlCardFromEntries 默认 full=true', () => {
  const html = htmlCardFromEntries([entry(1, 'a', '庄严')]);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
});

test('高级: htmlCardFromEntries(full=false) 返回片段', () => {
  const frag = htmlCardFromEntries([entry(1, 'a', '庄严')], { full: false });
  assert.ok(!frag.includes('<!DOCTYPE'));
});

test('高级: textCardFromEntries 含自动算出的称号', () => {
  // 1 笔 → 初入善门者
  const txt = textCardFromEntries([entry(1, 'a', '庄严')]);
  assert.ok(txt.includes('初入善门者'));
});

test('高级: textCardFromEntries 10 笔自动算满级 + 含结局名', () => {
  const entries: LedgerEntry[] = [];
  for (let i = 1; i <= 10; i++) entries.push(entry(i, `d${i}`, ALL_TONES[i % 6]!));
  const txt = textCardFromEntries(entries);
  // 满级称号
  assert.ok(txt.includes('超凡入圣'));
});

// ── 印章色块：每个 tone 都有对应色 ───────────────────────

test('高级: HTML 卡片每个 deed 的 stamp 用对应 tone 色', () => {
  // 卡片只显示最近 5 条（MAX_DEEDS_ON_CARD=5），所以这里取后 5 个语气
  const deeds: LedgerEntry[] = ALL_TONES.slice(1).map((t, i) => entry(i + 1, `d${i}`, t));
  const html = generateHtmlCard({ title: 'X', deeds });
  // 后 5 个语气的色 hex 都应出现在内联 style 里
  for (const t of ALL_TONES.slice(1)) {
    assert.ok(
      html.includes(TONE_COLORS[t]),
      `应含语气 ${t} 的配色 ${TONE_COLORS[t]}`,
    );
  }
});

// ── 空 deeds 边界 ─────────────────────────────────────────

test('高级: 空 deeds 的 HTML 卡片含占位文案', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [] });
  assert.ok(html.includes('尚无善行'));
});

test('高级: 空 deeds 的文本卡片含占位文案', () => {
  const txt = generateTextCard({ title: 'X', deeds: [] });
  assert.ok(txt.includes('尚无善行'));
});

// ── 卡片末尾品牌签名 ─────────────────────────────────────

test('高级: HTML 卡片含「大善系统 dashan」品牌', () => {
  const html = generateHtmlCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(html.includes('大 善 系 统'));
  assert.ok(html.toLowerCase().includes('dashan'));
});

test('高级: 文本卡片含品牌', () => {
  const txt = generateTextCard({ title: 'X', deeds: [entry(1, 'a', '庄严')] });
  assert.ok(txt.includes('dashan'));
});

// ── 结局标签 ──────────────────────────────────────────────

test('高级: 满级时 HTML 卡片含结局 emoji 标签', () => {
  const entries: LedgerEntry[] = [];
  for (let i = 1; i <= 10; i++) entries.push(entry(i, `d${i}`, ALL_TONES[i % 6]!));
  const html = htmlCardFromEntries(entries);
  // 结局标签应含 emoji 之一
  assert.ok(
    html.includes('🪷') || html.includes('⚔️') || html.includes('☯️'),
    '应含结局 emoji',
  );
});

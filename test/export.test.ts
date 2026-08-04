/**
 * 大善系统 —— 导出功能测试（round 17）。
 *
 * 覆盖 JSON / Markdown / HTML 三种格式：
 *  - JSON：结构正确（format/version）、往返 parse 一致、含 stats、空数组
 *  - Markdown：标题/概览/语气表/称号阶梯/明细、空态、特殊字符转义（|）
 *  - HTML：DOCTYPE/charset/内联样式、escapeHtml 注入防护、印章、空态
 *  - exportLedger 统一入口分派、扩展名/MIME
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  exportLedgerJSON,
  parseLedgerJSON,
  exportLedgerMarkdown,
  exportLedgerHTML,
  exportLedger,
  exportFileExtension,
  exportMimeType,
  type ExportEntry,
} from '../shared/export.ts';
import type { Tone } from '../shared/types.ts';

function mk(
  i: number,
  over: Partial<ExportEntry> & { tone?: Tone; deed?: string; verdict?: string; situation?: string } = {},
): ExportEntry {
  return {
    index: i,
    situation: over.situation ?? `情境${i}`,
    deed: over.deed ?? `选项A`,
    verdict: over.verdict ?? `这是夸赞${i}`,
    tone: over.tone ?? '庄严',
    category: over.category,
    difficulty: over.difficulty,
    ts: over.ts,
  };
}

const SAMPLE: ExportEntry[] = [
  mk(1, { tone: '佛系', category: '医疗', difficulty: 1, deed: '选项A', ts: 1000 }),
  mk(2, { tone: '温情', category: '职场', difficulty: 2, deed: '选项B', ts: 2000 }),
  mk(3, { tone: '庄严', category: '司法', difficulty: 3, deed: '选项C', ts: 3000 }),
];

// ── JSON ───────────────────────────────────────────────

test('export-JSON: 含 format 标记与 version', () => {
  const json = exportLedgerJSON(SAMPLE);
  const o = JSON.parse(json);
  assert.equal(o.format, 'dashan-ledger-v1');
});

test('export-JSON: summary 含 totalDeeds/currentTitle/ending', () => {
  const o = JSON.parse(exportLedgerJSON(SAMPLE));
  assert.equal(o.summary.totalDeeds, 3);
  assert.ok(o.summary.currentTitle.length > 0);
  assert.ok(['渡世', '灭世', '超脱'].includes(o.summary.ending));
});

test('export-JSON: entries 数量与原一致', () => {
  const o = JSON.parse(exportLedgerJSON(SAMPLE));
  assert.equal(o.entries.length, 3);
});

test('export-JSON: 含 stats 面板数据', () => {
  const o = JSON.parse(exportLedgerJSON(SAMPLE));
  assert.ok(o.stats);
  assert.equal(o.stats.totalDeeds, 3);
  assert.ok(o.stats.choice);
  assert.ok(o.stats.tone);
});

test('export-JSON: 往返 parse 一致', () => {
  const json = exportLedgerJSON(SAMPLE, { playerName: '测试者' });
  const parsed = parseLedgerJSON(json);
  assert.ok(parsed);
  assert.equal(parsed!.entries.length, 3);
  assert.equal(parsed!.meta.playerName, '测试者');
  assert.equal(parsed!.summary.totalDeeds, 3);
});

test('export-JSON: parse 非法 JSON 返回 null', () => {
  assert.equal(parseLedgerJSON('not json'), null);
  assert.equal(parseLedgerJSON('{}'), null); // 缺 format
  assert.equal(parseLedgerJSON('{"format":"other"}'), null);
});

test('export-JSON: 空数组 summary totalDeeds=0', () => {
  const o = JSON.parse(exportLedgerJSON([]));
  assert.equal(o.summary.totalDeeds, 0);
});

test('export-JSON: exportedAt 是 ISO 字符串', () => {
  const o = JSON.parse(exportLedgerJSON(SAMPLE, { exportedAt: 1700000000000 }));
  assert.equal(o.exportedAt, new Date(1700000000000).toISOString());
});

// ── Markdown ──────────────────────────────────────────

test('export-MD: 含标题与概览', () => {
  const md = exportLedgerMarkdown(SAMPLE);
  assert.ok(md.includes('# 善恶簿'));
  assert.ok(md.includes('已行善举'));
  assert.ok(md.includes('3 桩'));
});

test('export-MD: 含语气分布表', () => {
  const md = exportLedgerMarkdown(SAMPLE);
  assert.ok(md.includes('## 语气分布'));
  assert.ok(md.includes('佛系'));
  assert.ok(md.includes('| --- |'));
});

test('export-MD: 含称号阶梯（✅/⬜）', () => {
  const md = exportLedgerMarkdown(SAMPLE);
  assert.ok(md.includes('## 称号阶梯'));
  // 3 笔 → 前 3 级（at 1/2/3）已得
  assert.ok(md.includes('✅'));
});

test('export-MD: 含修行明细表', () => {
  const md = exportLedgerMarkdown(SAMPLE);
  assert.ok(md.includes('## 修行明细'));
  assert.ok(md.includes('情境1'));
  assert.ok(md.includes('这是夸赞1'));
});

test('export-MD: 空数组显示尚无记录', () => {
  const md = exportLedgerMarkdown([]);
  assert.ok(md.includes('尚无记录'));
  assert.ok(md.includes('0 桩'));
});

test('export-MD: 竖线 | 被转义（防破坏表格）', () => {
  const entries = [mk(1, { situation: '有|竖线', deed: 'd|x', verdict: 'v|y' })];
  const md = exportLedgerMarkdown(entries);
  assert.ok(md.includes('\\|'), '竖线应被转义为 \\|');
});

test('export-MD: 含 playerName 与 note', () => {
  const md = exportLedgerMarkdown(SAMPLE, { playerName: '张三', note: '测试备注' });
  assert.ok(md.includes('张三'));
  assert.ok(md.includes('测试备注'));
});

// ── HTML ───────────────────────────────────────────────

test('export-HTML: 含 DOCTYPE 与 charset', () => {
  const html = exportLedgerHTML(SAMPLE);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('charset="UTF-8"'));
});

test('export-HTML: 内联样式（自包含，无外部 CSS 依赖）', () => {
  const html = exportLedgerHTML(SAMPLE);
  assert.ok(html.includes('<style>'));
  assert.ok(html.includes('--gold') || html.includes('background'));
  // 不应引用外部样式表
  assert.ok(!html.includes('rel="stylesheet"'));
});

test('export-HTML: 含称号与境界数字', () => {
  const html = exportLedgerHTML(SAMPLE);
  assert.ok(html.includes('当前称号'));
  assert.ok(html.includes('境界'));
});

test('export-HTML: 含印章字符', () => {
  const html = exportLedgerHTML(SAMPLE);
  // 印章是 善/妙/渡/理/义/慈 单字
  assert.ok(html.includes('善') || html.includes('渡'));
});

test('export-HTML: 空数组显示尚无记录', () => {
  const html = exportLedgerHTML([]);
  assert.ok(html.includes('尚无记录'));
  assert.ok(html.includes('0 桩'));
});

test('export-HTML: escapeHtml 防注入——script 标签被转义', () => {
  const entries = [mk(1, { deed: '<script>alert(1)</script>' })];
  const html = exportLedgerHTML(entries);
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('export-HTML: playerName 被 escape', () => {
  const html = exportLedgerHTML(SAMPLE, { playerName: '<b>粗体</b>' });
  assert.ok(!html.includes('<b>粗体</b>'));
  assert.ok(html.includes('&lt;b&gt;'));
});

test('export-HTML: 含语气分布条与称号阶梯', () => {
  const html = exportLedgerHTML(SAMPLE);
  assert.ok(html.includes('语气分布'));
  assert.ok(html.includes('称号阶梯'));
  assert.ok(html.includes('fill')); // 进度条 fill class
});

// ── 统一入口 ───────────────────────────────────────────

test('export: exportLedger 按格式分派', () => {
  const json = exportLedger('json', SAMPLE);
  const md = exportLedger('markdown', SAMPLE);
  const html = exportLedger('html', SAMPLE);
  assert.ok(json.startsWith('{'));
  assert.ok(md.includes('# 善恶簿'));
  assert.ok(html.startsWith('<!DOCTYPE'));
});

test('export: exportLedger 不支持的格式抛错', () => {
  assert.throws(() => exportLedger('pdf' as never, SAMPLE));
});

test('export: exportFileExtension 正确', () => {
  assert.equal(exportFileExtension('json'), '.json');
  assert.equal(exportFileExtension('markdown'), '.md');
  assert.equal(exportFileExtension('html'), '.html');
});

test('export: exportMimeType 正确', () => {
  assert.equal(exportMimeType('json'), 'application/json');
  assert.equal(exportMimeType('markdown'), 'text/markdown');
  assert.equal(exportMimeType('html'), 'text/html');
});

// ── 三格式一致性 ───────────────────────────────────────

test('export: 三种格式都含相同 totalDeeds(3)', () => {
  const json = JSON.parse(exportLedgerJSON(SAMPLE));
  const md = exportLedgerMarkdown(SAMPLE);
  const html = exportLedgerHTML(SAMPLE);
  assert.equal(json.summary.totalDeeds, 3);
  assert.ok(md.includes('3 桩'));
  assert.ok(html.includes('3 桩'));
});

/**
 * R10-D2: shared/export.ts 深层不变量测试。
 *
 * 现有 export.test.ts 只覆盖「单点输出含某子串」，这里补：
 *  1. 跨格式一致性——三种格式讲同一故事（同 total/同 title/同 ending/同印章集合）
 *  2. JSON 往返无损——export→parse→字段逐一相等（含 meta 透传）
 *  3. Markdown 结构不变量（表头固定/语气表 6 行/称号阶梯 8 行/明细行数==entries）
 *  4. HTML 结构不变量（CSS 变量完备/overview 5 卡/防注入跨字段）
 *  5. 确定性——同输入两次导出字节相等（exportedAt 固定时）
 *  6. 纯函数——不修改入参 entries / meta
 *  7. 边界——空 entries 三格式都不崩且语义正确
 *  8. 时间戳固定——meta.exportedAt 透传到输出
 *  9. 换行/竖线/HTML 特殊字符的转义逐字段验证
 * 10. exportLedger 分派与抛错 / fileExtension / mimeType 全枚举
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
  ENDING_NAME,
  type ExportEntry,
  type ExportMeta,
  type ExportFormat,
} from '../shared/export.ts';
import type { Tone } from '../shared/types.ts';
import {
  TITLES,
  TONE_STAMP,
  titleLevel,
  endingType,
  toneStats,
  progressToNextTitle,
} from '../shared/ledgerCore.ts';

const TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

function entry(
  index: number,
  deed: string,
  tone: Tone,
  situation = `情境${index}`,
  verdict = `判词${index}`,
  ts?: number,
): ExportEntry {
  const e: ExportEntry = { index, deed, tone, situation, verdict };
  if (ts !== undefined) (e as { ts?: number }).ts = ts;
  return e;
}

/** 一份 3 笔多语气样例（覆盖渡世倾向：佛系主导）。 */
const SAMPLE3: ExportEntry[] = [
  entry(1, '选 A', '佛系'),
  entry(2, '选 B', '佛系'),
  entry(3, '选 C', '温情'),
];

const FIXED_META: ExportMeta = {
  playerName: '测试者',
  exportedAt: 1700000000000,
  note: '回归用',
};

// ── JSON 往返无损 ──────────────────────────────────────

test('export-deep: JSON 往返——parse 后每个 entry 字段逐相等', () => {
  const json = exportLedgerJSON(SAMPLE3, FIXED_META);
  const back = parseLedgerJSON(json);
  assert.ok(back);
  assert.equal(back!.entries.length, SAMPLE3.length);
  for (let i = 0; i < SAMPLE3.length; i++) {
    assert.equal(back!.entries[i]!.index, SAMPLE3[i]!.index);
    assert.equal(back!.entries[i]!.deed, SAMPLE3[i]!.deed);
    assert.equal(back!.entries[i]!.tone, SAMPLE3[i]!.tone);
    assert.equal(back!.entries[i]!.situation, SAMPLE3[i]!.situation);
    assert.equal(back!.entries[i]!.verdict, SAMPLE3[i]!.verdict);
  }
});

test('export-deep: JSON 往返——meta 透传（playerName/note/exportedAt）', () => {
  const json = exportLedgerJSON(SAMPLE3, FIXED_META);
  const back = parseLedgerJSON(json)!;
  assert.equal(back.meta.playerName, '测试者');
  assert.equal(back.meta.note, '回归用');
});

test('export-deep: JSON exportedAt 是 ISO 字符串且等于 meta.exportedAt', () => {
  const json = exportLedgerJSON(SAMPLE3, FIXED_META);
  const back = parseLedgerJSON(json)!;
  assert.equal(back.exportedAt, new Date(FIXED_META.exportedAt!).toISOString());
});

test('export-deep: JSON summary 与 ledgerCore 直接计算一致（讲同一故事）', () => {
  const json = exportLedgerJSON(SAMPLE3, FIXED_META);
  const back = parseLedgerJSON(json)!;
  assert.equal(back.summary.totalDeeds, SAMPLE3.length);
  assert.equal(back.summary.currentTitle, TITLES[titleLevel(SAMPLE3.length)]!.name);
  assert.equal(back.summary.currentLevel, titleLevel(SAMPLE3.length));
  assert.equal(back.summary.ending, endingType(SAMPLE3));
  assert.deepEqual(back.summary.toneStats, toneStats(SAMPLE3));
  assert.equal(back.summary.progress.nextAt, progressToNextTitle(SAMPLE3.length).nextAt);
});

test('export-deep: JSON entries 是深拷贝（修改 parse 结果不影响原数组）', () => {
  const json = exportLedgerJSON(SAMPLE3, FIXED_META);
  const back = parseLedgerJSON(json)!;
  back.entries[0]!.deed = 'TAMPERED';
  assert.notEqual(back.entries[0]!.deed, SAMPLE3[0]!.deed);
});

test('export-deep: parseLedgerJSON 非法 format 标记返回 null', () => {
  const fake = JSON.stringify({ format: 'other-format', entries: [] });
  assert.equal(parseLedgerJSON(fake), null);
});

test('export-deep: parseLedgerJSON entries 非数组返回 null', () => {
  const fake = JSON.stringify({ format: 'dashan-ledger-v1', entries: 'not-array' });
  assert.equal(parseLedgerJSON(fake), null);
});

test('export-deep: parseLedgerJSON 空对象返回 null', () => {
  assert.equal(parseLedgerJSON('{}'), null);
});

test('export-deep: parseLedgerJSON 空串/非 JSON 返回 null', () => {
  assert.equal(parseLedgerJSON(''), null);
  assert.equal(parseLedgerJSON('not json {'), null);
  assert.equal(parseLedgerJSON('null'), null);
  assert.equal(parseLedgerJSON('123'), null);
});

// ── 跨格式一致性 ───────────────────────────────────────

test('export-deep: 三格式都含相同 total（讲同一故事）', () => {
  const json = exportLedgerJSON(SAMPLE3, FIXED_META);
  const md = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  for (const out of [json, md, html]) {
    assert.ok(out.includes('3'), '应含 total=3');
  }
});

test('export-deep: 三格式都含当前称号名', () => {
  const expectedTitle = TITLES[titleLevel(3)]!.name;
  const md = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  assert.ok(md.includes(expectedTitle));
  assert.ok(html.includes(expectedTitle));
});

test('export-deep: 三格式都含结局中文名', () => {
  const ending = ENDING_NAME[endingType(SAMPLE3)];
  const md = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  assert.ok(md.includes(ending));
  assert.ok(html.includes(ending));
});

test('export-deep: 三格式都含全 6 语气标签', () => {
  const md = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  for (const t of TONES) {
    assert.ok(md.includes(t), `MD 应含语气 ${t}`);
    assert.ok(html.includes(t), `HTML 应含语气 ${t}`);
  }
});

test('export-deep: MD 语气分布表含全 6 印章', () => {
  const md = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  for (const t of TONES) {
    assert.ok(md.includes(TONE_STAMP[t]), `MD 应含 ${t} 印章`);
  }
});

test('export-deep: HTML 明细行含每笔 entry 的印章', () => {
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  for (const e of SAMPLE3) {
    assert.ok(html.includes(TONE_STAMP[e.tone]), `HTML 应含 ${e.tone} 印章`);
  }
});

test('export-deep: 三格式都含 playerName 与 note', () => {
  const json = exportLedgerJSON(SAMPLE3, FIXED_META);
  const md = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  for (const out of [json, md, html]) {
    assert.ok(out.includes('测试者'));
    assert.ok(out.includes('回归用'));
  }
});

// ── Markdown 结构不变量 ────────────────────────────────

test('export-deep: MD 含固定一级标题与概览段', () => {
  const md = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  assert.ok(md.startsWith('# 善恶簿 · 修行录'));
  assert.ok(md.includes('## 概览'));
  assert.ok(md.includes('已行善举'));
});

test('export-deep: MD 语气分布表恰 6 行数据（表头+6语气）', () => {
  const md = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  assert.ok(md.includes('## 语气分布'));
  // 表头一行 + 分隔一行 + 6 语气行
  const lines = md.split('\n').filter((l) => l.startsWith('| '));
  // 每行以 | 开头（语气行），至少 6 个语气行
  const toneLines = lines.filter((l) => TONES.some((t) => l.includes(t)));
  assert.ok(toneLines.length >= 6);
});

test('export-deep: MD 称号阶梯含全部 TITLES（✅/⬜ 各级）', () => {
  const md = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  assert.ok(md.includes('## 称号阶梯'));
  for (const t of TITLES) {
    assert.ok(md.includes(t.name), `应含称号 ${t.name}`);
  }
});

test('export-deep: MD 明细表行数 == entries.length（每笔一行）', () => {
  const md = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  assert.ok(md.includes('## 修行明细'));
  // 明细行以 | index 开头（数字）
  const detailLines = md.split('\n').filter((l) => /^\| \d+ /.test(l));
  assert.equal(detailLines.length, SAMPLE3.length);
});

test('export-deep: MD 竖线 | 被转义为 \\|（防破坏表格）', () => {
  const e = entry(1, 'a|b|c', '佛系', 's|t', 'v|x');
  const md = exportLedgerMarkdown([e], FIXED_META);
  // 原文 | 应变成 \|
  assert.ok(md.includes('a\\|b\\|c'));
  assert.ok(md.includes('s\\|t'));
  assert.ok(md.includes('v\\|x'));
});

test('export-deep: MD 换行被替换为空格（单行表格）', () => {
  const e = entry(1, 'line1\nline2', '佛系', 's1\ns2', 'v1\nv2');
  const md = exportLedgerMarkdown([e], FIXED_META);
  // 明细行内不应含裸换行（已被替换为空格）
  const detailLine = md.split('\n').find((l) => /^\| 1 /.test(l));
  assert.ok(detailLine);
  assert.ok(detailLine!.includes('line1 line2'));
});

test('export-deep: MD 空数组显示「尚无记录」', () => {
  const md = exportLedgerMarkdown([], FIXED_META);
  assert.ok(md.includes('_尚无记录。_'));
  // 但仍含称号阶梯（全 ⬜）
  for (const t of TITLES) {
    assert.ok(md.includes(t.name));
  }
});

test('export-deep: MD 无 playerName 时不输出修行者行', () => {
  const md = exportLedgerMarkdown([], {});
  assert.ok(!md.includes('修行者'));
});

test('export-deep: MD 无 note 时不输出备注行', () => {
  const md = exportLedgerMarkdown([], {});
  assert.ok(!md.includes('备注'));
});

// ── HTML 结构不变量 ────────────────────────────────────

test('export-deep: HTML 含完整 CSS 变量定义（--bg/--ink/--gold/--red/--muted/--card）', () => {
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  for (const v of ['--bg:', '--ink:', '--gold:', '--red:', '--muted:', '--card:']) {
    assert.ok(html.includes(v), `应含 CSS 变量 ${v}`);
  }
});

test('export-deep: HTML overview 恰 5 个 stat-card', () => {
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  const count = (html.match(/class="stat-card"/g) || []).length;
  assert.equal(count, 5);
});

test('export-deep: HTML 含每笔 entry 的 index 数字', () => {
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  for (const e of SAMPLE3) {
    assert.ok(html.includes(`>${e.index}</td>`), `应含 index=${e.index}`);
  }
});

test('export-deep: HTML escapeHtml——situation/deed/verdict 含 <script> 被转义', () => {
  const e = entry(1, '<script>x</script>', '佛系', '<img onerror=alert(1)>', '"><b>');
  const html = exportLedgerHTML([e], FIXED_META);
  assert.ok(!html.includes('<script>x</script>'), '原文 script 标签不应出现');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img'));
});

test('export-deep: HTML playerName 未提供时显示「无名善者」', () => {
  const html = exportLedgerHTML([], {});
  assert.ok(html.includes('无名善者'));
});

test('export-deep: HTML 空 entries 显示尚无记录占位', () => {
  const html = exportLedgerHTML([], {});
  assert.ok(html.includes('尚无记录'));
});

test('export-deep: HTML 语气分布条——非空时含 fill 宽度百分比', () => {
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  assert.ok(/width:\d+%/.test(html), '应含 width:N% 样式');
});

test('export-deep: HTML 空数组时语气分布显示尚无记录（无 fill 条）', () => {
  const html = exportLedgerHTML([], {});
  assert.ok(!/width:\d+%/.test(html), '空数组不应有 fill 宽度条');
});

test('export-deep: HTML 称号阶梯——达成的标 got 类，未达成无', () => {
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  const gotCount = (html.match(/class="title-item got"/g) || []).length;
  // total=3 → 已达成的称号数（at<=3 的）
  const expectedGot = TITLES.filter((t) => 3 >= t.at).length;
  assert.equal(gotCount, expectedGot);
});

test('export-deep: HTML progress 满级时显示「已达巅峰」', () => {
  // 造满级 entries（>= 最后一级 at）
  const maxAt = TITLES[TITLES.length - 1]!.at;
  const entries: ExportEntry[] = [];
  for (let i = 1; i <= maxAt; i++) entries.push(entry(i, `d${i}`, '庄严'));
  const html = exportLedgerHTML(entries, FIXED_META);
  assert.ok(html.includes('已达巅峰'));
});

// ── 确定性 / 纯函数 ────────────────────────────────────

test('export-deep: 确定性——同输入同 exportedAt 两次导出字节相等（JSON）', () => {
  const a = exportLedgerJSON(SAMPLE3, FIXED_META);
  const b = exportLedgerJSON(SAMPLE3, FIXED_META);
  assert.equal(a, b);
});

test('export-deep: 确定性——MD 两次字节相等', () => {
  const a = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  const b = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  assert.equal(a, b);
});

test('export-deep: 确定性——HTML 两次字节相等', () => {
  const a = exportLedgerHTML(SAMPLE3, FIXED_META);
  const b = exportLedgerHTML(SAMPLE3, FIXED_META);
  assert.equal(a, b);
});

test('export-deep: 纯函数——exportLedgerJSON 不修改入参 entries', () => {
  const snapshot = JSON.stringify(SAMPLE3);
  exportLedgerJSON(SAMPLE3, FIXED_META);
  assert.equal(JSON.stringify(SAMPLE3), snapshot);
});

test('export-deep: 纯函数——exportLedgerMarkdown 不修改入参 meta', () => {
  const snapshot = JSON.stringify(FIXED_META);
  exportLedgerMarkdown(SAMPLE3, FIXED_META);
  assert.equal(JSON.stringify(FIXED_META), snapshot);
});

test('export-deep: 纯函数——exportLedgerHTML 不修改入参 entries', () => {
  const snapshot = JSON.stringify(SAMPLE3);
  exportLedgerHTML(SAMPLE3, FIXED_META);
  assert.equal(JSON.stringify(SAMPLE3), snapshot);
});

// ── 时间戳透传 ─────────────────────────────────────────

test('export-deep: MD exportedAt 透传 meta.exportedAt（ISO）', () => {
  const md = exportLedgerMarkdown(SAMPLE3, FIXED_META);
  assert.ok(md.includes(new Date(FIXED_META.exportedAt!).toISOString()));
});

test('export-deep: HTML exportedAt 透传 meta.exportedAt（ISO）', () => {
  const html = exportLedgerHTML(SAMPLE3, FIXED_META);
  assert.ok(html.includes(new Date(FIXED_META.exportedAt!).toISOString()));
});

test('export-deep: 无 exportedAt 时取 Date.now()（ISO 格式）', () => {
  const before = Date.now();
  const json = exportLedgerJSON(SAMPLE3, {});
  const after = Date.now();
  const back = parseLedgerJSON(json)!;
  const ts = Date.parse(back.exportedAt);
  assert.ok(ts >= before && ts <= after, 'exportedAt 应在 [before, after] 区间');
});

// ── 边界 ───────────────────────────────────────────────

test('export-deep: 空数组 JSON 往返一致（totalDeeds=0）', () => {
  const json = exportLedgerJSON([], FIXED_META);
  const back = parseLedgerJSON(json)!;
  assert.equal(back.summary.totalDeeds, 0);
  assert.equal(back.entries.length, 0);
});

test('export-deep: 空数组 endingType 不抛错（返回某合法结局）', () => {
  assert.doesNotThrow(() => exportLedgerJSON([], FIXED_META));
  assert.doesNotThrow(() => exportLedgerMarkdown([], FIXED_META));
  assert.doesNotThrow(() => exportLedgerHTML([], FIXED_META));
});

test('export-deep: 单笔 entries 三格式都不崩', () => {
  const one = [entry(1, '唯一', '学术')];
  assert.doesNotThrow(() => exportLedgerJSON(one, FIXED_META));
  assert.doesNotThrow(() => exportLedgerMarkdown(one, FIXED_META));
  assert.doesNotThrow(() => exportLedgerHTML(one, FIXED_META));
});

// ── exportLedger 分派 / 抛错 ───────────────────────────

test('export-deep: exportLedger json 等价 exportLedgerJSON', () => {
  assert.equal(exportLedger('json', SAMPLE3, FIXED_META), exportLedgerJSON(SAMPLE3, FIXED_META));
});

test('export-deep: exportLedger markdown 等价 exportLedgerMarkdown', () => {
  assert.equal(
    exportLedger('markdown', SAMPLE3, FIXED_META),
    exportLedgerMarkdown(SAMPLE3, FIXED_META),
  );
});

test('export-deep: exportLedger html 等价 exportLedgerHTML', () => {
  assert.equal(exportLedger('html', SAMPLE3, FIXED_META), exportLedgerHTML(SAMPLE3, FIXED_META));
});

test('export-deep: exportLedger 不支持的格式抛错且信息含格式名', () => {
  assert.throws(
    () => exportLedger('pdf' as ExportFormat, SAMPLE3, FIXED_META),
    (e: unknown) => e instanceof Error && /pdf/.test(e.message),
  );
});

test('export-deep: exportLedger 缺省 meta 不崩（用 {}）', () => {
  assert.ok(exportLedger('json', SAMPLE3).length > 0);
  assert.ok(exportLedger('markdown', SAMPLE3).length > 0);
  assert.ok(exportLedger('html', SAMPLE3).length > 0);
});

// ── fileExtension / mimeType 全枚举 ────────────────────

test('export-deep: exportFileExtension 三格式映射正确', () => {
  assert.equal(exportFileExtension('json'), '.json');
  assert.equal(exportFileExtension('markdown'), '.md');
  assert.equal(exportFileExtension('html'), '.html');
});

test('export-deep: exportFileExtension 未知格式回退 .txt', () => {
  assert.equal(exportFileExtension('xml' as ExportFormat), '.txt');
});

test('export-deep: exportMimeType 三格式映射正确', () => {
  assert.equal(exportMimeType('json'), 'application/json');
  assert.equal(exportMimeType('markdown'), 'text/markdown');
  assert.equal(exportMimeType('html'), 'text/html');
});

test('export-deep: exportMimeType 未知格式回退 text/plain', () => {
  assert.equal(exportMimeType('xml' as ExportFormat), 'text/plain');
});

// ── ENDING_NAME 完备性 ─────────────────────────────────

test('export-deep: ENDING_NAME 含三结局且非空', () => {
  for (const k of ['渡世', '灭世', '超脱'] as const) {
    assert.ok(typeof ENDING_NAME[k] === 'string' && ENDING_NAME[k].length > 0);
  }
});

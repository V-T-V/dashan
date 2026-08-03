/**
 * 大善系统 —— 修行时间线 高级测试（时间线排序/过滤/搜索/统计）。
 *
 * 覆盖 round 8 新关注点：
 *  - 乱序输入排序：buildTimeline 按 index 正序，不依赖调用方排序
 *  - 过滤：promotionMilestones 只取晋升节点
 *  - 搜索：基于节点的关键词匹配（辅助函数）
 *  - 统计：promotions / ending / 各 tone 分布
 *  - 边界：空数组、单条、含 ts、越界 index
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTimeline,
  renderTimelineText,
  renderTimelineAnsi,
  promotionMilestones,
  timelineSummary,
  exportTimelineCompact,
} from '../shared/history.ts';
import { TITLES, endingType, titleLevel } from '../shared/ledgerCore.ts';
import type { LedgerEntry } from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

function entry(index: number, deed: string, tone: Tone, ts?: number): LedgerEntry {
  const e: LedgerEntry = {
    index,
    situation: `情境${index}`,
    deed,
    verdict: `夸赞${index}`,
    tone,
  };
  if (ts !== undefined) (e as LedgerEntry & { ts?: number }).ts = ts;
  return e;
}

// ── 乱序输入排序 ─────────────────────────────────────────

test('高级: buildTimeline 对乱序 entries 按 index 正序', () => {
  const entries = [
    entry(3, 'c', '佛系'),
    entry(1, 'a', '庄严'),
    entry(2, 'b', '温情'),
  ];
  const tl = buildTimeline(entries);
  assert.deepEqual(
    tl.nodes.map((n) => n.index),
    [1, 2, 3],
  );
});

test('高级: buildTimeline 对逆序输入也恢复正序', () => {
  const entries = [entry(5, 'e', '江湖'), entry(4, 'd', '学术'), entry(1, 'a', '庄严')];
  const tl = buildTimeline(entries);
  assert.deepEqual(
    tl.nodes.map((n) => n.index),
    [1, 4, 5],
  );
});

// ── 过滤：promotionMilestones ─────────────────────────────

test('高级: promotionMilestones 只含 promoted=true 的节点', () => {
  // 10 笔，TITLES 阈值 1/2/3/4/5/6/8/10 → 在 1,2,3,4,5,6,8,10 处晋升
  const entries: LedgerEntry[] = [];
  for (let i = 1; i <= 10; i++) entries.push(entry(i, `d${i}`, '庄严'));
  const tl = buildTimeline(entries);
  const ms = promotionMilestones(tl);
  // 所有 milestone 节点都应 promoted
  assert.ok(ms.every((n) => n.promoted));
  // 应含全部 8 个阈值点（每次 at 达到都是晋升）
  assert.equal(ms.length, TITLES.length);
});

test('高级: promotionMilestones 单笔 entries 恒为 1（首笔即册封）', () => {
  const tl = buildTimeline([entry(1, 'a', '庄严')]);
  assert.equal(promotionMilestones(tl).length, 1);
});

test('高级: promotionMilestones 空时间线返回空', () => {
  assert.deepEqual(promotionMilestones(buildTimeline([])), []);
});

// ── 搜索：基于节点的关键词匹配 ─────────────────────────────

/** 辅助：在时间线里搜 deed/situation/verdict 含关键词的节点。 */
function searchTimeline(tl: ReturnType<typeof buildTimeline>, kw: string): typeof tl.nodes {
  const k = kw.trim();
  if (!k) return tl.nodes;
  return tl.nodes.filter(
    (n) => n.deed.includes(k) || n.situation.includes(k) || n.verdict.includes(k),
  );
}

test('高级: 搜索 deed 命中', () => {
  const tl = buildTimeline([entry(1, '救孤女', '温情'), entry(2, '举报上司', '庄严')]);
  const r = searchTimeline(tl, '孤女');
  assert.equal(r.length, 1);
  assert.equal(r[0]!.index, 1);
});

test('高级: 搜索 verdict 命中', () => {
  const tl = buildTimeline([entry(1, 'a', '庄严')]); // verdict="夸赞1"
  const r = searchTimeline(tl, '夸赞');
  assert.equal(r.length, 1);
});

test('高级: 搜索空关键词返回全部', () => {
  const tl = buildTimeline([entry(1, 'a', '庄严'), entry(2, 'b', '佛系')]);
  assert.equal(searchTimeline(tl, '').length, 2);
});

test('高级: 搜索无命中返回空', () => {
  const tl = buildTimeline([entry(1, 'a', '庄严')]);
  assert.equal(searchTimeline(tl, '不存在的词').length, 0);
});

// ── 统计：tone 分布 / ending / promotions 计数 ─────────────

test('高级: timeline.ending 与 ledgerCore.endingType 一致', () => {
  const entries: LedgerEntry[] = [
    entry(1, 'a', '佛系'),
    entry(2, 'b', '温情'),
    entry(3, 'c', '佛系'),
  ];
  const tl = buildTimeline(entries);
  assert.equal(tl.ending, endingType(entries));
});

test('高级: promotions 计数等于 promotionMilestones 长度', () => {
  const entries: LedgerEntry[] = [];
  for (let i = 1; i <= 8; i++) entries.push(entry(i, `d${i}`, '庄严'));
  const tl = buildTimeline(entries);
  assert.equal(tl.promotions, promotionMilestones(tl).length);
});

test('高级: currentLevel 与 ledgerCore.titleLevel(total) 一致', () => {
  for (const total of [0, 1, 3, 5, 7, 10]) {
    const entries: LedgerEntry[] = [];
    for (let i = 1; i <= total; i++) entries.push(entry(i, `d${i}`, '庄严'));
    const tl = buildTimeline(entries);
    assert.equal(tl.currentLevel, titleLevel(total));
    assert.equal(tl.total, total);
  }
});

test('高级: 当前称号名与 currentLevel 对应', () => {
  const tl = buildTimeline([entry(1, 'a', '庄严'), entry(2, 'b', '佛系')]);
  // 2 笔 → level 1（怀善之人）
  assert.equal(tl.currentLevel, 1);
  assert.equal(tl.currentTitle, TITLES[1]!.name);
});

// ── 渲染：maxLineLength 截断 ─────────────────────────────

test('高级: renderTimelineText(maxLineLength) 截断超长 deed', () => {
  const long = '超'.repeat(100);
  const tl = buildTimeline([entry(1, long, '庄严')]);
  const txt = renderTimelineText(tl, { maxLineLength: 20 });
  assert.ok(txt.includes('…'));
});

test('高级: renderTimelineText 空时间线有占位文案', () => {
  const txt = renderTimelineText(buildTimeline([]));
  assert.ok(txt.includes('尚无记录'));
});

test('高级: renderTimelineAnsi 含 ANSI 颜色码', () => {
  const tl = buildTimeline([entry(1, 'a', '庄严')]);
  const ansi = renderTimelineAnsi(tl);
  assert.ok(ansi.includes('\x1b['), '应含 ANSI 转义码');
  assert.ok(ansi.includes('修行时间线'));
});

// ── 导出：exportTimelineCompact ────────────────────────────

test('高级: exportTimelineCompact 保留 milestones 与 total', () => {
  const entries: LedgerEntry[] = [];
  for (let i = 1; i <= 5; i++) entries.push(entry(i, `d${i}`, '庄严'));
  const tl = buildTimeline(entries);
  const compact = exportTimelineCompact(tl);
  assert.equal(compact.total, 5);
  assert.equal(compact.milestones.length, 5);
  assert.ok(compact.milestones.every((m) => typeof m.deed === 'string'));
});

test('高级: exportTimelineCompact 含 ts（若原 entry 带 ts）', () => {
  const tl = buildTimeline([entry(1, 'a', '庄严', 1700000000000)]);
  const compact = exportTimelineCompact(tl);
  assert.equal(compact.milestones[0]!.ts, 1700000000000);
});

test('高级: exportTimelineCompact 缺 ts 时为 undefined', () => {
  const tl = buildTimeline([entry(1, 'a', '庄严')]);
  const compact = exportTimelineCompact(tl);
  assert.equal(compact.milestones[0]!.ts, undefined);
});

// ── 摘要：timelineSummary ─────────────────────────────────

test('高级: timelineSummary 含笔数/册封/称号/结局', () => {
  const tl = buildTimeline([entry(1, 'a', '庄严'), entry(2, 'b', '佛系')]);
  const s = timelineSummary(tl);
  assert.ok(s.includes('2'));
  assert.ok(s.includes('册封'));
  assert.ok(s.includes(tl.currentTitle));
});

test('高级: timelineSummary 空时间线返回「尚未行善」', () => {
  assert.equal(timelineSummary(buildTimeline([])), '尚未行善');
});

// ── 晋升标记：titleNameAtDeed / promotedTo ────────────────

test('高级: 首笔 promotedTo 为「初入善门者」', () => {
  const tl = buildTimeline([entry(1, 'a', '庄严')]);
  assert.equal(tl.nodes[0]!.promoted, true);
  assert.equal(tl.nodes[0]!.promotedTo, TITLES[0]!.name);
  assert.equal(tl.nodes[0]!.titleNameAtDeed, TITLES[0]!.name);
});

test('高级: 非晋升笔 promotedTo 为空串', () => {
  // 7 笔不触发晋升（6→6，因为下一个阈值是 8）
  const entries: LedgerEntry[] = [];
  for (let i = 1; i <= 7; i++) entries.push(entry(i, `d${i}`, '庄严'));
  const tl = buildTimeline(entries);
  const node7 = tl.nodes.find((n) => n.index === 7);
  assert.ok(node7);
  assert.equal(node7!.promoted, false);
  assert.equal(node7!.promotedTo, '');
});

test('高级: 8 笔处再次晋升到「至善尊者」', () => {
  const entries: LedgerEntry[] = [];
  for (let i = 1; i <= 8; i++) entries.push(entry(i, `d${i}`, '庄严'));
  const tl = buildTimeline(entries);
  const node8 = tl.nodes.find((n) => n.index === 8);
  assert.ok(node8);
  assert.equal(node8!.promoted, true);
  assert.equal(node8!.promotedTo, TITLES[6]!.name); // at=8 对应 TITLES[6]
});

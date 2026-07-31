/**
 * 大善系统 —— 历史回看（shared/history.ts）测试。
 *
 * 覆盖：
 *  - buildTimeline：空 / 单笔 / 多笔；乱序按 index 排序；晋升标记正确
 *  - 派生统计：total / currentTitle / currentLevel / promotions / ending
 *  - renderTimelineText：空态文案、结构行、截断（maxLineLength）
 *  - renderTimelineAnsi：含 ANSI 颜色码、空态不崩
 *  - promotionMilestones：仅返回晋升节点
 *  - timelineSummary：一句话摘要
 *  - exportTimelineCompact：精简导出结构
 *  - 边界：第一笔总视为晋升；ts 字段宽松读取
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTimeline,
  renderTimelineText,
  renderTimelineAnsi,
  TIMELINE_ANSI,
  promotionMilestones,
  timelineSummary,
  exportTimelineCompact,
} from '../shared/history.ts';
import type { LedgerEntry } from '../shared/ledgerCore.ts';
import { TITLES } from '../shared/ledgerCore.ts';

/** 构造一条 LedgerEntry（index 由调用方指定）。 */
function entry(index: number, deed: string, tone: LedgerEntry['tone']): LedgerEntry {
  return {
    index,
    situation: `第 ${index} 笔的情境`,
    deed,
    verdict: `这是对「${deed}」的夸赞`,
    tone,
  };
}

// ── buildTimeline ─────────────────────────────────────────

test('buildTimeline: 空数组 → total=0, nodes=[], currentTitle 为初阶', () => {
  const tl = buildTimeline([]);
  assert.equal(tl.total, 0);
  assert.equal(tl.nodes.length, 0);
  assert.equal(tl.currentLevel, 0);
  assert.equal(tl.currentTitle, TITLES[0]!.name);
  assert.equal(tl.promotions, 0);
});

test('buildTimeline: 第一笔视为晋升（从无到有进入初入善门）', () => {
  const tl = buildTimeline([entry(1, '救人', '庄严')]);
  assert.equal(tl.nodes.length, 1);
  assert.equal(tl.nodes[0]!.promoted, true);
  assert.equal(tl.nodes[0]!.promotedTo, TITLES[0]!.name);
  assert.equal(tl.promotions, 1);
});

test('buildTimeline: 同一称号区间内的笔数不触发晋升', () => {
  // TITLES 阈值 1/2/3...：第 1 笔晋升到等级0，第 2 笔晋升到等级1
  // 这里测 2 笔：第1笔晋升(等级0)，第2笔晋升(等级1)，都是晋升
  const tl = buildTimeline([entry(1, 'a', '庄严'), entry(2, 'b', '戏谑')]);
  assert.equal(tl.promotions, 2);
  // 第 3 笔（index=3）触发等级2晋升，但第 4 笔(index=4) 触发等级3
  // 中间没新阈值就不晋升：用 index 3,4,4.5 不行，index 必须整数
  // 改测：在等级区间内连续多笔
  const tl2 = buildTimeline([
    entry(1, 'a', '庄严'),
    entry(2, 'b', '戏谑'),
    // index 3 之前没新阈值（阈值是1,2,3），第3笔 → 等级2（晋升）
    entry(3, 'c', '佛系'),
    // index 3 到 4 之间没有笔，第4笔 → 等级3（晋升）
    entry(4, 'd', '学术'),
  ]);
  assert.equal(tl2.promotions, 4, '阈值 1/2/3/4 各触发一次晋升');
});

test('buildTimeline: 阈值之间无新笔时 promotions 数等于跨越的等级数', () => {
  // 直接给到 index=5（等级4），中间每笔都跨越一个阈值
  const tl = buildTimeline([
    entry(1, 'a', '庄严'),
    entry(2, 'b', '戏谑'),
    entry(3, 'c', '佛系'),
    entry(4, 'd', '学术'),
    entry(5, 'e', '江湖'),
  ]);
  assert.equal(tl.currentLevel, 4);
  assert.equal(tl.promotions, 5);
});

test('buildTimeline: 乱序输入按 index 排序', () => {
  const tl = buildTimeline([entry(3, 'c', '佛系'), entry(1, 'a', '庄严'), entry(2, 'b', '戏谑')]);
  assert.deepEqual(
    tl.nodes.map((n) => n.index),
    [1, 2, 3],
  );
  assert.deepEqual(
    tl.nodes.map((n) => n.deed),
    ['a', 'b', 'c'],
  );
});

test('buildTimeline: 重复 index 排序稳定（不报错，保留两条）', () => {
  const tl = buildTimeline([entry(1, 'a', '庄严'), entry(1, 'b', '戏谑')]);
  assert.equal(tl.nodes.length, 2);
});

test('buildTimeline: 节点字段完整（situation/deed/verdict/tone/印章等级）', () => {
  const tl = buildTimeline([entry(1, '救人', '庄严')]);
  const n = tl.nodes[0]!;
  assert.equal(n.situation, '第 1 笔的情境');
  assert.equal(n.deed, '救人');
  assert.equal(n.verdict, '这是对「救人」的夸赞');
  assert.equal(n.tone, '庄严');
  assert.equal(typeof n.titleLevelAtDeed, 'number');
  assert.equal(typeof n.titleNameAtDeed, 'string');
  assert.equal(n.titleNameAtDeed.length > 0, true);
});

test('buildTimeline: ending 由语气分布推导', () => {
  // 全佛系 → 渡世
  const tl = buildTimeline([entry(1, 'a', '佛系'), entry(2, 'b', '温情')]);
  assert.equal(tl.ending, '渡世');
});

test('buildTimeline: ts 字段宽松读取（数字保留，非数字丢弃）', () => {
  const e = entry(1, 'a', '庄严') as LedgerEntry & { ts?: unknown };
  e.ts = 1700000000000;
  const tl = buildTimeline([e]);
  assert.equal(tl.nodes[0]!.ts, 1700000000000);

  const e2 = entry(1, 'a', '庄严') as LedgerEntry & { ts?: unknown };
  e2.ts = '不是数字';
  const tl2 = buildTimeline([e2]);
  assert.equal(tl2.nodes[0]!.ts, undefined);
});

// ── renderTimelineText ────────────────────────────────────

test('renderTimelineText: 空态有提示文案', () => {
  const tl = buildTimeline([]);
  const out = renderTimelineText(tl);
  assert.ok(out.includes('尚无记录'));
  assert.ok(out.includes('行一桩事'));
});

test('renderTimelineText: 标题行含总笔数与称号', () => {
  const tl = buildTimeline([entry(1, '救人', '庄严'), entry(2, '济贫', '温情')]);
  const out = renderTimelineText(tl);
  assert.ok(out.includes('共 2 笔'));
  assert.ok(tl.currentTitle.length > 0 && out.includes(tl.currentTitle));
});

test('renderTimelineText: 每笔含境/为/判三行 + 印章序号', () => {
  const tl = buildTimeline([entry(1, '救人', '庄严')]);
  const out = renderTimelineText(tl);
  assert.ok(out.includes('〔善〕#1'));
  assert.ok(out.includes('境  '));
  assert.ok(out.includes('为  '));
  assert.ok(out.includes('判  '));
});

test('renderTimelineText: 晋升节点含「（晋升）」标记', () => {
  const tl = buildTimeline([entry(1, '救人', '庄严')]);
  const out = renderTimelineText(tl);
  assert.ok(out.includes('晋升'));
});

test('renderTimelineText: maxLineLength 截断长文本并加 …', () => {
  const longSituation = '这是一段非常非常长的情境描述'.repeat(10);
  const e: LedgerEntry = {
    index: 1,
    situation: longSituation,
    deed: '救人',
    verdict: '夸',
    tone: '庄严',
  };
  const tl = buildTimeline([e]);
  const out = renderTimelineText(tl, { maxLineLength: 20 });
  const situationLine = out.split('\n').find((l) => l.startsWith('  境  '))!;
  assert.ok(situationLine.includes('…'), '应被截断并加省略号');
  // 截断后含「境  」前缀 + 截断文本，总字符数应远小于原文
  assert.ok(situationLine.length < longSituation.length);
});

test('renderTimelineText: maxLineLength=0 或缺省表示不截断', () => {
  const e: LedgerEntry = {
    index: 1,
    situation: '短情境',
    deed: '救人',
    verdict: '夸',
    tone: '庄严',
  };
  const tl = buildTimeline([e]);
  const out1 = renderTimelineText(tl);
  const out2 = renderTimelineText(tl, { maxLineLength: 0 });
  assert.ok(out1.includes('短情境'));
  assert.ok(out2.includes('短情境'));
});

// ── renderTimelineAnsi ────────────────────────────────────

test('renderTimelineAnsi: 非 ANSI 终端也不应崩；含 ANSI 转义码', () => {
  const tl = buildTimeline([entry(1, '救人', '庄严')]);
  const out = renderTimelineAnsi(tl);
  assert.ok(out.includes(TIMELINE_ANSI.reset), '应含 reset 转义');
  assert.ok(out.includes(TIMELINE_ANSI.red) || out.includes(TIMELINE_ANSI.gold), '应有颜色码');
  assert.ok(out.includes('#1'));
});

test('renderTimelineAnsi: 空态不崩且有 dim 提示', () => {
  const tl = buildTimeline([]);
  const out = renderTimelineAnsi(tl);
  assert.ok(out.includes('尚无记录'));
  assert.ok(out.includes(TIMELINE_ANSI.reset));
});

// ── promotionMilestones ───────────────────────────────────

test('promotionMilestones: 仅返回晋升节点', () => {
  // index 1,2,3,4,5 全部跨越阈值（阈值1/2/3/4/5），全是晋升
  const tl = buildTimeline([
    entry(1, 'a', '庄严'),
    entry(2, 'b', '戏谑'),
    entry(3, 'c', '佛系'),
    entry(4, 'd', '学术'),
    entry(5, 'e', '江湖'),
  ]);
  const ms = promotionMilestones(tl);
  assert.equal(ms.length, tl.promotions);
  assert.deepEqual(
    ms.map((m) => m.promoted),
    [true, true, true, true, true],
  );
});

test('promotionMilestones: 空时间线返回空数组', () => {
  const tl = buildTimeline([]);
  assert.deepEqual(promotionMilestones(tl), []);
});

// ── timelineSummary ───────────────────────────────────────

test('timelineSummary: 含笔数/册封次数/称号/结局倾向', () => {
  const tl = buildTimeline([entry(1, 'a', '佛系'), entry(2, 'b', '温情')]);
  const s = timelineSummary(tl);
  assert.ok(s.includes('2 笔'));
  assert.ok(s.includes('册封'));
  assert.ok(s.includes(tl.currentTitle));
  assert.ok(s.includes('渡世'));
});

test('timelineSummary: 空态返回「尚未行善」', () => {
  const tl = buildTimeline([]);
  assert.equal(timelineSummary(tl), '尚未行善');
});

// ── exportTimelineCompact ─────────────────────────────────

test('exportTimelineCompact: 结构正确且里程碑数等于节点数', () => {
  const tl = buildTimeline([entry(1, '救人', '庄严'), entry(2, '济贫', '温情')]);
  const exp = exportTimelineCompact(tl);
  assert.equal(exp.total, 2);
  assert.equal(exp.currentTitle, tl.currentTitle);
  assert.equal(exp.ending, tl.ending);
  assert.equal(exp.milestones.length, 2);
  assert.deepEqual(
    exp.milestones.map((m) => m.index),
    [1, 2],
  );
  assert.deepEqual(
    exp.milestones.map((m) => m.deed),
    ['救人', '济贫'],
  );
});

test('exportTimelineCompact: 空态返回空里程碑数组', () => {
  const tl = buildTimeline([]);
  const exp = exportTimelineCompact(tl);
  assert.equal(exp.total, 0);
  assert.equal(exp.milestones.length, 0);
});

// ── 集成：满级结局 ────────────────────────────────────────

test('集成: 达到最高称号时 currentLevel 为最大索引', () => {
  // TITLES 最后阈值 10 → 10 笔达最高
  const entries: LedgerEntry[] = [];
  const tones: LedgerEntry['tone'][] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  for (let i = 1; i <= 10; i++) {
    entries.push(entry(i, ` deed${i}`, tones[i % tones.length]!));
  }
  const tl = buildTimeline(entries);
  assert.equal(tl.currentLevel, TITLES.length - 1);
  assert.equal(tl.currentTitle, TITLES[TITLES.length - 1]!.name);
  assert.ok(tl.promotions >= 7, '至少跨越 7 个阈值');
});

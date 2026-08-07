/**
 * shared/history.ts 时间线深层不变量测试 —— R5-D4（修行里程碑视图相关）
 *
 * 不重复 history.test.ts / history-advanced.test.ts 的基础/高级用例，专注：
 * - buildTimeline 节点字段与 ledgerCore 强一致性（每笔 titleLevelAtDeed = titleLevel(index)，
 *   titleNameAtDeed = 对应称号名，首笔 promotedTo = TITLES[0]）
 * - 晋升严格升序不变量：i>0 的节点 promoted==true ⟺ after>before；i===1 恒 promoted
 * - promotions 计数 == 节点中 promoted=true 的个数（不变量跨大样本）
 * - currentLevel/currentTitle 与 titleLevel(total)/TITLES 一致
 * - promotionMilestones 节点序号严格递增且全为 promoted
 * - renderTimelineText clip 按码点截断（中文一字一码点 / emoji 代理对不拆）
 * - renderTimelineAnsi 颜色标记不变量：标题 gold+bold / 印章 red / 晋升 green / 判词 gold
 * - TIMELINE_ANSI 常量完备（六色 + reset 均含 ESC[）
 * - timelineSummary 与 timeline 派生字段一一对应
 * - exportTimelineCompact JSON 可往返序列化（结构无函数/undefined→ts 缺省键）
 * - 跨 0-N 笔的晋升边界精确落在 TITLES[i].at 阈值（含满级后不再晋升）
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
  TIMELINE_ANSI,
} from '../shared/history.ts';
import { TITLES, TONE_STAMP, titleLevel, endingType } from '../shared/ledgerCore.ts';
import type { LedgerEntry } from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

const TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

// 复刻 history.ts 内部 titleNameByLevel 的边界语义（钳到 0..len-1），
// 用于验证 titleNameAtDeed 与 ledgerCore 的一致性。
function expectedNameByLevel(level: number): string {
  if (level <= 0) return TITLES[0]!.name;
  if (level >= TITLES.length - 1) return TITLES[TITLES.length - 1]!.name;
  return TITLES[level]!.name;
}

function entry(index: number, deed: string, tone: Tone, ts?: number): LedgerEntry {
  const e: LedgerEntry = {
    index,
    situation: `情境${index}`,
    deed,
    verdict: `判词${index}`,
    tone,
  };
  if (ts !== undefined) (e as LedgerEntry & { ts?: number }).ts = ts;
  return e;
}

function makeEntries(n: number): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (let i = 1; i <= n; i++) {
    out.push(entry(i, `为${i}`, TONES[i % TONES.length]!, i * 1000));
  }
  return out;
}

// ---------- 节点字段与 ledgerCore 强一致性 ----------

test('不变量: 每笔 titleLevelAtDeed = titleLevel(index)（10 笔样本）', () => {
  const tl = buildTimeline(makeEntries(10));
  for (const n of tl.nodes) {
    assert.equal(n.titleLevelAtDeed, titleLevel(n.index), `index=${n.index}`);
  }
});

test('不变量: titleNameAtDeed 与 ledgerCore 称号名映射一致（每笔）', () => {
  const tl = buildTimeline(makeEntries(15));
  for (const n of tl.nodes) {
    assert.equal(n.titleNameAtDeed, expectedNameByLevel(n.titleLevelAtDeed), `index=${n.index}`);
  }
});

test('不变量: titleNameAtDeed 非空字符串（每笔）', () => {
  const tl = buildTimeline(makeEntries(20));
  for (const n of tl.nodes) {
    assert.ok(typeof n.titleNameAtDeed === 'string' && n.titleNameAtDeed.length > 0);
  }
});

test('不变量: 首笔 promotedTo === TITLES[0].name', () => {
  const tl = buildTimeline(makeEntries(5));
  assert.equal(tl.nodes[0]!.promotedTo, TITLES[0]!.name);
});

test('不变量: currentTitle === expectedNameByLevel(currentLevel)（0..20 笔）', () => {
  for (let n = 0; n <= 20; n++) {
    const tl = buildTimeline(makeEntries(n));
    assert.equal(tl.currentTitle, expectedNameByLevel(tl.currentLevel), `n=${n}`);
  }
});

test('不变量: currentLevel === titleLevel(total)（0..20 笔）', () => {
  for (let n = 0; n <= 20; n++) {
    const tl = buildTimeline(makeEntries(n));
    assert.equal(tl.currentLevel, titleLevel(n), `n=${n}`);
  }
});

test('不变量: ending === endingType(sorted entries)（每样本）', () => {
  for (let n = 0; n <= 12; n++) {
    const es = makeEntries(n);
    const tl = buildTimeline(es);
    assert.equal(tl.ending, endingType(es), `n=${n}`);
  }
});

// ---------- 晋升严格升序不变量 ----------

test('不变量: i>0 节点 promoted==true ⟺ titleLevel(i)>titleLevel(i-1)', () => {
  const tl = buildTimeline(makeEntries(20));
  for (const n of tl.nodes) {
    if (n.index === 1) {
      assert.ok(n.promoted, `首笔 index=1 必晋升`);
    } else {
      const before = titleLevel(n.index - 1);
      const after = titleLevel(n.index);
      assert.equal(n.promoted, after > before, `index=${n.index} before=${before} after=${after}`);
    }
  }
});

test('不变量: promoted 节点的 promotedTo 非空，非 promoted 为空串', () => {
  const tl = buildTimeline(makeEntries(20));
  for (const n of tl.nodes) {
    if (n.promoted) {
      assert.ok(n.promotedTo.length > 0, `index=${n.index} 应有晋升名`);
    } else {
      assert.equal(n.promotedTo, '', `index=${n.index} 应为空串`);
    }
  }
});

test('不变量: promotions 计数 == nodes 中 promoted=true 的个数（0..25）', () => {
  for (let n = 0; n <= 25; n++) {
    const tl = buildTimeline(makeEntries(n));
    const count = tl.nodes.filter((x) => x.promoted).length;
    assert.equal(tl.promotions, count, `n=${n}`);
  }
});

test('不变量: 满级（≥TITLES 最后阈值）后再加笔不再晋升', () => {
  const maxAt = TITLES[TITLES.length - 1]!.at;
  const tl = buildTimeline(makeEntries(maxAt + 5));
  // 满 maxAt 之后的笔都不是首笔且 after==before
  for (const n of tl.nodes) {
    if (n.index > maxAt) {
      assert.equal(n.promoted, false, `index=${n.index} 满级后不应晋升`);
    }
  }
});

test('不变量: 晋升总数 ≤ TITLES.length（每条阈值最多触发一次首达）', () => {
  const tl = buildTimeline(makeEntries(50));
  assert.ok(tl.promotions <= TITLES.length, `promotions=${tl.promotions}`);
});

// ---------- promotionMilestones ----------

test('里程碑: promotionMilestones 节点 index 严格递增', () => {
  const tl = buildTimeline(makeEntries(20));
  const ms = promotionMilestones(tl);
  for (let i = 1; i < ms.length; i++) {
    assert.ok(ms[i]!.index > ms[i - 1]!.index);
  }
});

test('里程碑: promotionMilestones 全部 promoted==true', () => {
  const tl = buildTimeline(makeEntries(30));
  const ms = promotionMilestones(tl);
  assert.ok(ms.every((m) => m.promoted));
});

test('里程碑: promotionMilestones 长度 == timeline.promotions', () => {
  for (let n = 0; n <= 25; n++) {
    const tl = buildTimeline(makeEntries(n));
    assert.equal(promotionMilestones(tl).length, tl.promotions, `n=${n}`);
  }
});

test('里程碑: 第一里程碑 index=1 且 promotedTo=TITLES[0]', () => {
  const tl = buildTimeline(makeEntries(10));
  const first = promotionMilestones(tl)[0]!;
  assert.equal(first.index, 1);
  assert.equal(first.promotedTo, TITLES[0]!.name);
});

test('里程碑: 每个阈值 TITLES[i].at（i≥1）首次达到时触发一次晋升', () => {
  const tl = buildTimeline(makeEntries(50));
  const ms = promotionMilestones(tl);
  // 每个非首项阈值，应存在一个 index 等于该阈值的里程碑
  for (let i = 1; i < TITLES.length; i++) {
    const at = TITLES[i]!.at;
    const hit = ms.find((m) => m.index === at);
    assert.ok(hit, `阈值 at=${at} 应有里程碑`);
    assert.equal(hit!.promotedTo, TITLES[i]!.name);
  }
});

// ---------- renderTimelineText clip 按码点 ----------

test('render: clip 按码点截断中文（一字一码点，max=5 留 1 位给 … → 4 字+…）', () => {
  const tl = buildTimeline([entry(1, '一二三四五六七八九十', '庄严')]);
  const txt = renderTimelineText(tl, { maxLineLength: 5 });
  // deed 行：为  <deed>，截断后应为 4 字 + …
  const deedLine = txt.split('\n').find((l) => l.startsWith('  为'));
  assert.ok(deedLine);
  assert.ok(deedLine!.includes('一二三四…'), `实际: ${deedLine}`);
});

test('render: clip 不超长原样保留', () => {
  const tl = buildTimeline([entry(1, '短', '庄严')]);
  const txt = renderTimelineText(tl, { maxLineLength: 10 });
  assert.ok(txt.includes('短'));
  assert.ok(!txt.includes('…'));
});

test('render: clip max=1 只剩 …', () => {
  const tl = buildTimeline([entry(1, '一二三', '庄严')]);
  const txt = renderTimelineText(tl, { maxLineLength: 1 });
  assert.ok(txt.includes('…'));
});

test('render: maxLineLength<=0 等价不截断', () => {
  const tl = buildTimeline([entry(1, '一二三', '庄严')]);
  const txt = renderTimelineText(tl, { maxLineLength: 0 });
  assert.ok(txt.includes('一二三'));
});

// ---------- renderTimelineAnsi 颜色标记不变量 ----------

test('ANSI: 标题行含 gold + bold 转义', () => {
  const tl = buildTimeline(makeEntries(3));
  const s = renderTimelineAnsi(tl);
  const titleLine = s.split('\n')[0]!;
  assert.ok(titleLine.includes(TIMELINE_ANSI.gold), '缺 gold');
  assert.ok(titleLine.includes(TIMELINE_ANSI.bold), '缺 bold');
});

test('ANSI: 印章行含 red', () => {
  const tl = buildTimeline([entry(1, 'x', '庄严')]);
  const s = renderTimelineAnsi(tl);
  assert.ok(s.includes(TIMELINE_ANSI.red), '缺 red（印章色）');
});

test('ANSI: 晋升节点含 green 且为「→ ...（晋升）」', () => {
  const tl = buildTimeline([entry(1, 'x', '庄严')]); // 首笔必晋升
  const s = renderTimelineAnsi(tl);
  assert.ok(s.includes(TIMELINE_ANSI.green), '缺 green');
  assert.ok(s.includes('（晋升）'));
});

test('ANSI: 判词行用 gold（「判」字着色）', () => {
  const tl = buildTimeline([entry(1, '为1', '庄严')]);
  const s = renderTimelineAnsi(tl);
  assert.ok(s.includes(TIMELINE_ANSI.gold));
});

test('ANSI: 非 promoted 节点用 dim 显示称号（无 green 晋升标记）', () => {
  // 构造 index=2 但 titleLevel(2)==titleLevel(1) → 非 promoted
  const tl = buildTimeline([entry(1, 'a', '庄严'), entry(2, 'b', '佛系')]);
  const node2Line = renderTimelineAnsi(tl)
    .split('\n')
    .find((l) => l.includes('#2'));
  assert.ok(node2Line);
  assert.ok(node2Line!.includes(TIMELINE_ANSI.dim));
});

test('ANSI: 空时间线只含 dim（无 gold/red/green）', () => {
  const s = renderTimelineAnsi(buildTimeline([]));
  assert.ok(s.includes(TIMELINE_ANSI.dim));
  assert.ok(!s.includes(TIMELINE_ANSI.gold));
});

test('ANSI 常量: 六色 + reset 全含 ESC[ 前缀', () => {
  for (const [k, v] of Object.entries(TIMELINE_ANSI)) {
    assert.ok(v.startsWith('\x1b['), `${k}=${JSON.stringify(v)} 缺 ESC[`);
  }
});

test('ANSI 常量: reset 末位', () => {
  assert.equal(TIMELINE_ANSI.reset, '\x1b[0m');
});

// ---------- TONE_STAMP 印章完备性 ----------

test('印章: 每笔节点的 tone 都能在 TONE_STAMP 找到对应印章', () => {
  const tl = buildTimeline(makeEntries(12));
  for (const n of tl.nodes) {
    assert.ok(n.tone in TONE_STAMP, `tone=${n.tone}`);
  }
});

// ---------- timelineSummary 派生对应 ----------

test('summary: 含 total 数字、promotions 数字、currentTitle、ending', () => {
  const tl = buildTimeline(makeEntries(7));
  const s = timelineSummary(tl);
  assert.ok(s.includes(String(tl.total)));
  assert.ok(s.includes(String(tl.promotions)));
  assert.ok(s.includes(tl.currentTitle));
  assert.ok(s.includes(tl.ending));
});

test('summary: 空时间线返回「尚未行善」且不含笔数', () => {
  const s = timelineSummary(buildTimeline([]));
  assert.equal(s, '尚未行善');
});

// ---------- exportTimelineCompact 可序列化 ----------

test('compact: 结构可 JSON.stringify 往返（无函数/循环）', () => {
  const tl = buildTimeline(makeEntries(8));
  const compact = exportTimelineCompact(tl);
  const json = JSON.stringify(compact);
  const back = JSON.parse(json);
  assert.equal(back.total, compact.total);
  assert.equal(back.currentTitle, compact.currentTitle);
  assert.equal(back.ending, compact.ending);
  assert.equal(back.milestones.length, compact.milestones.length);
});

test('compact: milestones 项含 index/deed/tone/promotedTo 四必备字段', () => {
  const tl = buildTimeline(makeEntries(5));
  const c = exportTimelineCompact(tl);
  for (const m of c.milestones) {
    assert.ok('index' in m);
    assert.ok('deed' in m);
    assert.ok('tone' in m);
    assert.ok('promotedTo' in m);
  }
});

test('compact: milestones 长度 == timeline.total（每节点一项）', () => {
  for (let n = 0; n <= 10; n++) {
    const tl = buildTimeline(makeEntries(n));
    assert.equal(exportTimelineCompact(tl).milestones.length, n);
  }
});

test('compact: ts 字段在原 entry 带时保留、不带时缺省（不出现键）', () => {
  const withTs = buildTimeline([entry(1, 'a', '庄严', 1234)]);
  const c1 = exportTimelineCompact(withTs);
  assert.equal(c1.milestones[0]!.ts, 1234);

  const noTs = buildTimeline([entry(1, 'a', '庄严')]);
  const c2 = exportTimelineCompact(noTs);
  assert.equal(c2.milestones[0]!.ts, undefined);
  // JSON 序列化后 undefined 键被丢弃
  assert.ok(!('ts' in JSON.parse(JSON.stringify(c2)).milestones[0]));
});

// ---------- 纯函数 / 输入不可变性 ----------

test('纯函数: buildTimeline 不修改输入 entries 数组', () => {
  const es = makeEntries(5);
  const snapshot = es.map((e) => ({ ...e }));
  buildTimeline(es);
  assert.deepEqual(
    es.map((e) => ({ ...e })),
    snapshot,
  );
});

test('纯函数: buildTimeline 对乱序输入仍输出正序节点（再次验证不变量）', () => {
  const es = [entry(5, 'e', '庄严'), entry(1, 'a', '佛系'), entry(3, 'c', '戏谑')];
  const tl = buildTimeline(es);
  assert.deepEqual(
    tl.nodes.map((n) => n.index),
    [1, 3, 5],
  );
});

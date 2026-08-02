/**
 * 大善系统 —— 称号系统深层测试（round 13）。
 *
 * 聚焦 ledgerCore 的称号阶梯与进度数学，补齐 ledger.test.ts 未覆盖的：
 *  - TITLES 阈值序列严格递增（1/2/3/4/5/6/8/10）
 *  - 称号逐级解锁：每个阈值恰好触发一次晋升
 *  - 进度数学：percent 在区间内单调、跨阈值跳变、封顶恒 100
 *  - 称号不可降级：titleLevel 单调不减（仅随 count 增长）
 *  - 最高称号：isMaxTitle / MAX_TITLE_LEVEL 触发条件
 *  - addEntry 晋升返回值：恰好等于「该 count 对应的称号名」
 *  - Ledger.import/export 往返一致；clear 后可重建
 *  - escapeHtml 注入防护
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  Ledger,
  TITLES,
  titleLevel,
  MAX_TITLE_LEVEL,
  isMaxTitle,
  progressToNextTitle,
  emptyToneStats,
  escapeHtml,
  type LedgerEntry,
} from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

function mkEntry(
  i: number,
  tone: Tone = '庄严',
  over: Partial<LedgerEntry> = {},
): LedgerEntry {
  return { index: i, situation: 's', deed: 'd', verdict: 'v', tone, ...over };
}

// ── TITLES 阈值序列 ─────────────────────────────────────

test('title-deep: TITLES 阈值严格递增（非降）', () => {
  for (let i = 1; i < TITLES.length; i++) {
    assert.ok(
      TITLES[i]!.at > TITLES[i - 1]!.at,
      `阈值应严格递增：[${i-1}]=${TITLES[i-1]!.at} < [${i}]=${TITLES[i]!.at}`,
    );
  }
});

test('title-deep: TITLES 阈值序列恰为 [1,2,3,4,5,6,8,10]', () => {
  const ats = TITLES.map((t) => t.at);
  assert.deepEqual(ats, [1, 2, 3, 4, 5, 6, 8, 10]);
});

test('title-deep: 每个称号名非空且唯一', () => {
  const names = TITLES.map((t) => t.name);
  for (const n of names) assert.ok(n.length > 0, '称号名非空');
  assert.equal(new Set(names).size, names.length, '称号名应全部唯一');
});

test('title-deep: TITLES 共 8 级', () => {
  assert.equal(TITLES.length, 8);
});

// ── 称号逐级解锁（addEntry 晋升返回值） ─────────────────

test('title-deep: addEntry 仅在跨阈值时返回非空晋升名', () => {
  const l = new Ledger();
  const promotions: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const r = l.addEntry({ situation: 's', deed: `d${i}`, verdict: 'v', tone: '庄严' });
    if (r !== '') promotions.push(`${i}:${r}`);
  }
  // 阈值 1/2/3/4/5/6/8/10 → 共 8 次晋升（10 笔内全部解锁）
  assert.equal(promotions.length, 8, `应有 8 次晋升，实际 ${promotions.join(', ')}`);
});

test('title-deep: 每个阈值的晋升返回名与 TITLES 对应', () => {
  const l = new Ledger();
  for (let lv = 0; lv < TITLES.length; lv++) {
    const targetAt = TITLES[lv]!.at;
    // 加到恰好 targetAt 笔
    while (l.count() < targetAt) {
      l.addEntry({ situation: 's', deed: 'd', verdict: 'v', tone: '庄严' });
    }
    assert.equal(l.currentTitle(), TITLES[lv]!.name, `${targetAt} 笔应对应 ${TITLES[lv]!.name}`);
  }
});

test('title-deep: 阈值之间的笔数不触发晋升（返回空串）', () => {
  // 阈值 6（善满功圆）与 8（至善尊者）之间，第 7 笔不应晋升
  const l = new Ledger();
  for (let i = 1; i <= 6; i++) l.addEntry({ situation: 's', deed: 'd', verdict: 'v', tone: '庄严' });
  assert.equal(l.currentTitle(), '善满功圆');
  const r = l.addEntry({ situation: 's', deed: 'd', verdict: 'v', tone: '庄严' }); // 第7笔
  assert.equal(r, '', '第 7 笔（6 与 8 之间）不应晋升');
  assert.equal(l.currentTitle(), '善满功圆');
});

// ── 进度数学 ───────────────────────────────────────────

test('title-deep: progress percent 在区间内单调不减', () => {
  // 从 level 0（at:1）到 level 1（at:2），count=1 时进入区间
  // 取 count 0→2 看 percent 走势
  const p0 = progressToNextTitle(0);
  const p1 = progressToNextTitle(1);
  assert.ok(p1.percent >= p0.percent, `percent 应单调不减：${p0.percent} → ${p1.percent}`);
});

test('title-deep: percent 在跨阈值时正确重置', () => {
  // level 1 区间 at:2 → at:3，count=2 时进入（done=0），count=3 时满
  const at2 = progressToNextTitle(2);
  assert.equal(at2.current, 1);
  assert.equal(at2.remaining, 1); // 3-2
  assert.equal(at2.percent, 0, '区间起点 percent=0');
  const at3 = progressToNextTitle(3); // 刚跨到 level 2
  assert.equal(at3.current, 2);
});

test('title-deep: 封顶后 percent 恒 100、nextAt=null、remaining=0', () => {
  for (const c of [10, 11, 100, 9999]) {
    const p = progressToNextTitle(c);
    assert.equal(p.nextAt, null, `${c} 笔应封顶 nextAt=null`);
    assert.equal(p.percent, 100);
    assert.equal(p.remaining, 0);
    assert.equal(p.current, MAX_TITLE_LEVEL);
  }
});

test('title-deep: remaining = nextAt - count（未封顶时）', () => {
  for (let c = 0; c <= 9; c++) {
    const p = progressToNextTitle(c);
    if (p.nextAt !== null) {
      assert.equal(p.remaining, p.nextAt - c, `count=${c} remaining 计算错误`);
    }
  }
});

test('title-deep: percent 范围恒在 [0,100]', () => {
  for (let c = 0; c <= 50; c++) {
    const p = progressToNextTitle(c);
    assert.ok(p.percent >= 0 && p.percent <= 100, `count=${c} percent=${p.percent} 越界`);
  }
});

// ── 称号不可降级（titleLevel 单调性） ───────────────────

test('title-deep: titleLevel 随 count 单调不减', () => {
  let prev = -1;
  for (let c = 0; c <= 50; c++) {
    const lv = titleLevel(c);
    assert.ok(lv >= prev, `titleLevel 应单调不减：count=${c} lv=${lv} prev=${prev}`);
    prev = lv;
  }
});

test('title-deep: titleLevel 最终达到 MAX_TITLE_LEVEL', () => {
  assert.equal(titleLevel(10), MAX_TITLE_LEVEL);
  assert.equal(titleLevel(99999), MAX_TITLE_LEVEL);
});

test('title-deep: MAX_TITLE_LEVEL = TITLES.length - 1 = 7', () => {
  assert.equal(MAX_TITLE_LEVEL, TITLES.length - 1);
  assert.equal(MAX_TITLE_LEVEL, 7);
});

// ── isMaxTitle 触发条件 ─────────────────────────────────

test('title-deep: isMaxTitle 在达到最高阈值后为 true', () => {
  assert.equal(isMaxTitle(10), true);
  assert.equal(isMaxTitle(15), true);
});

test('title-deep: isMaxTitle 在未达最高阈值时为 false', () => {
  assert.equal(isMaxTitle(0), false);
  assert.equal(isMaxTitle(9), false); // 9 < 10（最高 at）
});

test('title-deep: isMaxTitle 与 titleLevel>=MAX 一致', () => {
  for (let c = 0; c <= 20; c++) {
    assert.equal(isMaxTitle(c), titleLevel(c) >= MAX_TITLE_LEVEL, `count=${c} 不一致`);
  }
});

// ── Ledger 实例：clear 后称号降回（这是容器行为，非纯函数） ──

test('title-deep: Ledger.clear 后称号回到第一级（容器重置合法）', () => {
  const l = new Ledger();
  for (let i = 0; i < 12; i++) l.addEntry({ situation: 's', deed: 'd', verdict: 'v', tone: '庄严' });
  assert.equal(isMaxTitle(l.count()), true);
  l.clear();
  assert.equal(l.count(), 0);
  assert.equal(l.currentTitle(), TITLES[0]!.name);
  // clear 后再加一笔，应重新从第一级晋升
  assert.equal(l.addEntry({ situation: 's', deed: 'd', verdict: 'v', tone: '庄严' }), '初入善门者');
});

// ── Ledger.import/export 往返 ───────────────────────────

test('title-deep: export 返回深拷贝（改动不影响内部）', () => {
  const l = new Ledger();
  l.addEntry({ situation: 's', deed: 'd', verdict: 'v', tone: '庄严' });
  const out = l.export();
  out[0]!.deed = '外部篡改';
  assert.equal(l.all()[0]!.deed, 'd', 'export 应返回深拷贝');
});

test('title-deep: import 覆盖现有记录且称号随之变化', () => {
  const l = new Ledger();
  l.addEntry({ situation: 's', deed: 'd', verdict: 'v', tone: '庄严' });
  assert.equal(l.currentTitle(), '初入善门者');
  // 导入 10 笔 → 直接满级
  const imported: LedgerEntry[] = Array.from({ length: 10 }, (_, i) => mkEntry(i + 1));
  l.import(imported);
  assert.equal(l.count(), 10);
  assert.equal(l.currentTitle(), '超凡入圣 · 善恶一念同体');
});

test('title-deep: import 空数组等价于 clear', () => {
  const l = new Ledger();
  l.addEntry({ situation: 's', deed: 'd', verdict: 'v', tone: '庄严' });
  l.import([]);
  assert.equal(l.count(), 0);
  assert.equal(l.currentTitle(), TITLES[0]!.name);
});

test('title-deep: export→import 往返数据一致', () => {
  const l1 = new Ledger();
  for (let i = 0; i < 8; i++) {
    l1.addEntry({ situation: `s${i}`, deed: `d${i}`, verdict: `v${i}`, tone: '佛系' });
  }
  const exported = l1.export();
  const l2 = new Ledger();
  l2.import(exported);
  assert.equal(l2.count(), l1.count());
  assert.equal(l2.currentTitle(), l1.currentTitle());
  assert.equal(l2.endingType(), l1.endingType());
  // 逐条对比
  const a1 = l1.all();
  const a2 = l2.all();
  for (let i = 0; i < a1.length; i++) {
    assert.equal(a2[i]!.deed, a1[i]!.deed);
    assert.equal(a2[i]!.tone, a1[i]!.tone);
  }
});

// ── emptyToneStats ──────────────────────────────────────

test('title-deep: emptyToneStats 全 6 语气初始为 0', () => {
  const s = emptyToneStats();
  const tones: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  for (const t of tones) {
    assert.equal(s[t], 0, `语气 ${t} 初始应为 0`);
  }
  assert.equal(Object.keys(s).length, 6);
});

// ── escapeHtml 注入防护 ─────────────────────────────────

test('title-deep: escapeHtml 转义 4 类特殊字符', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  assert.equal(escapeHtml('"引号"'), '&quot;引号&quot;');
  assert.equal(escapeHtml('&amp'), '&amp;amp');
});

test('title-deep: escapeHtml 对普通文本无副作用', () => {
  assert.equal(escapeHtml('普通中文文本123'), '普通中文文本123');
});

test('title-deep: escapeHtml 空串返回空串', () => {
  assert.equal(escapeHtml(''), '');
});

// ── 边界：count 为 0 / 负数 ─────────────────────────────

test('title-deep: titleLevel(0) = 0', () => {
  assert.equal(titleLevel(0), 0);
});

test('title-deep: progressToNextTitle(0) nextAt=2 remaining=2', () => {
  const p = progressToNextTitle(0);
  assert.equal(p.current, 0);
  assert.equal(p.nextAt, 2);
  assert.equal(p.remaining, 2);
  assert.equal(p.percent, 0);
});

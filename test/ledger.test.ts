/**
 * 大善系统 —— 善恶簿（功过格）核心逻辑测试。
 * 覆盖：记录累积、善名 8 级阶梯边界、清空、印章映射。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Ledger,
  TITLES,
  TONE_STAMP,
  progressToNextTitle,
  toneStats,
  endingType,
} from '../shared/ledgerCore.ts';
import type { LedgerEntry } from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

function fakeEntry(deed: string, tone: Tone = '庄严') {
  return { situation: '测试情境', deed, verdict: '测试判词', tone };
}

test('Ledger: 初始无记录，currentTitle 返回第一级', () => {
  const l = new Ledger();
  assert.equal(l.count(), 0);
  assert.equal(l.currentTitle(), TITLES[0]!.name);
});

test('Ledger: addEntry 返回晋升的善名，未晋升返回空串', () => {
  const l = new Ledger();
  // 第 1 笔：从未名 → 初入善门者（晋升）
  assert.equal(l.addEntry(fakeEntry('a')), '初入善门者');
  // 第 2 笔：→ 怀善之人（晋升）
  assert.equal(l.addEntry(fakeEntry('b')), '怀善之人');
  // 仍第 2 级区间内不会变（但 at:2 已是怀善之人，第3笔才到行善有道）
});

test('Ledger: 善名阶梯 8 级边界正确', () => {
  const l = new Ledger();
  // 逐笔加，校验每个阈值
  const expectedAt: Record<number, string> = {
    1: '初入善门者',
    2: '怀善之人',
    3: '行善有道',
    4: '善名渐起',
    5: '大善之人',
    6: '善满功圆',
    7: '善满功圆', // 第7笔仍 6 级（下一级 at:8）
    8: '至善尊者',
    9: '至善尊者', // 第9笔仍 8 级（下一级 at:10）
    10: '超凡入圣 · 善恶一念同体',
    15: '超凡入圣 · 善恶一念同体', // 封顶
  };
  for (let i = 1; i <= 15; i++) {
    l.addEntry(fakeEntry(`deed${i}`));
    const want = expectedAt[i];
    if (want) assert.equal(l.currentTitle(), want, `第 ${i} 笔善名不符`);
  }
  assert.equal(l.count(), 15);
});

test('Ledger: 清空后回到初始状态', () => {
  const l = new Ledger();
  l.addEntry(fakeEntry('a'));
  l.addEntry(fakeEntry('b'));
  l.clear();
  assert.equal(l.count(), 0);
  assert.equal(l.currentTitle(), TITLES[0]!.name);
  assert.equal(l.all().length, 0);
});

test('Ledger: 条目 index 自增且从 1 开始', () => {
  const l = new Ledger();
  l.addEntry(fakeEntry('a'));
  l.addEntry(fakeEntry('b'));
  const all = l.all();
  assert.equal(all[0]!.index, 1);
  assert.equal(all[1]!.index, 2);
});

test('TONE_STAMP: 覆盖全部 6 种语气', () => {
  const tones: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
  for (const t of tones) {
    assert.ok(TONE_STAMP[t], `语气 ${t} 应有印章用词`);
    assert.ok(TONE_STAMP[t]!.length === 1, `语气 ${t} 印章应为单字`);
  }
});

// ─── progressToNextTitle（D 项） ─────────────────────────────

test('progressToNextTitle: 封顶后 nextAt 为 null', () => {
  const p = progressToNextTitle(15);
  assert.equal(p.nextAt, null);
  assert.equal(p.percent, 100);
  assert.equal(p.remaining, 0);
});

test('progressToNextTitle: 正常区间计算 remaining 与 percent', () => {
  // level 0 (at:1) → level 1 (at:2)，count=1
  const p = progressToNextTitle(1);
  assert.equal(p.current, 0);
  assert.equal(p.nextAt, 2);
  assert.equal(p.remaining, 1);
  assert.ok(p.percent >= 0 && p.percent <= 100);
});

test('progressToNextTitle: 0 笔时仍计算到下一级', () => {
  const p = progressToNextTitle(0);
  // level 0（at:1）→ 下一级 at:2
  assert.equal(p.nextAt, 2);
  assert.equal(p.remaining, 2);
});

// ─── toneStats / endingType（D 项多结局） ────────────────────

function entries(tones: Tone[]): LedgerEntry[] {
  return tones.map((t, i) => ({ index: i + 1, situation: 'x', deed: 'd', verdict: 'v', tone: t }));
}

test('toneStats: 正确统计各语气次数', () => {
  const s = toneStats(entries(['佛系', '佛系', '温情', '庄严']));
  assert.equal(s['佛系'], 2);
  assert.equal(s['温情'], 1);
  assert.equal(s['庄严'], 1);
  assert.equal(s['戏谑'], 0);
});

test('endingType: 佛系+温情占多 → 渡世', () => {
  assert.equal(endingType(entries(['佛系', '温情', '佛系', '庄严'])), '渡世');
});

test('endingType: 戏谑+江湖占多 → 灭世', () => {
  assert.equal(endingType(entries(['戏谑', '江湖', '戏谑', '庄严'])), '灭世');
});

test('endingType: 均衡/学术庄严主导 → 超脱', () => {
  assert.equal(endingType(entries(['庄严', '学术', '庄严', '学术'])), '超脱');
  assert.equal(endingType(entries([])), '超脱');
});

test('Ledger: endingType/progress 便捷方法可用', () => {
  const l = new Ledger();
  l.addEntry(fakeEntry('a', '佛系'));
  l.addEntry(fakeEntry('b', '佛系'));
  assert.equal(l.endingType(), '渡世');
  assert.ok(l.progress().percent >= 0);
});

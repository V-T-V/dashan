/**
 * shared/achievements.ts 修行成就徽章系统测试 —— R5-D6
 *
 * 覆盖：
 * - 辅助函数：longestToneStreak / toneCounts / distinctTones / dominantToneCount 的边界与不变量
 * - evaluateAchievements：结构合法 / 顺序固定 / 五分类全覆盖 / percent 钳 0-100
 * - 累积型成就：first-step@1 / ten-deeds@10 / twenty-deeds@20 的精确阈值与进度
 * - 多样型：four-tones@4 / all-tones@6 的集齐判定
 * - 连续型：streak-3@3 / streak-5@5 的连续同语气判定
 * - 主导型：dominant-3@3 / dominant-5@5 的主导计数
 * - 里程碑型：max-title 满级 / ending-transcendent 超脱结局
 * - unlockedAchievements / achievementSummary 派生一致性
 * - 纯函数与确定性（同输入同输出）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAchievements,
  unlockedAchievements,
  achievementSummary,
  longestToneStreak,
  toneCounts,
  distinctTones,
  dominantToneCount,
} from '../shared/achievements.ts';
import { TITLES, MAX_TITLE_LEVEL } from '../shared/ledgerCore.ts';
import type { LedgerEntry } from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

const TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

function entry(deed: string, tone: Tone): LedgerEntry {
  return { index: 0, situation: 's', deed, verdict: 'v', tone };
}

/** 构造 n 笔，按 i 循环取语气。 */
function makeN(n: number, tone: Tone = '庄严'): LedgerEntry[] {
  return Array.from({ length: n }, (_, i) => ({ ...entry(`d${i}`, tone), index: i + 1 }));
}

/** 构造 n 笔，语气按 i % TONES 循环（保证多样）。 */
function makeDiverse(n: number): LedgerEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    ...entry(`d${i}`, TONES[i % TONES.length]!),
    index: i + 1,
  }));
}

// ---------- 辅助函数 ----------

test('longestToneStreak: 空数组=0', () => {
  assert.equal(longestToneStreak([]), 0);
});

test('longestToneStreak: 单笔=1', () => {
  assert.equal(longestToneStreak([entry('a', '庄严')]), 1);
});

test('longestToneStreak: 全同语气=n', () => {
  assert.equal(longestToneStreak(makeN(5, '佛系')), 5);
});

test('longestToneStreak: 交替=1', () => {
  const es = [entry('a', '庄严'), entry('b', '戏谑'), entry('c', '佛系')];
  assert.equal(longestToneStreak(es), 1);
});

test('longestToneStreak: 中段最长（[A,A,B,B,B,A]→3）', () => {
  const es = [
    entry('a', '庄严'),
    entry('b', '庄严'),
    entry('c', '戏谑'),
    entry('d', '戏谑'),
    entry('e', '戏谑'),
    entry('f', '庄严'),
  ];
  assert.equal(longestToneStreak(es), 3);
});

test('longestToneStreak: 开头最长（[A,A,A,B,C]→3）', () => {
  const es = [entry('a', '庄严'), entry('b', '庄严'), entry('c', '庄严'), entry('d', '戏谑')];
  assert.equal(longestToneStreak(es), 3);
});

test('toneCounts: 空数组全 0', () => {
  const c = toneCounts([]);
  for (const t of TONES) assert.equal(c[t], 0);
});

test('toneCounts: 总和=entries.length', () => {
  const es = makeDiverse(9);
  const c = toneCounts(es);
  const sum = TONES.reduce((s, t) => s + c[t], 0);
  assert.equal(sum, 9);
});

test('distinctTones: 空数组=0', () => {
  assert.equal(distinctTones([]), 0);
});

test('distinctTones: 6 种全用=6', () => {
  assert.equal(distinctTones(makeDiverse(6)), 6);
});

test('distinctTones: 重复用同语气不增量', () => {
  assert.equal(distinctTones(makeN(10, '庄严')), 1);
});

test('dominantToneCount: 空数组=0', () => {
  assert.equal(dominantToneCount([]), 0);
});

test('dominantToneCount: 全同=n', () => {
  assert.equal(dominantToneCount(makeN(7, '江湖')), 7);
});

test('dominantToneCount: 取最高频（即使非首项）', () => {
  const es = [
    entry('a', '庄严'),
    entry('b', '佛系'),
    entry('c', '佛系'),
    entry('d', '佛系'),
    entry('e', '庄严'),
  ];
  assert.equal(dominantToneCount(es), 3);
});

// ---------- evaluateAchievements 结构 ----------

test('结构: 返回数组非空', () => {
  assert.ok(evaluateAchievements([]).length > 0);
});

test('结构: 每项含 id/name/emoji/desc/unlocked/percent/category 七字段', () => {
  for (const a of evaluateAchievements(makeN(3))) {
    assert.ok(typeof a.id === 'string' && a.id.length > 0);
    assert.ok(typeof a.name === 'string' && a.name.length > 0);
    assert.ok(typeof a.emoji === 'string' && a.emoji.length > 0);
    assert.ok(typeof a.desc === 'string' && a.desc.length > 0);
    assert.equal(typeof a.unlocked, 'boolean');
    assert.equal(typeof a.percent, 'number');
    assert.ok(['累积', '多样', '连续', '主导', '里程碑'].includes(a.category));
  }
});

test('结构: percent 在 [0,100]', () => {
  for (const a of evaluateAchievements(makeDiverse(15))) {
    assert.ok(a.percent >= 0 && a.percent <= 100, `${a.id} percent=${a.percent}`);
  }
});

test('结构: 已达成 percent 恒为 100', () => {
  for (const a of evaluateAchievements(makeDiverse(20))) {
    if (a.unlocked) assert.equal(a.percent, 100, `${a.id} 已达成但 percent≠100`);
  }
});

test('结构: id 唯一', () => {
  const ids = evaluateAchievements(makeN(5)).map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('结构: 顺序固定（同输入两次调用顺序一致）', () => {
  const a = evaluateAchievements(makeDiverse(8)).map((x) => x.id);
  const b = evaluateAchievements(makeDiverse(8)).map((x) => x.id);
  assert.deepEqual(a, b);
});

test('结构: 五分类全覆盖（累积/多样/连续/主导/里程碑）', () => {
  const cats = new Set(evaluateAchievements(makeDiverse(15)).map((a) => a.category));
  for (const c of ['累积', '多样', '连续', '主导', '里程碑'] as const) {
    assert.ok(cats.has(c), `缺分类 ${c}`);
  }
});

// ---------- 累积型 ----------

test('累积: 空数组 first-step 未达成 percent=0', () => {
  const a = evaluateAchievements([]).find((x) => x.id === 'first-step')!;
  assert.equal(a.unlocked, false);
  assert.equal(a.percent, 0);
});

test('累积: 1 笔 first-step 达成', () => {
  const a = evaluateAchievements(makeN(1)).find((x) => x.id === 'first-step')!;
  assert.equal(a.unlocked, true);
  assert.equal(a.percent, 100);
});

test('累积: ten-deeds 阈值——9 笔未达成 percent=90', () => {
  const a = evaluateAchievements(makeN(9)).find((x) => x.id === 'ten-deeds')!;
  assert.equal(a.unlocked, false);
  assert.equal(a.percent, 90);
});

test('累积: ten-deeds 阈值——10 笔达成', () => {
  const a = evaluateAchievements(makeN(10)).find((x) => x.id === 'ten-deeds')!;
  assert.equal(a.unlocked, true);
});

test('累积: twenty-deeds 阈值——20 笔达成', () => {
  const a = evaluateAchievements(makeN(20)).find((x) => x.id === 'twenty-deeds')!;
  assert.equal(a.unlocked, true);
});

test('累积: 5 笔时 first-step 与 ten-deeds 状态正确', () => {
  const all = evaluateAchievements(makeN(5));
  assert.equal(all.find((x) => x.id === 'first-step')!.unlocked, true);
  assert.equal(all.find((x) => x.id === 'ten-deeds')!.unlocked, false);
});

// ---------- 多样型 ----------

test('多样: four-tones——3 种语气未达成', () => {
  const es = [entry('a', '庄严'), entry('b', '戏谑'), entry('c', '佛系')];
  const a = evaluateAchievements(es).find((x) => x.id === 'four-tones')!;
  assert.equal(a.unlocked, false);
});

test('多样: four-tones——4 种语气达成', () => {
  const es = TONES.slice(0, 4).map((t) => entry(`d${t}`, t));
  const a = evaluateAchievements(es).find((x) => x.id === 'four-tones')!;
  assert.equal(a.unlocked, true);
});

test('多样: all-tones——5 种未达成', () => {
  const es = TONES.slice(0, 5).map((t) => entry(`d${t}`, t));
  const a = evaluateAchievements(es).find((x) => x.id === 'all-tones')!;
  assert.equal(a.unlocked, false);
});

test('多样: all-tones——6 种全用达成', () => {
  const a = evaluateAchievements(makeDiverse(6)).find((x) => x.id === 'all-tones')!;
  assert.equal(a.unlocked, true);
});

// ---------- 连续型 ----------

test('连续: streak-3——2 笔连续未达成', () => {
  const a = evaluateAchievements(makeN(2, '庄严')).find((x) => x.id === 'streak-3')!;
  assert.equal(a.unlocked, false);
});

test('连续: streak-3——3 笔连续达成', () => {
  const a = evaluateAchievements(makeN(3, '庄严')).find((x) => x.id === 'streak-3')!;
  assert.equal(a.unlocked, true);
});

test('连续: streak-5——5 笔连续达成', () => {
  const a = evaluateAchievements(makeN(5, '佛系')).find((x) => x.id === 'streak-5')!;
  assert.equal(a.unlocked, true);
});

test('连续: 非连续（交替）即使总数够也不达成', () => {
  const es = [entry('a', '庄严'), entry('b', '佛系'), entry('c', '庄严')];
  const a = evaluateAchievements(es).find((x) => x.id === 'streak-3')!;
  assert.equal(a.unlocked, false);
});

// ---------- 主导型 ----------

test('主导: dominant-3——某语气 3 笔达成', () => {
  const es = [
    entry('a', '庄严'),
    entry('b', '庄严'),
    entry('c', '庄严'),
    entry('d', '佛系'),
  ];
  const a = evaluateAchievements(es).find((x) => x.id === 'dominant-3')!;
  assert.equal(a.unlocked, true);
});

test('主导: dominant-5——某语气 5 笔达成（即使不连续）', () => {
  const es = [
    entry('a', '江湖'),
    entry('b', '佛系'),
    entry('c', '江湖'),
    entry('d', '佛系'),
    entry('e', '江湖'),
    entry('f', '佛系'),
    entry('g', '江湖'),
    entry('h', '佛系'),
  ];
  // 江湖 4 笔、佛系 4 笔 → 均未达 5
  const a5 = evaluateAchievements(es).find((x) => x.id === 'dominant-5')!;
  assert.equal(a5.unlocked, false);
});

test('主导: dominant-5——5 笔同语气达成', () => {
  const a = evaluateAchievements(makeN(5, '江湖')).find((x) => x.id === 'dominant-5')!;
  assert.equal(a.unlocked, true);
});

// ---------- 里程碑型 ----------

test('里程碑: max-title——未满级未达成', () => {
  const a = evaluateAchievements(makeN(5)).find((x) => x.id === 'max-title')!;
  assert.equal(a.unlocked, false);
});

test('里程碑: max-title——达 TITLES 最后阈值达成', () => {
  const maxAt = TITLES[MAX_TITLE_LEVEL]!.at;
  const a = evaluateAchievements(makeN(maxAt)).find((x) => x.id === 'max-title')!;
  assert.equal(a.unlocked, true);
  assert.equal(a.percent, 100);
});

test('里程碑: max-title——desc 含最高称号名', () => {
  const a = evaluateAchievements([]).find((x) => x.id === 'max-title')!;
  assert.ok(a.desc.includes(TITLES[MAX_TITLE_LEVEL]!.name));
});

test('里程碑: ending-transcendent——空数组未达成（n>0 才算）', () => {
  const a = evaluateAchievements([]).find((x) => x.id === 'ending-transcendent')!;
  assert.equal(a.unlocked, false);
});

// ---------- unlockedAchievements / achievementSummary ----------

test('unlocked: 空数组——仅 first-step 之类未达成，列表为空', () => {
  assert.equal(unlockedAchievements([]).length, 0);
});

test('unlocked: 1 笔——first-step 与 ending-transcendent（少量笔数 endingType=超脱）达成', () => {
  const u = unlockedAchievements(makeN(1));
  const ids = u.map((a) => a.id);
  assert.ok(ids.includes('first-step'));
  // 1 笔时 toneStats 主导为庄严（非佛系/温情、非戏谑/江湖），endingType 归「超脱」
  assert.ok(ids.includes('ending-transcendent'));
});

test('unlocked: 是 evaluateAchievements 的已达成子集', () => {
  const all = evaluateAchievements(makeDiverse(15));
  const u = unlockedAchievements(makeDiverse(15));
  assert.equal(u.length, all.filter((a) => a.unlocked).length);
  assert.ok(u.every((a) => a.unlocked));
});

test('summary: 空数组 unlocked=0', () => {
  const s = achievementSummary([]);
  assert.equal(s.unlocked, 0);
  assert.equal(s.percent, 0);
});

test('summary: total 等于 evaluateAchievements 长度', () => {
  const s = achievementSummary(makeDiverse(10));
  assert.equal(s.total, evaluateAchievements(makeDiverse(10)).length);
});

test('summary: unlocked/total 与 evaluateAchievements 一致', () => {
  const es = makeDiverse(15);
  const s = achievementSummary(es);
  const all = evaluateAchievements(es);
  assert.equal(s.unlocked, all.filter((a) => a.unlocked).length);
  assert.equal(s.total, all.length);
});

test('summary: percent = round(unlocked/total*100)', () => {
  const es = makeDiverse(15);
  const s = achievementSummary(es);
  assert.equal(s.percent, Math.round((s.unlocked / s.total) * 100));
});

test('summary: percent 在 [0,100]', () => {
  for (let n = 0; n <= 20; n++) {
    const s = achievementSummary(makeDiverse(n));
    assert.ok(s.percent >= 0 && s.percent <= 100, `n=${n}`);
  }
});

// ---------- 纯函数 / 确定性 ----------

test('纯函数: evaluateAchievements 不修改输入', () => {
  const es = makeDiverse(5);
  const snap = es.map((e) => ({ ...e }));
  evaluateAchievements(es);
  assert.deepEqual(
    es.map((e) => ({ ...e })),
    snap,
  );
});

test('确定性: 同输入两次 deep equal', () => {
  const a = evaluateAchievements(makeDiverse(12));
  const b = evaluateAchievements(makeDiverse(12));
  assert.deepEqual(a, b);
});

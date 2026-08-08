/**
 * R10-D7: stats.hiddenEndingHint 新功能测试。
 *
 * hiddenEndingHint 在玩家「尚未满级、但已在隐藏结局路径上」时给进度提示，
 * 与 ledgerCore.endingNarrative 的两个隐藏结局对齐：
 *   满级 + 主导学术 → 辩经尊者
 *   满级 + 主导江湖 → 执剑尊者
 *
 * 覆盖：
 *  1. 空记录 → onPath=false（无主导语气）
 *  2. 单笔学术 → onPath=true（占比 1.0 ≥ 0.5）/ path=辩经尊者
 *  3. 单笔江湖 → onPath=true / path=执剑尊者
 *  4. 主导非学术/江湖（佛系/戏谑/庄严/温情）→ onPath=false
 *  5. 占比低于阈值 → onPath=false（如 5 学术 + 5 江湖平局时 dominant=学术 但占比 0.5 边界）
 *  6. 满级时 unlocked=true / deedsToUnlock=0
 *  7. deedsToUnlock = max(0, 10 - count)
 *  8. count 参数独立于 entries.length
 *  9. 自定义 ratioThreshold 透传
 * 10. 满级 + 学术路径 → unlocked=true 且 path=辩经尊者
 * 11. 满级 + 江湖路径 → unlocked=true 且 path=执剑尊者
 * 12. 与 endingNarrative 一致性（满级时 hint.path 对应 endingNarrative.type）
 * 13. 纯函数不修改入参
 * 14. 确定性
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hiddenEndingHint, type HiddenEndingPath } from '../shared/stats.ts';
import { endingNarrative, TITLES, type LedgerEntry } from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

const MAX_AT = TITLES[TITLES.length - 1]!.at; // 10

function mkEntries(tones: Tone[]): LedgerEntry[] {
  return tones.map((t, i) => ({
    index: i + 1,
    situation: `s${i + 1}`,
    deed: `d${i + 1}`,
    verdict: `v${i + 1}`,
    tone: t,
  }));
}

// ── 空记录 / 基础 ──────────────────────────────────────

test('hint: 空记录 → onPath=false（无主导语气）', () => {
  const h = hiddenEndingHint([]);
  assert.equal(h.onPath, false);
  assert.equal(h.path, null);
  assert.equal(h.dominant, null);
  assert.equal(h.unlocked, false);
});

test('hint: 空记录 deedsToUnlock = MAX_AT（10）', () => {
  const h = hiddenEndingHint([]);
  assert.equal(h.deedsToUnlock, MAX_AT);
});

test('hint: dominantRatio 空记录为 0', () => {
  assert.equal(hiddenEndingHint([]).dominantRatio, 0);
});

// ── 学术路径（辩经尊者）────────────────────────────────

test('hint: 单笔学术 → onPath=true / path=辩经尊者', () => {
  const h = hiddenEndingHint(mkEntries(['学术']));
  assert.equal(h.onPath, true);
  assert.equal(h.path, '辩经尊者');
  assert.equal(h.dominant, '学术');
  assert.equal(h.dominantRatio, 1);
});

test('hint: 多笔全学术（未满级）→ path=辩经尊者 / unlocked=false', () => {
  const h = hiddenEndingHint(mkEntries(Array(5).fill('学术')));
  assert.equal(h.path, '辩经尊者');
  assert.equal(h.unlocked, false);
  assert.equal(h.deedsToUnlock, MAX_AT - 5);
});

test('hint: 满级全学术 → unlocked=true / path=辩经尊者', () => {
  const h = hiddenEndingHint(mkEntries(Array(MAX_AT).fill('学术')));
  assert.equal(h.unlocked, true);
  assert.equal(h.path, '辩经尊者');
  assert.equal(h.deedsToUnlock, 0);
});

// ── 江湖路径（执剑尊者）────────────────────────────────

test('hint: 单笔江湖 → onPath=true / path=执剑尊者', () => {
  const h = hiddenEndingHint(mkEntries(['江湖']));
  assert.equal(h.onPath, true);
  assert.equal(h.path, '执剑尊者');
  assert.equal(h.dominant, '江湖');
});

test('hint: 满级全江湖 → unlocked=true / path=执剑尊者', () => {
  const h = hiddenEndingHint(mkEntries(Array(MAX_AT).fill('江湖')));
  assert.equal(h.unlocked, true);
  assert.equal(h.path, '执剑尊者');
});

// ── 非隐藏路径语气 ─────────────────────────────────────

test('hint: 主导佛系 → onPath=false（非隐藏路径）', () => {
  const h = hiddenEndingHint(mkEntries(Array(5).fill('佛系')));
  assert.equal(h.onPath, false);
  assert.equal(h.path, null);
  assert.equal(h.dominant, '佛系');
});

test('hint: 主导戏谑 → onPath=false', () => {
  const h = hiddenEndingHint(mkEntries(Array(5).fill('戏谑')));
  assert.equal(h.onPath, false);
});

test('hint: 主导庄严 → onPath=false', () => {
  const h = hiddenEndingHint(mkEntries(Array(5).fill('庄严')));
  assert.equal(h.onPath, false);
});

test('hint: 主导温情 → onPath=false', () => {
  const h = hiddenEndingHint(mkEntries(Array(5).fill('温情')));
  assert.equal(h.onPath, false);
});

// ── 占比阈值 ───────────────────────────────────────────

test('hint: 占比恰 0.5 边界 → onPath=true（>= 阈值）', () => {
  // 5 学术 + 5 江湖：平局按声明顺序学术(4)在江湖(5)前 → dominant=学术，占比 5/10=0.5
  const tones: Tone[] = [...Array(5).fill('学术'), ...Array(5).fill('江湖')] as Tone[];
  const h = hiddenEndingHint(mkEntries(tones));
  assert.equal(h.dominant, '学术');
  assert.equal(h.dominantRatio, 0.5);
  assert.equal(h.onPath, true); // 0.5 >= 0.5
  assert.equal(h.path, '辩经尊者');
});

test('hint: 占比低于阈值 → onPath=false', () => {
  // 3 学术 + 7 佛系：dominant=佛系（非隐藏路径语气）→ onPath=false
  const tones: Tone[] = [...Array(3).fill('学术'), ...Array(7).fill('佛系')] as Tone[];
  const h = hiddenEndingHint(mkEntries(tones));
  assert.equal(h.onPath, false);
});

test('hint: 自定义 ratioThreshold=0.8 → 占比 0.5 不再算 onPath', () => {
  // 5 学术 + 5 江湖：学术占比 0.5 < 0.8 阈值
  const tones: Tone[] = [...Array(5).fill('学术'), ...Array(5).fill('江湖')] as Tone[];
  const h = hiddenEndingHint(mkEntries(tones), 10, 0.8);
  assert.equal(h.onPath, false);
});

test('hint: 自定义 ratioThreshold=1.0 → 只有纯单一语气才算', () => {
  // 全学术 5 笔占比 1.0
  const h = hiddenEndingHint(mkEntries(Array(5).fill('学术')), 5, 1.0);
  assert.equal(h.onPath, true);
  // 4 学术 + 1 佛系 占比 0.8 < 1.0
  const h2 = hiddenEndingHint(mkEntries([...Array(4).fill('学术'), '佛系'] as Tone[]), 5, 1.0);
  assert.equal(h2.onPath, false);
});

// ── deedsToUnlock ──────────────────────────────────────

test('hint: deedsToUnlock = max(0, MAX_AT - count)', () => {
  for (const c of [0, 1, 5, 9, 10, 15]) {
    const h = hiddenEndingHint(mkEntries(Array(Math.min(c, 10)).fill('学术')), c);
    assert.equal(h.deedsToUnlock, Math.max(0, MAX_AT - c));
  }
});

test('hint: count 超过 MAX_AT → deedsToUnlock=0（钳制）', () => {
  const h = hiddenEndingHint(mkEntries(Array(MAX_AT).fill('学术')), 99);
  assert.equal(h.deedsToUnlock, 0);
  assert.equal(h.unlocked, true);
});

// ── count 参数独立 ─────────────────────────────────────

test('hint: count 参数独立于 entries.length（存档恢复）', () => {
  // entries 仅 1 笔学术，但 count 传 10 → unlocked=true
  const h = hiddenEndingHint(mkEntries(['学术']), MAX_AT);
  assert.equal(h.unlocked, true);
  assert.equal(h.deedsToUnlock, 0);
});

test('hint: count 传 0 即使 entries 满学术 → unlocked=false', () => {
  const h = hiddenEndingHint(mkEntries(Array(MAX_AT).fill('学术')), 0);
  assert.equal(h.unlocked, false);
  assert.equal(h.deedsToUnlock, MAX_AT);
});

// ── 与 endingNarrative 一致性（满级时）─────────────────

test('hint: 满级学术 → hint.path 与 endingNarrative.type 一致（辩经尊者）', () => {
  const e = mkEntries(Array(MAX_AT).fill('学术'));
  const h = hiddenEndingHint(e);
  const n = endingNarrative(e);
  assert.equal(h.path, n.type);
  assert.equal(h.path, '辩经尊者');
});

test('hint: 满级江湖 → hint.path 与 endingNarrative.type 一致（执剑尊者）', () => {
  const e = mkEntries(Array(MAX_AT).fill('江湖'));
  const h = hiddenEndingHint(e);
  const n = endingNarrative(e);
  assert.equal(h.path, n.type);
  assert.equal(h.path, '执剑尊者');
});

test('hint: 满级佛系 → hint.onPath=false 但 endingNarrative=渡世（基础结局）', () => {
  const e = mkEntries(Array(MAX_AT).fill('佛系'));
  const h = hiddenEndingHint(e);
  assert.equal(h.onPath, false);
  assert.equal(endingNarrative(e).type, '渡世');
});

// ── 纯函数 / 确定性 ────────────────────────────────────

test('hint: 纯函数——不修改入参 entries', () => {
  const e = mkEntries(['学术', '江湖', '学术']);
  const snap = JSON.stringify(e);
  hiddenEndingHint(e);
  assert.equal(JSON.stringify(e), snap);
});

test('hint: 确定性——同输入两次 deep equal', () => {
  const e = mkEntries(Array(5).fill('学术'));
  assert.deepEqual(hiddenEndingHint(e), hiddenEndingHint(e));
});

// ── 类型 ───────────────────────────────────────────────

test('hint: path 恒为 null 或两隐藏结局之一', () => {
  for (const tone of ['学术', '江湖', '佛系', '戏谑', '庄严', '温情'] as Tone[]) {
    const h = hiddenEndingHint(mkEntries(Array(5).fill(tone)));
    assert.ok(h.path === null || h.path === '辩经尊者' || h.path === '执剑尊者');
  }
});

test('hint: HiddenEndingPath 类型联合正确（两值）', () => {
  const paths: HiddenEndingPath[] = ['辩经尊者', '执剑尊者'];
  assert.equal(paths.length, 2);
});

// ── 未满级但已在路径上的预告语义 ───────────────────────

test('hint: 9 笔全学术（差 1 笔满级）→ onPath=true 且 deedsToUnlock=1（预告语义）', () => {
  const h = hiddenEndingHint(mkEntries(Array(9).fill('学术')));
  assert.equal(h.onPath, true);
  assert.equal(h.path, '辩经尊者');
  assert.equal(h.unlocked, false);
  assert.equal(h.deedsToUnlock, 1);
});

test('hint: 9 笔全江湖（差 1 笔满级）→ onPath=true 且 deedsToUnlock=1', () => {
  const h = hiddenEndingHint(mkEntries(Array(9).fill('江湖')));
  assert.equal(h.onPath, true);
  assert.equal(h.path, '执剑尊者');
  assert.equal(h.deedsToUnlock, 1);
});

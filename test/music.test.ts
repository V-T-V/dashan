/**
 * 大善系统 —— 情境音乐推荐系统 测试（shared/music.ts）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MUSIC_LIBRARY,
  recommendMusic,
  recommendSignatureTrack,
  findTrack,
  recommendMusicPack,
  scoreTrack,
  musicLibraryStats,
} from '../shared/music.ts';
import type { Category, Tone, Difficulty } from '../shared/types.ts';

const ALL_CATEGORIES: Category[] = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];
const ALL_TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

// ── 库完整性 ─────────────────────────────────────────────

test('music: 库非空（至少 10 首）', () => {
  assert.ok(MUSIC_LIBRARY.length >= 10);
});

test('music: 每首曲目字段齐全', () => {
  for (const t of MUSIC_LIBRARY) {
    assert.ok(t.id, '应有 id');
    assert.ok(t.title, '应有 title');
    assert.ok(t.artist, '应有 artist');
    assert.ok(Array.isArray(t.tags) && t.tags.length > 0, '应有 tags');
    assert.ok(Array.isArray(t.mood) && t.mood.length > 0, '应有 mood');
    assert.ok(Array.isArray(t.categories) && t.categories.length > 0, '应有 categories');
    assert.ok(Array.isArray(t.tones) && t.tones.length > 0, '应有 tones');
    assert.ok(t.durationSec > 0, '应有正时长');
    assert.ok(t.blurb.length > 5, '应有 blurb');
  }
});

test('music: id 唯一', () => {
  const ids = MUSIC_LIBRARY.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('music: 库覆盖全 8 题材（合并 categories）', () => {
  const covered = new Set<Category>();
  for (const t of MUSIC_LIBRARY) for (const c of t.categories) covered.add(c);
  for (const c of ALL_CATEGORIES) assert.ok(covered.has(c), `题材 ${c} 应被覆盖`);
});

test('music: 库覆盖全 6 语气（合并 tones）', () => {
  const covered = new Set<Tone>();
  for (const t of MUSIC_LIBRARY) for (const tn of t.tones) covered.add(tn);
  for (const tn of ALL_TONES) assert.ok(covered.has(tn), `语气 ${tn} 应被覆盖`);
});

// ── scoreTrack ────────────────────────────────────────────

test('music: scoreTrack 题材命中 +3', () => {
  const t = MUSIC_LIBRARY[0]!;
  const cat = t.categories[0]!;
  assert.equal(scoreTrack(t, { category: cat }) >= 3, true);
});

test('music: scoreTrack 语气命中 +2', () => {
  const t = MUSIC_LIBRARY[0]!;
  const tn = t.tones[0]!;
  assert.ok(scoreTrack(t, { tone: tn }) >= 2);
});

test('music: scoreTrack 难度命中 +1', () => {
  const t = MUSIC_LIBRARY.find((x) => x.difficulties && x.difficulties.length > 0)!;
  const d = t.difficulties![0]!;
  assert.ok(scoreTrack(t, { difficulty: d }) >= 1);
});

test('music: scoreTrack 三轴全命中得分最高', () => {
  const t = MUSIC_LIBRARY[0]!;
  const cat = t.categories[0]!;
  const tn = t.tones[0]!;
  const d = (t.difficulties?.[0] ?? 1) as Difficulty;
  const full = scoreTrack(t, { category: cat, tone: tn, difficulty: d });
  const partial = scoreTrack(t, { category: cat });
  assert.ok(full > partial, `三轴全命中 ${full} 应 > 仅题材 ${partial}`);
});

test('music: scoreTrack 无命中得分低（可能为 0）', () => {
  const t = MUSIC_LIBRARY[0]!;
  // 找一个不在 t 任何轴的请求
  const otherCat = ALL_CATEGORIES.find((c) => !t.categories.includes(c))!;
  const otherTone = ALL_TONES.find((tn) => !t.tones.includes(tn))!;
  const s = scoreTrack(t, { category: otherCat, tone: otherTone, difficulty: 1 });
  // 至少难度可能 +1，但题材与语气必不命中
  assert.ok(s < 5, `无题材/语气命中应得分低：${s}`);
});

// ── recommendMusic ────────────────────────────────────────

test('music: recommendMusic 默认返回 3 首', () => {
  const r = recommendMusic({});
  assert.equal(r.length, 3);
});

test('music: recommendMusic limit 钳制', () => {
  assert.equal(recommendMusic({ limit: 0 }).length, 1);
  assert.equal(recommendMusic({ limit: 999 }).length, MUSIC_LIBRARY.length);
});

test('music: recommendMusic 按 score 降序', () => {
  const r = recommendMusic({ category: '战争', tone: '庄严', limit: 5 });
  const scores = r.map((t) => scoreTrack(t, { category: '战争', tone: '庄严' }));
  for (let i = 1; i < scores.length; i++) {
    assert.ok(scores[i]! <= scores[i - 1]!, `应降序：${scores.join(',')}`);
  }
});

test('music: recommendMusic 同分按库顺序（稳定性）', () => {
  // 空请求：所有曲目 score=0，应按库原始顺序
  const r = recommendMusic({ limit: 5 });
  const rIds = r.map((t) => t.id);
  const libIds = MUSIC_LIBRARY.slice(0, 5).map((t) => t.id);
  assert.deepEqual(rIds, libIds);
});

test('music: recommendMusic 确定性（同请求同输出）', () => {
  const req = { category: '医疗' as Category, tone: '佛系' as Tone };
  assert.deepEqual(recommendMusic(req), recommendMusic(req));
});

// ── recommendSignatureTrack ───────────────────────────────

test('music: recommendSignatureTrack 返回单首', () => {
  const t = recommendSignatureTrack({ category: '战争' });
  assert.ok(t && t.id);
});

test('music: recommendSignatureTrack 与 recommendMusic[0] 一致', () => {
  const req = { category: '医疗' as Category };
  assert.equal(recommendSignatureTrack(req).id, recommendMusic({ ...req, limit: 1 })[0]!.id);
});

// ── findTrack ─────────────────────────────────────────────

test('music: findTrack 按 id 查', () => {
  const t = MUSIC_LIBRARY[0]!;
  assert.equal(findTrack(t.id)?.id, t.id);
});

test('music: findTrack 不存在返回 undefined', () => {
  assert.equal(findTrack('不存在的id'), undefined);
});

// ── recommendMusicPack ────────────────────────────────────

test('music: recommendMusicPack 含 signature + alternatives + reason', () => {
  const pack = recommendMusicPack({ category: '战争', tone: '庄严', difficulty: 3 });
  assert.ok(pack.signature);
  assert.ok(Array.isArray(pack.alternatives));
  assert.ok(pack.alternatives.length <= 2);
  assert.ok(pack.reason.length > 10);
  assert.ok(pack.reason.includes(pack.signature.title));
});

test('music: recommendMusicPack reason 含题材/语气/难度关键词', () => {
  const pack = recommendMusicPack({ category: '医疗', tone: '佛系', difficulty: 2 });
  assert.ok(pack.reason.includes('医疗'));
  assert.ok(pack.reason.includes('佛系'));
  assert.ok(pack.reason.includes('进阶')); // difficulty 2 = 进阶
});

test('music: recommendMusicPack 深渊难度 reason 含「深渊」', () => {
  const pack = recommendMusicPack({ difficulty: 3 });
  assert.ok(pack.reason.includes('深渊'));
});

// ── musicLibraryStats ─────────────────────────────────────

test('music: musicLibraryStats total 与库长度一致', () => {
  assert.equal(musicLibraryStats().total, MUSIC_LIBRARY.length);
});

test('music: musicLibraryStats byCategory 计数正确', () => {
  const s = musicLibraryStats();
  // 计算每个题材的实际命中次数
  for (const c of ALL_CATEGORIES) {
    const expected = MUSIC_LIBRARY.filter((t) => t.categories.includes(c)).length;
    assert.equal(s.byCategory[c] ?? 0, expected, `题材 ${c} 计数`);
  }
});

test('music: musicLibraryStats byTone 计数正确', () => {
  const s = musicLibraryStats();
  for (const tn of ALL_TONES) {
    const expected = MUSIC_LIBRARY.filter((t) => t.tones.includes(tn)).length;
    assert.equal(s.byTone[tn] ?? 0, expected, `语气 ${tn} 计数`);
  }
});

test('music: musicLibraryStats byTag 非空且去重排序', () => {
  const s = musicLibraryStats();
  assert.ok(s.byTag.length > 0);
  assert.equal(new Set(s.byTag).size, s.byTag.length);
  // 已排序
  const sorted = [...s.byTag].sort();
  assert.deepEqual(s.byTag, sorted);
});

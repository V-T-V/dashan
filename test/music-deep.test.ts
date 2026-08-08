/**
 * R10-D5b: shared/music.ts 深层不变量测试。
 *
 * music.test.ts 覆盖主路径，这里补深层不变量：
 *  1. MUSIC_LIBRARY 数据完整性（categories/tones/difficulties 全合法/durationSec 正）
 *  2. scoreTrack 精确打分（题材+3/语气+2/难度+1/mood 关键词重叠 +0.5）
 *  3. scoreTrack mood 重叠逻辑（mood 含 tone 或 tone 含 mood 子串）
 *  4. recommendMusic limit 边界（0/负/超大/NaN）
 *  5. recommendMusic 稳定性（同分按 idx 严格升序）
 *  6. recommendSignatureTrack 永不 undefined
 *  7. findTrack 边界（空串/未知）
 *  8. recommendMusicPack 结构不变量（alternatives 长度=2 当库≥3）
 *  9. buildReason 各轴组合文案
 * 10. musicLibraryStats 计数手动重算一致
 * 11. 纯函数不修改库
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MUSIC_LIBRARY,
  scoreTrack,
  recommendMusic,
  recommendSignatureTrack,
  findTrack,
  recommendMusicPack,
  buildReason,
  musicLibraryStats,
} from '../shared/music.ts';
import type { Category, Tone } from '../shared/types.ts';

const CATEGORIES: Category[] = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];
const TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

// ── 数据完整性 ─────────────────────────────────────────

test('music-deep: 每首曲目 categories 全合法枚举且非空', () => {
  for (const t of MUSIC_LIBRARY) {
    assert.ok(t.categories.length > 0, `${t.id} categories 空`);
    for (const c of t.categories) {
      assert.ok((CATEGORIES as string[]).includes(c), `${t.id} 非法 category=${c}`);
    }
  }
});

test('music-deep: 每首曲目 tones 全合法枚举且非空', () => {
  for (const t of MUSIC_LIBRARY) {
    assert.ok(t.tones.length > 0, `${t.id} tones 空`);
    for (const tn of t.tones) {
      assert.ok((TONES as string[]).includes(tn), `${t.id} 非法 tone=${tn}`);
    }
  }
});

test('music-deep: 每首曲目 difficulties（若有）合法 1/2/3', () => {
  for (const t of MUSIC_LIBRARY) {
    if (t.difficulties) {
      for (const d of t.difficulties) {
        assert.ok([1, 2, 3].includes(d), `${t.id} 非法 difficulty=${d}`);
      }
    }
  }
});

test('music-deep: 每首曲目 durationSec 为正整数', () => {
  for (const t of MUSIC_LIBRARY) {
    assert.equal(typeof t.durationSec, 'number');
    assert.ok(t.durationSec > 0, `${t.id} durationSec 非正`);
  }
});

test('music-deep: 每首曲目 id/title/artist/blurb 非空', () => {
  for (const t of MUSIC_LIBRARY) {
    assert.ok(t.id.trim().length > 0);
    assert.ok(t.title.trim().length > 0);
    assert.ok(t.artist.trim().length > 0);
    assert.ok(t.blurb.trim().length > 0);
  }
});

test('music-deep: 每首曲目 tags/mood 非空数组', () => {
  for (const t of MUSIC_LIBRARY) {
    assert.ok(t.tags.length > 0, `${t.id} tags 空`);
    assert.ok(t.mood.length > 0, `${t.id} mood 空`);
  }
});

test('music-deep: MUSIC_LIBRARY id 全局唯一', () => {
  const ids = MUSIC_LIBRARY.map((t) => t.id);
  assert.equal(ids.length, new Set(ids).size);
});

test('music-deep: MUSIC_LIBRARY 覆盖全 8 题材', () => {
  const all = new Set<string>();
  for (const t of MUSIC_LIBRARY) for (const c of t.categories) all.add(c);
  for (const c of CATEGORIES) assert.ok(all.has(c), `缺题材 ${c}`);
});

test('music-deep: MUSIC_LIBRARY 覆盖全 6 语气', () => {
  const all = new Set<string>();
  for (const t of MUSIC_LIBRARY) for (const tn of t.tones) all.add(tn);
  for (const tn of TONES) assert.ok(all.has(tn), `缺语气 ${tn}`);
});

// ── scoreTrack 精确打分 ────────────────────────────────

test('music-deep: scoreTrack 三轴全命中（含 mood 重叠）≥ 3+2+1', () => {
  // 广陵散：categories=[战争,司法,人性] tones=[庄严,江湖] difficulties=[2,3]
  const t = findTrack('guqin-guangling')!;
  const score = scoreTrack(t, { category: '战争', tone: '庄严', difficulty: 3 });
  // 题材+3 语气+2 难度+1 mood 重叠看是否含「庄严」
  assert.ok(score >= 6);
});

test('music-deep: scoreTrack 仅题材命中 = 3（无 mood 重叠时）', () => {
  const t = findTrack('guqin-guangling')!;
  // 取不命中的语气避免 +2/+0.5
  const missTone = TONES.find((tn) => !t.tones.includes(tn) && !t.mood.some((m) => m.includes(tn) || tn.includes(m)))!;
  assert.equal(scoreTrack(t, { category: '战争', tone: missTone }), 3);
});

test('music-deep: scoreTrack 无难度字段的曲目指定难度仍 +1', () => {
  const tNoDiff = MUSIC_LIBRARY.find((x) => !x.difficulties)!;
  const cat = tNoDiff.categories[0]!;
  const base = scoreTrack(tNoDiff, { category: cat });
  const withDiff = scoreTrack(tNoDiff, { category: cat, difficulty: 2 });
  assert.equal(withDiff, base + 1);
});

test('music-deep: scoreTrack 难度不命中（曲目有 difficulties 但不含）不加分', () => {
  const tWithDiff = MUSIC_LIBRARY.find((x) => x.difficulties && x.difficulties.length > 0)!;
  const missDiff = ([1, 2, 3].find((d) => !tWithDiff.difficulties!.includes(d as never))) as 1 | 2 | 3;
  const cat = tWithDiff.categories[0]!;
  // 题材+3，难度不命中不加
  const missTone = TONES.find((tn) => !tWithDiff.tones.includes(tn) && !tWithDiff.mood.some((m) => m.includes(tn) || tn.includes(m)))!;
  assert.equal(scoreTrack(tWithDiff, { category: cat, tone: missTone, difficulty: missDiff }), 3);
});

test('music-deep: scoreTrack mood 关键词重叠 +0.5（tone 是 mood 子串）', () => {
  // 寺钟：mood=['空灵','放下','因果'] tones=['佛系']
  // 找一条 mood 含某 tone 子串的：广陵散 mood=['悲壮','决绝','苍凉']，无 tone 子串
  // 用「庄严」语气查 mood 含「庄严」的曲：安魂曲 mood=['庄严','悲悯','救赎']
  const t = findTrack('classical-requiem')!; // mood 含「庄严」
  // 题材+语气+难度+mood 全命中
  const s = scoreTrack(t, { category: '医疗', tone: '庄严', difficulty: 3 });
  // 3+2+1+0.5 = 6.5
  assert.equal(s, 6.5);
});

test('music-deep: scoreTrack 确定性（同参同分）', () => {
  const t = MUSIC_LIBRARY[0]!;
  assert.equal(scoreTrack(t, { category: t.categories[0] }), scoreTrack(t, { category: t.categories[0] }));
});

test('music-deep: scoreTrack 纯函数不修改 track', () => {
  const t = MUSIC_LIBRARY[0]!;
  const snap = JSON.stringify(t);
  scoreTrack(t, { category: '战争', tone: '庄严', difficulty: 3 });
  assert.equal(JSON.stringify(t), snap);
});

// ── recommendMusic 边界 ────────────────────────────────

test('music-deep: recommendMusic limit=0 钳制为 1', () => {
  assert.equal(recommendMusic({ limit: 0 }).length, 1);
});

test('music-deep: recommendMusic limit 负数钳制为 1', () => {
  assert.equal(recommendMusic({ limit: -10 }).length, 1);
});

test('music-deep: recommendMusic limit 超大钳制为库长', () => {
  assert.equal(recommendMusic({ limit: 99999 }).length, MUSIC_LIBRARY.length);
});

test('music-deep: recommendMusic 默认 limit=3', () => {
  assert.equal(recommendMusic({}).length, 3);
});

test('music-deep: recommendMusic 同分严格按 idx 升序（空请求全 0 分）', () => {
  const r = recommendMusic({ limit: 5 });
  for (let i = 0; i < r.length; i++) {
    assert.equal(r[i], MUSIC_LIBRARY[i]);
  }
});

test('music-deep: recommendMusic 按 score 降序', () => {
  const r = recommendMusic({ category: '战争', tone: '庄严', limit: 8 });
  const scores = r.map((t) => scoreTrack(t, { category: '战争', tone: '庄严' }));
  for (let i = 1; i < scores.length; i++) {
    assert.ok(scores[i]! <= scores[i - 1]!);
  }
});

test('music-deep: recommendMusic 确定性（同请求两次引用相等）', () => {
  const req = { category: '人性' as Category, tone: '佛系' as Tone, limit: 4 };
  const a = recommendMusic(req);
  const b = recommendMusic(req);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.equal(a[i], b[i]);
});

test('music-deep: recommendMusic 返回的曲目都在原库内', () => {
  const r = recommendMusic({ category: '医疗', limit: MUSIC_LIBRARY.length });
  for (const t of r) assert.ok(MUSIC_LIBRARY.includes(t));
});

test('music-deep: recommendMusic 命中题材的曲目优先于不命中（全库不变量）', () => {
  const cat = '司法' as Category;
  const r = recommendMusic({ category: cat, limit: MUSIC_LIBRARY.length });
  let lastHit = -1;
  for (let i = 0; i < r.length; i++) if (r[i]!.categories.includes(cat)) lastHit = i;
  const firstMiss = r.findIndex((t) => !t.categories.includes(cat));
  if (firstMiss !== -1 && lastHit !== -1) {
    assert.ok(lastHit < firstMiss, '命中应全部排在不命中之前');
  }
});

// ── recommendSignatureTrack ────────────────────────────

test('music-deep: recommendSignatureTrack 永不 undefined（库非空）', () => {
  for (const cat of CATEGORIES) {
    assert.ok(recommendSignatureTrack({ category: cat }));
  }
});

test('music-deep: recommendSignatureTrack 等价 recommendMusic limit=1[0]', () => {
  const req = { category: '战争' as Category, tone: '庄严' as Tone };
  assert.equal(recommendSignatureTrack(req), recommendMusic({ ...req, limit: 1 })[0]);
});

test('music-deep: recommendSignatureTrack 空请求返回库首', () => {
  assert.equal(recommendSignatureTrack({}), MUSIC_LIBRARY[0]);
});

// ── findTrack 边界 ─────────────────────────────────────

test('music-deep: findTrack 已知 id 返回曲目', () => {
  for (const t of MUSIC_LIBRARY) {
    assert.equal(findTrack(t.id), t);
  }
});

test('music-deep: findTrack 空串返回 undefined', () => {
  assert.equal(findTrack(''), undefined);
});

test('music-deep: findTrack 未知 id 返回 undefined', () => {
  assert.equal(findTrack('nonexistent-track'), undefined);
});

// ── recommendMusicPack ─────────────────────────────────

test('music-deep: recommendMusicPack signature 永不为空', () => {
  const p = recommendMusicPack({ category: '医疗' });
  assert.ok(p.signature);
  assert.ok(p.signature.title.length > 0);
});

test('music-deep: recommendMusicPack alternatives 长度 = 2（库≥3 时）', () => {
  const p = recommendMusicPack({ category: '人性' });
  assert.ok(MUSIC_LIBRARY.length >= 3);
  assert.equal(p.alternatives.length, 2);
});

test('music-deep: recommendMusicPack alternatives 不含 signature', () => {
  const p = recommendMusicPack({ category: '战争' });
  for (const a of p.alternatives) {
    assert.notEqual(a, p.signature);
  }
});

test('music-deep: recommendMusicPack reason 非空且含曲名', () => {
  const p = recommendMusicPack({ category: '医疗', tone: '温情' });
  assert.ok(p.reason.length > 0);
  assert.ok(p.reason.includes(p.signature.title));
});

test('music-deep: recommendMusicPack reason 各轴组合含关键词', () => {
  const p = buildReason({ category: '司法', tone: '庄严', difficulty: 3 }, MUSIC_LIBRARY[0]!);
  assert.ok(p.includes('司法'));
  assert.ok(p.includes('庄严'));
  assert.ok(p.includes('深渊'));
});

test('music-deep: buildReason 无轴时含「当前情境下」', () => {
  const r = buildReason({}, MUSIC_LIBRARY[0]!);
  assert.ok(r.includes('当前情境下'));
});

test('music-deep: buildReason 难度 1 含「初阶」、2 含「进阶」', () => {
  assert.ok(buildReason({ difficulty: 1 }, MUSIC_LIBRARY[0]!).includes('初阶'));
  assert.ok(buildReason({ difficulty: 2 }, MUSIC_LIBRARY[0]!).includes('进阶'));
});

// ── musicLibraryStats ──────────────────────────────────

test('music-deep: musicLibraryStats.total == MUSIC_LIBRARY.length', () => {
  assert.equal(musicLibraryStats().total, MUSIC_LIBRARY.length);
});

test('music-deep: musicLibraryStats.byCategory 手动重算一致', () => {
  const stats = musicLibraryStats();
  for (const c of CATEGORIES) {
    const manual = MUSIC_LIBRARY.filter((t) => t.categories.includes(c)).length;
    assert.equal(stats.byCategory[c], manual);
  }
});

test('music-deep: musicLibraryStats.byTone 手动重算一致', () => {
  const stats = musicLibraryStats();
  for (const tn of TONES) {
    const manual = MUSIC_LIBRARY.filter((t) => t.tones.includes(tn)).length;
    assert.equal(stats.byTone[tn], manual);
  }
});

test('music-deep: musicLibraryStats.byTag 去重且排序', () => {
  const tags = musicLibraryStats().byTag;
  // 排序检查
  const sorted = [...tags].sort();
  assert.deepEqual(tags, sorted);
  // 去重检查
  assert.equal(tags.length, new Set(tags).size);
});

test('music-deep: musicLibraryStats.byTag 非空', () => {
  assert.ok(musicLibraryStats().byTag.length > 0);
});

// ── 纯函数不修改库 ─────────────────────────────────────

test('music-deep: 全套函数不修改 MUSIC_LIBRARY', () => {
  const snap = JSON.stringify(MUSIC_LIBRARY);
  scoreTrack(MUSIC_LIBRARY[0]!, { category: '战争', tone: '庄严' });
  recommendMusic({ category: '医疗', limit: 5 });
  recommendSignatureTrack({ tone: '佛系' });
  findTrack('guqin-guangling');
  recommendMusicPack({ category: '司法' });
  buildReason({ category: '人性' }, MUSIC_LIBRARY[0]!);
  musicLibraryStats();
  assert.equal(JSON.stringify(MUSIC_LIBRARY), snap);
});

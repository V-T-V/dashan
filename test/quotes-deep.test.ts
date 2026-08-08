/**
 * R10-D5a: shared/quotes.ts 深层不变量测试。
 *
 * quotes.test.ts 覆盖主路径，这里补深层不变量：
 *  1. QUOTES 数据完整性（每条 categories/tones 全合法枚举/difficulties 合法）
 *  2. text 全局唯一（无完全重复的引语）
 *  3. author/school 非空
 *  4. scoreQuote 边界（缺省轴/三轴叠加精确值/难度缺省 vs 指定）
 *  5. recommendQuotes limit 边界（0/负/超大/NaN）
 *  6. recommendQuotes 稳定性：同分严格按 idx 升序
 *  7. recommendQuotes 命中题材永远优先于不命中（全库不变量）
 *  8. quoteOfTheMoment 永不返回 undefined（库非空）
 *  9. quotesBySchool 6 流派 + 西方都有
 * 10. quoteBySeed 取模回绕（seed 与 seed+N 等价当 N=库长）
 * 11. quoteBySeed 负数取 abs 后回绕
 * 12. renderQuote 精确格式（「text」 —— author《source》/ 无 source 不含《》）
 * 13. quoteLibraryStats 计数与库逐项一致（手动重算）
 * 14. 纯函数不修改库
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUOTES,
  scoreQuote,
  recommendQuotes,
  quoteOfTheMoment,
  quotesBySchool,
  quoteBySeed,
  quoteLibraryStats,
  renderQuote,
} from '../shared/quotes.ts';
import type { Category, Tone } from '../shared/types.ts';

const CATEGORIES: Category[] = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];
const TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
const SCHOOLS = ['儒家', '道家', '佛家', '法家', '墨家', '西方'] as const;

// ── 数据完整性 ─────────────────────────────────────────

test('quotes-deep: 每条引语 categories 全为合法题材枚举', () => {
  for (const q of QUOTES) {
    assert.ok(q.categories.length > 0, `${q.author} 引语 categories 不应为空`);
    for (const c of q.categories) {
      assert.ok((CATEGORIES as string[]).includes(c), `非法 category=${c}`);
    }
  }
});

test('quotes-deep: 每条引语 tones 全为合法语气枚举', () => {
  for (const q of QUOTES) {
    assert.ok(q.tones.length > 0, `${q.author} 引语 tones 不应为空`);
    for (const t of q.tones) {
      assert.ok((TONES as string[]).includes(t), `非法 tone=${t}`);
    }
  }
});

test('quotes-deep: 每条引语 difficulties（若有）为合法 1/2/3', () => {
  for (const q of QUOTES) {
    if (q.difficulties) {
      for (const d of q.difficulties) {
        assert.ok([1, 2, 3].includes(d), `非法 difficulty=${d}`);
      }
    }
  }
});

test('quotes-deep: 每条引语 text 非空且为字符串', () => {
  for (const q of QUOTES) {
    assert.equal(typeof q.text, 'string');
    assert.ok(q.text.trim().length > 0);
  }
});

test('quotes-deep: 每条引语 author/school 非空', () => {
  for (const q of QUOTES) {
    assert.ok(q.author.trim().length > 0);
    assert.ok(q.school.toString().trim().length > 0);
  }
});

test('quotes-deep: text 全局唯一（无完全重复的引语文本）', () => {
  const texts = QUOTES.map((q) => q.text);
  const uniq = new Set(texts);
  assert.equal(texts.length, uniq.size, '存在完全重复的引语文本');
});

test('quotes-deep: source（若有）非空字符串', () => {
  for (const q of QUOTES) {
    if (q.source !== undefined) {
      assert.equal(typeof q.source, 'string');
      assert.ok(q.source.trim().length > 0);
    }
  }
});

test('quotes-deep: QUOTES 库规模 ≥ 100 条（承诺）', () => {
  assert.ok(QUOTES.length >= 100);
});

// ── scoreQuote 精确打分 ────────────────────────────────

test('quotes-deep: scoreQuote 三轴全命中 = 3+2+1 = 6', () => {
  // 找一条带 difficulties 的引语，全轴命中
  const q = QUOTES.find((x) => x.difficulties && x.difficulties.length > 0)!;
  const cat = q.categories[0]!;
  const tone = q.tones[0]!;
  const diff = q.difficulties![0]!;
  assert.equal(scoreQuote(q, { category: cat, tone, difficulty: diff }), 6);
});

test('quotes-deep: scoreQuote 仅题材命中 = 3', () => {
  const q = QUOTES[0]!;
  const cat = q.categories[0]!;
  // 取一个不在 q.tones 的 tone
  const missTone = TONES.find((t) => !q.tones.includes(t))!;
  assert.equal(scoreQuote(q, { category: cat, tone: missTone }), 3);
});

test('quotes-deep: scoreQuote 仅语气命中 = 2', () => {
  const q = QUOTES[0]!;
  const tone = q.tones[0]!;
  const missCat = CATEGORIES.find((c) => !q.categories.includes(c))!;
  assert.equal(scoreQuote(q, { category: missCat, tone }), 2);
});

test('quotes-deep: scoreQuote 无任何轴命中 = 0', () => {
  const q = QUOTES[0]!;
  const missCat = CATEGORIES.find((c) => !q.categories.includes(c))!;
  const missTone = TONES.find((t) => !q.tones.includes(t))!;
  assert.equal(scoreQuote(q, { category: missCat, tone: missTone }), 0);
});

test('quotes-deep: scoreQuote difficulty 缺省（q 无 difficulties）命中 +1', () => {
  const qNoDiff = QUOTES.find((x) => !x.difficulties)!;
  const cat = qNoDiff.categories[0]!;
  // 加 difficulty 仍 +1（因为 q 无 difficulties 视为全难度）
  const withDiff = scoreQuote(qNoDiff, { category: cat, difficulty: 2 });
  const withoutDiff = scoreQuote(qNoDiff, { category: cat });
  assert.equal(withDiff, withoutDiff + 1);
});

test('quotes-deep: scoreQuote difficulty 不命中（q 有 difficulties 但不含）= 不加分', () => {
  const qWithDiff = QUOTES.find((x) => x.difficulties && x.difficulties.length > 0)!;
  const missDiff = ([1, 2, 3].find((d) => !qWithDiff.difficulties!.includes(d))) as number;
  const cat = qWithDiff.categories[0]!;
  // 指定不命中的 difficulty：题材 +3，难度不加分
  assert.equal(scoreQuote(qWithDiff, { category: cat, difficulty: missDiff }), 3);
});

test('quotes-deep: scoreQuote 确定性（同参同分）', () => {
  const q = QUOTES[5]!;
  const a = scoreQuote(q, { category: q.categories[0], tone: q.tones[0] });
  const b = scoreQuote(q, { category: q.categories[0], tone: q.tones[0] });
  assert.equal(a, b);
});

test('quotes-deep: scoreQuote 纯函数——不修改 quote', () => {
  const q = QUOTES[0]!;
  const snap = JSON.stringify(q);
  scoreQuote(q, { category: q.categories[0], tone: q.tones[0], difficulty: 1 });
  assert.equal(JSON.stringify(q), snap);
});

// ── recommendQuotes 边界 ───────────────────────────────

test('quotes-deep: recommendQuotes limit=0 钳制为 1（至少返回 1 条）', () => {
  const r = recommendQuotes({ limit: 0 });
  assert.equal(r.length, 1);
});

test('quotes-deep: recommendQuotes limit 负数钳制为 1', () => {
  const r = recommendQuotes({ limit: -5 });
  assert.equal(r.length, 1);
});

test('quotes-deep: recommendQuotes limit 超大钳制为库长', () => {
  const r = recommendQuotes({ limit: 99999 });
  assert.equal(r.length, QUOTES.length);
});

test('quotes-deep: recommendQuotes limit=库长 返回全部（有序）', () => {
  const r = recommendQuotes({ limit: QUOTES.length });
  assert.equal(r.length, QUOTES.length);
  // 每条返回的都在原库里
  for (const q of r) {
    assert.ok(QUOTES.includes(q));
  }
});

test('quotes-deep: recommendQuotes 同分严格按 idx 升序（稳定性）', () => {
  // 空请求：所有引语同分（0），应按库顺序返回前 N
  const r = recommendQuotes({ limit: 5 });
  for (let i = 0; i < r.length; i++) {
    assert.equal(r[i], QUOTES[i]);
  }
});

test('quotes-deep: recommendQuotes 全库不变量——命中题材的引语永远优先于不命中', () => {
  const cat = '司法' as Category;
  const r = recommendQuotes({ category: cat, limit: QUOTES.length });
  // 找到最后一个命中的位置
  let lastHitIdx = -1;
  for (let i = 0; i < r.length; i++) {
    if (r[i]!.categories.includes(cat)) lastHitIdx = i;
  }
  // 第一个不命中的位置（如果有）
  const firstMissIdx = r.findIndex((q) => !q.categories.includes(cat));
  if (firstMissIdx !== -1 && lastHitIdx !== -1) {
    assert.ok(lastHitIdx < firstMissIdx, '命中的应全部排在不命中的之前');
  }
});

test('quotes-deep: recommendQuotes 按 score 降序', () => {
  const r = recommendQuotes({ category: '战争', tone: '庄严', limit: 10 });
  const scores = r.map((q) => scoreQuote(q, { category: '战争', tone: '庄严' }));
  for (let i = 1; i < scores.length; i++) {
    assert.ok(scores[i]! <= scores[i - 1]!, '应降序');
  }
});

test('quotes-deep: recommendQuotes 确定性（同请求两次 deep equal）', () => {
  const req = { category: '人性' as Category, tone: '佛系' as Tone, limit: 5 };
  assert.deepEqual(recommendQuotes(req), recommendQuotes(req));
});

test('quotes-deep: recommendQuotes 空请求返回前 N 条（全 0 分按库顺序）', () => {
  const r = recommendQuotes({ limit: 3 });
  assert.equal(r.length, 3);
  assert.equal(r[0], QUOTES[0]);
});

// ── quoteOfTheMoment ───────────────────────────────────

test('quotes-deep: quoteOfTheMoment 永不返回 undefined（库非空）', () => {
  for (const cat of CATEGORIES) {
    const q = quoteOfTheMoment({ category: cat });
    assert.ok(q);
  }
});

test('quotes-deep: quoteOfTheMoment 等价 recommendQuotes limit=1[0]', () => {
  const req = { category: '医疗' as Category, tone: '温情' as Tone };
  assert.equal(quoteOfTheMoment(req), recommendQuotes({ ...req, limit: 1 })[0]);
});

test('quotes-deep: quoteOfTheMoment 返回的引语命中请求题材（若库中有命中）', () => {
  const cat = '司法' as Category;
  const q = quoteOfTheMoment({ category: cat });
  assert.ok(q.categories.includes(cat), '应命中题材');
});

// ── quotesBySchool ─────────────────────────────────────

test('quotes-deep: quotesBySchool 6 流派 + 西方都有引语', () => {
  for (const s of SCHOOLS) {
    const list = quotesBySchool(s);
    assert.ok(list.length > 0, `${s} 流派应有引语`);
  }
});

test('quotes-deep: quotesBySchool 计数之和 == 总数', () => {
  const total = SCHOOLS.reduce((sum, s) => sum + quotesBySchool(s).length, 0);
  assert.equal(total, QUOTES.length);
});

test('quotes-deep: quotesBySchool 返回的引语 school 全等于参数', () => {
  for (const s of SCHOOLS) {
    for (const q of quotesBySchool(s)) {
      assert.equal(q.school, s);
    }
  }
});

test('quotes-deep: quotesBySchool 不存在的流派返回空数组', () => {
  assert.equal(quotesBySchool('不存在' as never).length, 0);
});

// ── quoteBySeed ────────────────────────────────────────

test('quotes-deep: quoteBySeed 取模回绕（seed 与 seed+库长 等价）', () => {
  const n = QUOTES.length;
  for (const seed of [0, 1, 42, 100]) {
    assert.equal(quoteBySeed(seed), quoteBySeed(seed + n));
  }
});

test('quotes-deep: quoteBySeed 负数取 abs 后回绕（不抛错）', () => {
  for (const seed of [-1, -5, -99999]) {
    assert.doesNotThrow(() => quoteBySeed(seed));
    assert.equal(quoteBySeed(seed), quoteBySeed(Math.abs(seed)));
  }
});

test('quotes-deep: quoteBySeed 确定性（同 seed 同引语）', () => {
  assert.equal(quoteBySeed(7), quoteBySeed(7));
});

test('quotes-deep: quoteBySeed 返回的始终是库中合法引语', () => {
  for (const seed of [0, 1, 2, 100, 9999]) {
    assert.ok(QUOTES.includes(quoteBySeed(seed)));
  }
});

// ── renderQuote 精确格式 ───────────────────────────────

test('quotes-deep: renderQuote 有 source 时格式为「text」 —— author《source》', () => {
  const q = QUOTES.find((x) => x.source)!;
  const r = renderQuote(q);
  assert.ok(r.startsWith(`「${q.text}」`));
  assert.ok(r.includes(`—— ${q.author}`));
  assert.ok(r.includes(`《${q.source}》`));
});

test('quotes-deep: renderQuote 无 source 时不含《》', () => {
  const q = QUOTES.find((x) => !x.source)!;
  const r = renderQuote(q);
  assert.ok(!r.includes('《'));
  assert.ok(!r.includes('》'));
  assert.ok(r.includes(q.author));
});

test('quotes-deep: renderQuote 恒以「」包裹引语文本', () => {
  for (const q of QUOTES.slice(0, 10)) {
    const r = renderQuote(q);
    assert.ok(r.includes(`「${q.text}」`));
  }
});

// ── quoteLibraryStats 计数正确 ─────────────────────────

test('quotes-deep: quoteLibraryStats.total == QUOTES.length', () => {
  assert.equal(quoteLibraryStats().total, QUOTES.length);
});

test('quotes-deep: quoteLibraryStats.bySchool 6 流派齐全且计数手动重算一致', () => {
  const stats = quoteLibraryStats();
  for (const s of SCHOOLS) {
    assert.ok(s in stats.bySchool, `缺流派 ${s}`);
    const manual = QUOTES.filter((q) => q.school === s).length;
    assert.equal(stats.bySchool[s], manual);
  }
});

test('quotes-deep: quoteLibraryStats.byCategory 手动重算一致', () => {
  const stats = quoteLibraryStats();
  for (const c of CATEGORIES) {
    const manual = QUOTES.filter((q) => q.categories.includes(c)).length;
    assert.equal(stats.byCategory[c], manual);
  }
});

test('quotes-deep: quoteLibraryStats.byTone 手动重算一致', () => {
  const stats = quoteLibraryStats();
  for (const t of TONES) {
    const manual = QUOTES.filter((q) => q.tones.includes(t)).length;
    assert.equal(stats.byTone[t], manual);
  }
});

test('quotes-deep: quoteLibraryStats 确定性（两次调用 deep equal）', () => {
  assert.deepEqual(quoteLibraryStats(), quoteLibraryStats());
});

// ── 纯函数不修改库 ─────────────────────────────────────

test('quotes-deep: 全套函数不修改 QUOTES 库', () => {
  const snap = JSON.stringify(QUOTES);
  scoreQuote(QUOTES[0]!, { category: '司法', tone: '庄严' });
  recommendQuotes({ category: '战争', limit: 5 });
  quoteOfTheMoment({ tone: '佛系' });
  quotesBySchool('儒家');
  quoteBySeed(42);
  quoteLibraryStats();
  renderQuote(QUOTES[0]!);
  assert.equal(JSON.stringify(QUOTES), snap);
});

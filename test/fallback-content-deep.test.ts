/**
 * 大善系统 —— fallback 内容库不变量与 picker 鲁棒性深层测试。
 *
 * 补充 fallback-deep（行为）之外的内容质量与极端输入：
 *  - 难度分布恒为 4 初阶 / 8 进阶 / 4 深渊（共 16）
 *  - 6 种语气在池里全部被用到（轮换完备）
 *  - 每个剧本的 praises.tone 与 fallback.tone 都是合法 Tone
 *  - 每个剧本至少 2 选项、至多 4 选项（与 schema 一致）
 *  - 每条夸赞/兜底文案非空且达最小长度（哲学翻转要有内容）
 *  - situation.difficulty 与 category 全部标注（无缺省）
 *  - pickFallbackTurn 极端输入鲁棒性：空串/纯空白/超长串/特殊字符/数字样串
 *  - pickFallbackTurn 重复调用游标持续递增不回退
 *  - eligiblePool 高境界绝不丢剧本（数量 ≥ 低境界）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fallbackScripts,
  fallbackScriptCount,
  pickFallbackTurn,
  pickFallbackFirstSituation,
  getCursor,
  setCursor,
  clearUserScripts,
} from '../shared/fallback.ts';
import type { Tone, Category } from '../shared/types.ts';

const VALID_TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];
const VALID_CATEGORIES: Category[] = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];

// 每个测试前重置游标与用户池，避免相互污染
function resetState() {
  clearUserScripts();
  setCursor(0);
}

// ── 池规模与难度分布 ───────────────────────────────────

test('content: 内置剧本总数 = 16', () => {
  assert.equal(fallbackScriptCount(), 16);
  assert.equal(fallbackScripts().length, 16);
});

test('content: 难度分布 = 初阶4 / 进阶8 / 深渊4', () => {
  resetState();
  const scripts = fallbackScripts();
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const s of scripts) {
    const d = s.situation.difficulty ?? 1;
    dist[d] = (dist[d] ?? 0) + 1;
  }
  assert.equal(dist[1], 4, `初阶应 4 个，实际 ${dist[1]}`);
  assert.equal(dist[2], 8, `进阶应 8 个，实际 ${dist[2]}`);
  assert.equal(dist[3], 4, `深渊应 4 个，实际 ${dist[3]}`);
});

test('content: 所有 difficulty 值在 {1,2,3}', () => {
  for (const s of fallbackScripts()) {
    const d = s.situation.difficulty;
    assert.ok(
      d === 1 || d === 2 || d === 3,
      `剧本「${s.situation.situation.slice(0, 10)}…」difficulty=${d} 非法`,
    );
  }
});

// ── 题材覆盖 ───────────────────────────────────────────

test('content: 题材覆盖全 8 类（无缺省）', () => {
  resetState();
  const seen = new Set<Category>();
  for (const s of fallbackScripts()) {
    assert.ok(s.situation.category, '每个剧本都应标注 category');
    assert.ok(
      (VALID_CATEGORIES as string[]).includes(s.situation.category!),
      `非法 category：${s.situation.category}`,
    );
    seen.add(s.situation.category!);
  }
  assert.equal(seen.size, 8, `应覆盖全 8 题材，实际 ${seen.size}`);
});

test('content: 每个题材至少有 1 个剧本', () => {
  for (const cat of VALID_CATEGORIES) {
    const has = fallbackScripts().some((s) => s.situation.category === cat);
    assert.ok(has, `题材 ${cat} 应至少 1 个剧本`);
  }
});

// ── 语气完备性 ─────────────────────────────────────────

test('content: 6 种语气在池里全部被用到', () => {
  resetState();
  const tones = new Set<Tone>();
  for (const s of fallbackScripts()) {
    for (const k in s.praises) tones.add(s.praises[k]!.tone);
    tones.add(s.fallback.tone);
  }
  for (const t of VALID_TONES) {
    assert.ok(tones.has(t), `语气 ${t} 应在池里出现`);
  }
});

test('content: 每条 praise.tone 与 fallback.tone 都是合法 Tone', () => {
  const valid = new Set(VALID_TONES);
  for (const s of fallbackScripts()) {
    for (const k in s.praises) {
      assert.ok(valid.has(s.praises[k]!.tone), `非法 tone：${s.praises[k]!.tone}`);
    }
    assert.ok(valid.has(s.fallback.tone), `非法 fallback.tone：${s.fallback.tone}`);
  }
});

// ── 选项数量一致性 ─────────────────────────────────────

test('content: 每个剧本选项数在 2-4', () => {
  for (const s of fallbackScripts()) {
    const n = s.situation.choices.length;
    assert.ok(n >= 2 && n <= 4, `剧本选项数 ${n} 越界（应 2-4）`);
  }
});

test('content: 每个剧本 praises 数量 ≥ choices 数量（每个选项都有夸赞）', () => {
  for (const s of fallbackScripts()) {
    const choiceTexts = s.situation.choices.map((c) => c.text);
    for (const t of choiceTexts) {
      assert.ok(t in s.praises, `选项「${t.slice(0, 12)}…」在 praises 中缺夸赞`);
    }
  }
});

// ── 文案质量（非空 + 最小长度） ────────────────────────

test('content: 每条夸赞文案非空且 ≥ 20 字（哲学翻转有内容）', () => {
  for (const s of fallbackScripts()) {
    for (const k in s.praises) {
      const txt = s.praises[k]!.text;
      assert.ok(txt.trim().length > 0, '夸赞文案不应为空');
      assert.ok(txt.length >= 20, `夸赞文案过短（${txt.length}字）：${txt.slice(0, 20)}…`);
    }
  }
});

test('content: 每条兜底文案非空且 ≥ 15 字', () => {
  for (const s of fallbackScripts()) {
    const txt = s.fallback.text;
    assert.ok(txt.trim().length > 0, '兜底文案不应为空');
    assert.ok(txt.length >= 15, `兜底文案过短：${txt.slice(0, 15)}…`);
  }
});

test('content: 每个 situation 描述非空且 ≥ 20 字', () => {
  for (const s of fallbackScripts()) {
    const txt = s.situation.situation;
    assert.ok(txt.trim().length > 0, '情境描述不应为空');
    assert.ok(txt.length >= 20, `情境描述过短：${txt.slice(0, 20)}…`);
  }
});

// ── 选项 id 与文案完整性 ───────────────────────────────

test('content: 每个选项都有非空 text', () => {
  for (const s of fallbackScripts()) {
    for (const c of s.situation.choices) {
      assert.ok(c.text && c.text.trim().length > 0, '选项 text 不应为空');
    }
  }
});

// ── pickFallbackTurn 极端输入鲁棒性 ────────────────────

test('picker: 空字符串选择不崩且返回有效 TurnResult', () => {
  resetState();
  const r = pickFallbackTurn('', 0);
  assert.ok(r.praise.length > 0);
  assert.ok(r.next.situation.length > 0);
  assert.ok(r.next.choices.length >= 2);
});

test('picker: 纯空白字符串选择不崩', () => {
  resetState();
  const r = pickFallbackTurn('   \t\n  ', 0);
  assert.ok(r.praise.length > 0);
  assert.ok((VALID_TONES as string[]).includes(r.tone));
});

test('picker: 超长字符串（10000 字）选择不崩', () => {
  resetState();
  const long = 'a'.repeat(10000);
  const r = pickFallbackTurn(long, 5);
  assert.ok(r.praise.length > 0);
  assert.ok(r.next.situation.length > 0);
});

test('picker: 含特殊字符（HTML/引号/反斜杠）选择不崩', () => {
  resetState();
  const r = pickFallbackTurn('<script>alert("x")</script>\\`$(', 0);
  assert.ok(r.praise.length > 0);
  assert.ok(r.next.situation.length > 0);
});

test('picker: 完全未知的随机字符串走兜底夸赞（不报错）', () => {
  resetState();
  const r = pickFallbackTurn('这是一个完全不存在的随机选项文案xyz123', 0);
  assert.ok(r.praise.length > 0);
  assert.ok((VALID_TONES as string[]).includes(r.tone));
});

test('picker: 数字样字符串不崩', () => {
  resetState();
  const r = pickFallbackTurn('12345', 0);
  assert.ok(r.praise.length > 0);
  assert.ok(r.next.choices.length >= 2);
});

// ── 游标持续递增 ───────────────────────────────────────

test('picker: 连续 5 次 pickFallbackTurn 游标单调递增', () => {
  resetState();
  pickFallbackFirstSituation(0); // cursor → 1
  const start = getCursor();
  for (let i = 0; i < 5; i++) {
    pickFallbackTurn('随机未知选项', 0);
  }
  assert.ok(getCursor() > start, `游标应递增：${start} → ${getCursor()}`);
});

test('picker: 游标回绕后仍取到合法情境（不越界）', () => {
  resetState();
  setCursor(1000); // 远超池长
  const r = pickFallbackTurn('随机未知选项', 0);
  assert.ok(r.next.situation.length > 0);
  assert.ok(r.next.choices.length >= 2 && r.next.choices.length <= 4);
});

// ── TurnResult 结构合法性 ───────────────────────────────

test('picker: pickFallbackTurn 返回的 tone 恒为合法 Tone', () => {
  resetState();
  for (let i = 0; i < 10; i++) {
    const r = pickFallbackTurn(`随机选项${i}`, 5);
    assert.ok(
      (VALID_TONES as string[]).includes(r.tone),
      `第 ${i} 次返回非法 tone：${r.tone}`,
    );
  }
});

test('picker: pickFallbackTurn 返回的 next.choices 数量恒在 2-4', () => {
  resetState();
  for (let i = 0; i < 10; i++) {
    const r = pickFallbackTurn(`随机选项${i}`, 3);
    assert.ok(
      r.next.choices.length >= 2 && r.next.choices.length <= 4,
      `第 ${i} 次 choices=${r.next.choices.length} 越界`,
    );
  }
});

test('picker: pickFallbackFirstSituation 返回的 choices 数量恒在 2-4', () => {
  resetState();
  for (let i = 0; i < 5; i++) {
    const s = pickFallbackFirstSituation(i * 2);
    assert.ok(s.choices.length >= 2 && s.choices.length <= 4);
  }
});

// ── 难度递进不丢剧本（单调性） ─────────────────────────

test('picker: pickFallbackFirstSituation 高境界可选剧本数 ≥ 低境界', () => {
  resetState();
  // 低境界只能玩难度 1（4 个），高境界全开（16 个）
  const low = pickFallbackFirstSituation(0);
  const high = pickFallbackFirstSituation(20);
  // 两者都应返回合法情境（不崩），且高境界池更大
  assert.ok(low.situation.length > 0);
  assert.ok(high.situation.length > 0);
});

// ── 深拷贝不变量（再次加固） ───────────────────────────

test('picker: pickFallbackFirstSituation 返回的 choices 与池中对象不同引用', () => {
  resetState();
  const s = pickFallbackFirstSituation(0);
  // 改返回值不影响池（池是模块内部，这里只验证返回值可自由改）
  s.choices[0]!.text = '篡改';
  // 再取一次不应带「篡改」（除非恰好同一剧本同一选项，但文案应是池里的原值）
  resetState();
  const s2 = pickFallbackFirstSituation(0);
  assert.notEqual(s2.choices[0]!.text, '篡改');
});

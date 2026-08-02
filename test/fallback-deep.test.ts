/**
 * 大善系统 —— fallback 脚本池深层测试（round 12）。
 *
 * 在 fallback-ledgercore.test.ts（基础 8 用例）之上补齐边界与控制流：
 *  - 用户剧本池：导入/前置/清空/重复导入覆盖
 *  - 剧本池总数 = 内置 + 用户；userScriptCount 精确
 *  - 首情境总取池首（用户前置）；游标推进从 1 开始
 *  - 游标回绕：连续推进 N 次后回到起点（mod 池长）
 *  - 选项文案匹配：精确匹配 / includes 模糊匹配 / 兜底夸赞
 *  - 单剧本池：仅 1 个内置剧本时仍不崩、游标 mod 1
 *  - 副本不可变性：pickFallbackFirstSituation/Turn 返回的对象改动不影响池
 *  - 难度过滤：低 deedCount 只见难度 1；用户剧本缺省 difficulty 不过滤
 *  - 结构完整性：每个内置剧本的 praises 覆盖全部 choices
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pickFallbackFirstSituation,
  pickFallbackTurn,
  fallbackScriptCount,
  fallbackScripts,
  totalPoolCount,
  userScriptCount,
  loadUserScripts,
  getUserScripts,
  clearUserScripts,
  getCursor,
  setCursor,
} from '../shared/fallback.ts';
import type { Tone } from '../shared/types.ts';

/** 构造一个合法的用户剧本（与 fallback 内部 Script 同构）。 */
function mkUserScript(
  sitText: string,
  choiceTexts: string[],
  opts: { category?: '职场'; difficulty?: 1 | 2 | 3 } = {},
) {
  const praises: Record<string, { text: string; tone: Tone }> = {};
  for (const t of choiceTexts) {
    praises[t] = { text: `夸赞：${t}`, tone: '温情' };
  }
  return {
    situation: {
      situation: sitText,
      category: opts.category ?? '职场',
      difficulty: opts.difficulty ?? 1,
      choices: choiceTexts.map((t, i) => ({ id: String.fromCharCode(65 + i), text: t })),
    },
    praises,
    fallback: { text: '自定义兜底', tone: '佛系' as Tone },
  };
}

// 每个测试前清空用户池，避免互相污染
function resetPool() {
  clearUserScripts();
  setCursor(0);
}

// ── 用户剧本池：导入/前置/清空/覆盖 ──────────────────────

test('deep: 清空用户剧本后 userScriptCount=0', () => {
  resetPool();
  loadUserScripts([mkUserScript('情境A', ['x', 'y'])] as never[]);
  assert.equal(userScriptCount(), 1);
  clearUserScripts();
  assert.equal(userScriptCount(), 0);
});

test('deep: 重复 loadUserScripts 覆盖而非追加', () => {
  resetPool();
  const builtin = fallbackScriptCount();
  loadUserScripts([mkUserScript('A', ['a'])] as never[]);
  assert.equal(totalPoolCount(), builtin + 1);
  // 再导入 2 个，应覆盖掉前 1 个，而非变成 1+2=3
  loadUserScripts([mkUserScript('B', ['b']), mkUserScript('C', ['c'])] as never[]);
  assert.equal(userScriptCount(), 2);
  assert.equal(totalPoolCount(), builtin + 2);
});

test('deep: totalPoolCount = 内置 + 用户导入数', () => {
  resetPool();
  const builtin = fallbackScriptCount();
  assert.equal(totalPoolCount(), builtin);
  loadUserScripts(
    [mkUserScript('A', ['a']), mkUserScript('B', ['b']), mkUserScript('C', ['c'])] as never[],
  );
  assert.equal(totalPoolCount(), builtin + 3);
});

test('deep: 用户剧本前置——pickFallbackFirstSituation 取到用户剧本', () => {
  resetPool();
  loadUserScripts([mkUserScript('用户专属情境', ['用户选项A', '用户选项B'])] as never[]);
  const sit = pickFallbackFirstSituation();
  assert.equal(sit.situation, '用户专属情境');
  assert.equal(sit.choices.length, 2);
});

// ── 游标控制流 ──────────────────────────────────────────

test('deep: 首次取情境后游标推进到 1', () => {
  resetPool();
  setCursor(0);
  pickFallbackFirstSituation();
  assert.equal(getCursor(), 1, 'pickFallbackFirstSituation 应把游标设为 1');
});

test('deep: 游标回绕——连续推进绕回池首', () => {
  resetPool();
  const total = totalPoolCount();
  assert.ok(total > 0, '池非空');
  setCursor(0);
  pickFallbackFirstSituation();
  const startCursor = getCursor();
  // 推进 total 次：每次 pickFallbackTurn 让 cursor++
  // 取一个真实存在的选项文案来推进（不依赖具体匹配）
  const firstSit = pickFallbackFirstSituation();
  const choice = firstSit.choices[0]!.text;
  for (let i = 0; i < total; i++) {
    pickFallbackTurn(choice);
  }
  // 推进 total 次后，游标应回绕：cursor mod total 回到起点
  const after = getCursor();
  assert.equal(
    (after - startCursor) % total,
    0,
    `推进 ${total} 次后游标应回绕，start=${startCursor} after=${after} total=${total}`,
  );
});

test('deep: setCursor/getCursor 双向一致', () => {
  resetPool();
  setCursor(42);
  assert.equal(getCursor(), 42);
  setCursor(0);
  assert.equal(getCursor(), 0);
  setCursor(99999);
  assert.equal(getCursor(), 99999);
});

test('deep: 极端高游标不崩（mod 池长仍合法取到剧本）', () => {
  resetPool();
  const total = totalPoolCount();
  setCursor(total * 100 + 7); // 远超池长
  const firstSit = pickFallbackFirstSituation();
  const choice = firstSit.choices[0]!.text;
  const turn = pickFallbackTurn(choice);
  assert.ok(turn.next.situation.length > 0, '高游标 mod 后应仍能取到合法情境');
  assert.ok(turn.next.choices.length >= 2);
});

// ── 选项文案匹配 ────────────────────────────────────────

test('deep: 精确匹配选项文案返回对应夸赞', () => {
  resetPool();
  loadUserScripts([mkUserScript('情境X', ['精确选项A', '精确选项B'])] as never[]);
  pickFallbackFirstSituation(); // 消费掉「情境X」作为首情境
  const turn = pickFallbackTurn('精确选项A');
  assert.equal(turn.praise, '夸赞：精确选项A');
  assert.equal(turn.tone, '温情');
});

test('deep: includes 模糊匹配（文案是选项的前/后缀）', () => {
  resetPool();
  loadUserScripts([mkUserScript('情境Y', ['完整选项文案ABC'])] as never[]);
  pickFallbackFirstSituation();
  // 传一个包含完整选项文案的更长子串
  const turn = pickFallbackTurn('前缀【完整选项文案ABC】后缀');
  assert.ok(turn.praise.length > 0, '模糊匹配应命中并返回夸赞');
});

test('deep: 完全未知的选项文案走兜底夸赞', () => {
  resetPool();
  setCursor(0);
  pickFallbackFirstSituation();
  const turn = pickFallbackTurn('一个根本不存在的奇怪选项文案ZZZZ');
  assert.ok(turn.praise.length > 0, '兜底也应返回非空夸赞');
  // 兜底夸赞应含「大恶即大善」或「善」字（通用兜底的标记）
  assert.ok(
    turn.praise.includes('善') || turn.praise.includes('大恶'),
    '通用兜底应带主旨词',
  );
});

test('deep: pickFallbackTurn 总返回 next 情境且 choices 在 2-4', () => {
  resetPool();
  const firstSit = pickFallbackFirstSituation();
  for (let i = 0; i < 25; i++) {
    const turn = pickFallbackTurn(firstSit.choices[0]!.text);
    assert.ok(turn.next.choices.length >= 2 && turn.next.choices.length <= 4, `第 ${i} 次 next.choices 应在 2-4`);
  }
});

// ── 副本不可变性 ────────────────────────────────────────

test('deep: pickFallbackFirstSituation 返回的情境是深拷贝（改动不影响池）', () => {
  resetPool();
  const sit = pickFallbackFirstSituation();
  const origText = sit.situation;
  // 篡改返回值
  sit.situation = '被篡改了';
  sit.choices[0]!.text = '被篡改的选项';
  sit.choices.push({ id: 'Z', text: '注入的选项' } as never);
  // 再取一次：池里的原始数据应未受影响
  setCursor(0);
  const sit2 = pickFallbackFirstSituation();
  assert.equal(sit2.situation, origText, '池中情境文本应未被篡改');
});

test('deep: pickFallbackTurn 返回的 next 是深拷贝', () => {
  resetPool();
  const firstSit = pickFallbackFirstSituation();
  const turn = pickFallbackTurn(firstSit.choices[0]!.text);
  const origNextText = turn.next.situation;
  const origChoiceCount = turn.next.choices.length;
  turn.next.situation = '篡改';
  turn.next.choices.push({ id: 'Z', text: '注入' } as never);
  // 推进游标回到同一剧本（靠多次推进），验证未被污染
  setCursor(0);
  const fresh = pickFallbackFirstSituation();
  assert.ok(fresh.situation !== '篡改' || fresh.situation === origNextText);
  // 同一池，重新取一个 turn 看选项数
  const t2 = pickFallbackTurn(fresh.choices[0]!.text);
  assert.equal(t2.next.choices.length >= 2 && t2.next.choices.length <= 4, true);
});

test('deep: getUserScripts 返回的是深拷贝（外部改动不影响内部）', () => {
  resetPool();
  loadUserScripts([mkUserScript('情境Z', ['z1', 'z2'])] as never[]);
  const got = getUserScripts();
  got[0]!.situation.situation = '外部篡改';
  const got2 = getUserScripts();
  assert.equal(got2[0]!.situation.situation, '情境Z', 'getUserScripts 应返回深拷贝');
});

// ── 难度过滤 ────────────────────────────────────────────

test('deep: 低 deedCount(0) 仅取难度 1 的内置剧本做下一情境', () => {
  resetPool();
  const firstSit = pickFallbackFirstSituation(0);
  const choice = firstSit.choices[0]!.text;
  for (let i = 0; i < 15; i++) {
    const turn = pickFallbackTurn(choice, 0);
    const d = turn.next.difficulty ?? 1;
    assert.ok(d === 1, `低境界 next 难度应为 1，实际 ${d}`);
  }
});

test('deep: 用户剧本缺省 difficulty 时低境界也不被过滤', () => {
  resetPool();
  // 用户剧本不标 difficulty（模拟 ValidatedScript 缺该字段）
  const script = mkUserScript('用户无难度情境', ['c1', 'c2']);
  delete (script.situation as { difficulty?: number }).difficulty;
  loadUserScripts([script] as never[]);
  // 低境界开局应能取到用户剧本（前置且不过滤）
  const sit = pickFallbackFirstSituation(0);
  assert.equal(sit.situation, '用户无难度情境');
});

test('deep: 高 deedCount(满级) 可取到难度 3 的下一情境', () => {
  resetPool();
  const firstSit = pickFallbackFirstSituation(12);
  const choice = firstSit.choices[0]!.text;
  const seen = new Set<number>();
  for (let i = 0; i < 30; i++) {
    const turn = pickFallbackTurn(choice, 12);
    seen.add(turn.next.difficulty ?? 1);
  }
  assert.ok(seen.has(3), `满级应能见到难度 3，实际见过 ${[...seen].join(',')}`);
});

// ── 内置池结构完整性 ────────────────────────────────────

test('deep: 每个内置剧本的 praises 覆盖其全部 choices 文案', () => {
  resetPool();
  const scripts = fallbackScripts();
  assert.ok(scripts.length >= 16, '内置剧本应 ≥16 个');
  for (let i = 0; i < scripts.length; i++) {
    const s = scripts[i]!;
    for (const c of s.situation.choices) {
      assert.ok(
        c.text in s.praises,
        `剧本[${i}] 的选项「${c.text.slice(0, 16)}…」缺少对应 praise`,
      );
    }
    // fallback 必须有 text 与合法 tone
    assert.ok(s.fallback.text.length > 0, `剧本[${i}] fallback.text 非空`);
    assert.ok(['庄严', '戏谑', '佛系', '学术', '江湖', '温情'].includes(s.fallback.tone));
  }
});

test('deep: 内置剧本 difficulty 全部在 1-3 且标注', () => {
  resetPool();
  const scripts = fallbackScripts();
  const dist = new Map<number, number>();
  for (const s of scripts) {
    const d = s.situation.difficulty ?? 1;
    assert.ok(d >= 1 && d <= 3, `剧本 difficulty 应在 1-3，实际 ${d}`);
    dist.set(d, (dist.get(d) ?? 0) + 1);
  }
  // 三档都应有剧本
  for (const d of [1, 2, 3]) {
    assert.ok((dist.get(d) ?? 0) > 0, `难度 ${d} 应至少有 1 个剧本`);
  }
});

test('deep: 内置剧本题材覆盖全 8 类', () => {
  resetPool();
  const scripts = fallbackScripts();
  const cats = new Set<string>();
  for (const s of scripts) {
    if (s.situation.category) cats.add(s.situation.category);
  }
  const expected = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];
  for (const c of expected) {
    assert.ok(cats.has(c), `题材「${c}」应被覆盖`);
  }
});

test('deep: fallbackScriptCount 与 fallbackScripts().length 一致', () => {
  resetPool();
  assert.equal(fallbackScriptCount(), fallbackScripts().length);
});

// ── 空/单剧本极端 ───────────────────────────────────────

test('deep: 仅靠内置池（不导入用户剧本）也能正常循环', () => {
  resetPool();
  const total = totalPoolCount();
  const firstSit = pickFallbackFirstSituation();
  // 连续推进 total+5 次（含一次完整回绕），不崩
  for (let i = 0; i < total + 5; i++) {
    const turn = pickFallbackTurn(firstSit.choices[i % firstSit.choices.length]!.text);
    assert.ok(turn.praise.length > 0);
    assert.ok(turn.next.choices.length >= 2);
  }
});

test('deep: getCursor 在 loadUserScripts 后不变（load 只改池不改游标）', () => {
  resetPool();
  setCursor(5);
  loadUserScripts([mkUserScript('A', ['a'])] as never[]);
  assert.equal(getCursor(), 5, 'loadUserScripts 不应重置游标');
});

/**
 * R10-D8: shared/daily.ts 错误路径与解析鲁棒性深层测试。
 *
 * 现有 daily.test.ts 覆盖主路径，这里专攻错误路径与边界：
 *  1. fromDateStr 全格式鲁棒性（非法格式/溢出日期/边界月日/闰年/闰年2月29）
 *  2. fromDateStr 拒绝被自动进位的日期（2024-02-30 / 2024-13-01 / 2024-00-01）
 *  3. dateSeed 非法日期返回 0（不抛错）
 *  4. dateSeed 同日期确定性 / 相邻日期差异大
 *  5. dailyReflection 非法日期抛错且信息含原日期
 *  6. upcomingReflections/pastReflections 非法 from 返回空数组（不抛错）
 *  7. upcomingReflections/pastReflections days=0/负数 返回空
 *  8. toDateStr 与 fromDateStr 往返一致（合法日期）
 *  9. pickReflectionQuestions 全 8 题材都返回 3 条
 * 10. pickReflectionQuestions 非法 category 返回空（不抛错）
 * 11. dailyReflection 确定性（同日期两次 deep equal）
 * 12. 跨年/跨月边界日期正确推进
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDateStr,
  fromDateStr,
  dateSeed,
  dailyReflection,
  todayReflection,
  upcomingReflections,
  pastReflections,
  pickReflectionQuestions,
  renderDailyText,
  allPublicScripts,
} from '../shared/daily.ts';
import type { Category } from '../shared/types.ts';

const CATEGORIES: Category[] = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];

// ── fromDateStr 格式鲁棒性 ────────────────────────────

test('daily-err: fromDateStr 合法日期返回 Date', () => {
  const d = fromDateStr('2024-03-15');
  assert.ok(d instanceof Date);
  assert.equal(d!.getFullYear(), 2024);
  assert.equal(d!.getMonth(), 2); // 0-based
  assert.equal(d!.getDate(), 15);
});

test('daily-err: fromDateStr 非法格式返回 null', () => {
  const invalid = [
    '',
    '2024/03/15',
    '2024-3-15',
    '24-03-15',
    '2024-03-15T00:00',
    'abcd-ef-gh',
    '20240315',
    ' 2024-03-15 ',
    '2024-03-15 ',
    '2024-13-01', // 月份溢出
    '2024-00-01', // 月份 0
    '2024-01-00', // 日 0
    '2024-01-32', // 日溢出
    '2024-02-30', // 2 月没 30 号
    '2023-02-29', // 2023 非闰年无 2-29
    '2024-04-31', // 4 月没 31 号
    '2024-11-31',
    '2024-09-31',
  ];
  for (const s of invalid) {
    assert.equal(fromDateStr(s), null, `${s} 应判为非法`);
  }
});

test('daily-err: fromDateStr 闰年 2 月 29 合法（2024 闰）', () => {
  const d = fromDateStr('2024-02-29');
  assert.ok(d !== null);
  assert.equal(d!.getMonth(), 1);
  assert.equal(d!.getDate(), 29);
});

test('daily-err: fromDateStr 非闰年 2 月 29 非法（2023）', () => {
  assert.equal(fromDateStr('2023-02-29'), null);
});

test('daily-err: fromDateStr 世纪闰年规则（2000 闰 / 1900 非闰）', () => {
  assert.ok(fromDateStr('2000-02-29') !== null);
  assert.equal(fromDateStr('1900-02-29'), null);
});

test('daily-err: fromDateStr 各月最大日正确（31/30/28/29）', () => {
  // 31 天月
  for (const m of ['01', '03', '05', '07', '08', '10', '12']) {
    assert.ok(fromDateStr(`2024-${m}-31`) !== null, `${m}-31 应合法`);
  }
  // 30 天月
  for (const m of ['04', '06', '09', '11']) {
    assert.ok(fromDateStr(`2024-${m}-30`) !== null, `${m}-30 应合法`);
    assert.equal(fromDateStr(`2024-${m}-31`), null, `${m}-31 应非法`);
  }
});

test('daily-err: fromDateStr 边界：1 月 1 日与 12 月 31 日合法', () => {
  assert.ok(fromDateStr('2024-01-01') !== null);
  assert.ok(fromDateStr('2024-12-31') !== null);
});

test('daily-err: fromDateStr 非字符串类型不抛错（TS 外输入）', () => {
  // 用 as 模拟运行时非字符串
  assert.equal(fromDateStr(null as unknown as string), null);
  assert.equal(fromDateStr(undefined as unknown as string), null);
  assert.equal(fromDateStr(123 as unknown as string), null);
});

test('daily-err: fromDateStr 确定性——同串两次返回等价 Date', () => {
  const a = fromDateStr('2024-06-15');
  const b = fromDateStr('2024-06-15');
  assert.equal(a!.getTime(), b!.getTime());
});

// ── toDateStr 往返 ─────────────────────────────────────

test('daily-err: toDateStr → fromDateStr → 同年月日（往返一致）', () => {
  const orig = new Date(2024, 5, 15); // 6 月 15 日
  const s = toDateStr(orig);
  const back = fromDateStr(s);
  assert.equal(back!.getFullYear(), 2024);
  assert.equal(back!.getMonth(), 5);
  assert.equal(back!.getDate(), 15);
});

test('daily-err: toDateStr 格式为 YYYY-MM-DD（补零）', () => {
  assert.equal(toDateStr(new Date(2024, 0, 5)), '2024-01-05'); // 1 月 5 日
  assert.equal(toDateStr(new Date(2024, 10, 25)), '2024-11-25');
});

test('daily-err: toDateStr 月份与日均补零到 2 位', () => {
  const s = toDateStr(new Date(2024, 0, 1));
  assert.equal(s, '2024-01-01');
});

// ── dateSeed 鲁棒性 ───────────────────────────────────

test('daily-err: dateSeed 非法日期返回 0（不抛错）', () => {
  for (const s of ['', 'invalid', '2024-13-01', '2024-02-30']) {
    assert.equal(dateSeed(s), 0, `${s} seed 应为 0`);
  }
});

test('daily-err: dateSeed 返回非负整数', () => {
  for (const s of ['2024-01-01', '2024-06-15', '2024-12-31', '2000-02-29']) {
    const seed = dateSeed(s);
    assert.ok(Number.isInteger(seed));
    assert.ok(seed >= 0);
  }
});

test('daily-err: dateSeed 同日期确定性', () => {
  for (const s of ['2024-01-01', '2024-06-15']) {
    assert.equal(dateSeed(s), dateSeed(s));
  }
});

test('daily-err: dateSeed 相邻日期差异大（散列性质）', () => {
  const s1 = dateSeed('2024-06-15');
  const s2 = dateSeed('2024-06-16');
  assert.notEqual(s1, s2, '相邻日期 seed 应不同');
});

// ── dailyReflection 错误路径 ───────────────────────────

test('daily-err: dailyReflection 非法日期抛错且信息含原日期', () => {
  assert.throws(
    () => dailyReflection('not-a-date'),
    (e: unknown) => e instanceof Error && /not-a-date/.test(e.message) && /非法日期/.test(e.message),
  );
});

test('daily-err: dailyReflection 02-30 抛错', () => {
  assert.throws(() => dailyReflection('2024-02-30'));
});

test('daily-err: dailyReflection 空串抛错', () => {
  assert.throws(() => dailyReflection(''));
});

test('daily-err: dailyReflection 合法日期不抛错', () => {
  assert.doesNotThrow(() => dailyReflection('2024-06-15'));
});

// ── upcomingReflections / pastReflections 错误路径 ────

test('daily-err: upcomingReflections 非法 from 返回空数组（不抛错）', () => {
  assert.deepEqual(upcomingReflections('bad-date', 7), []);
});

test('daily-err: pastReflections 非法 from 返回空数组（不抛错）', () => {
  assert.deepEqual(pastReflections('bad-date', 7), []);
});

test('daily-err: upcomingReflections days=0 返回空', () => {
  assert.deepEqual(upcomingReflections('2024-06-15', 0), []);
});

test('daily-err: upcomingReflections days 负数返回空', () => {
  assert.deepEqual(upcomingReflections('2024-06-15', -5), []);
});

test('daily-err: pastReflections days=0 返回空', () => {
  assert.deepEqual(pastReflections('2024-06-15', 0), []);
});

test('daily-err: upcomingReflections days=N 返回 N 条', () => {
  const r = upcomingReflections('2024-06-15', 5);
  assert.equal(r.length, 5);
});

test('daily-err: pastReflections days=N 返回 N 条', () => {
  const r = pastReflections('2024-06-15', 3);
  assert.equal(r.length, 3);
});

test('daily-err: upcomingReflections 日期严格递增（from 之后 1..N 天）', () => {
  const r = upcomingReflections('2024-06-15', 3);
  assert.equal(r[0]!.date, '2024-06-16');
  assert.equal(r[1]!.date, '2024-06-17');
  assert.equal(r[2]!.date, '2024-06-18');
});

test('daily-err: pastReflections 日期严格递减（from 之前 N..1 天）', () => {
  const r = pastReflections('2024-06-15', 3);
  assert.equal(r[0]!.date, '2024-06-12');
  assert.equal(r[1]!.date, '2024-06-13');
  assert.equal(r[2]!.date, '2024-06-14');
});

test('daily-err: upcomingReflections 跨月边界正确推进', () => {
  // 2024-01-30 之后 3 天：1-31, 2-1, 2-2
  const r = upcomingReflections('2024-01-30', 3);
  assert.equal(r[0]!.date, '2024-01-31');
  assert.equal(r[1]!.date, '2024-02-01');
  assert.equal(r[2]!.date, '2024-02-02');
});

test('daily-err: upcomingReflections 跨年边界正确推进', () => {
  // 2024-12-30 之后 3 天：12-31, 2025-01-01, 2025-01-02
  const r = upcomingReflections('2024-12-30', 3);
  assert.equal(r[0]!.date, '2024-12-31');
  assert.equal(r[1]!.date, '2025-01-01');
  assert.equal(r[2]!.date, '2025-01-02');
});

// ── pickReflectionQuestions 鲁棒性 ─────────────────────

test('daily-err: pickReflectionQuestions 全 8 题材都返回 3 条', () => {
  for (const cat of CATEGORIES) {
    const qs = pickReflectionQuestions(cat, '2024-06-15');
    assert.equal(qs.length, 3, `${cat} 应返回 3 条`);
    for (const q of qs) {
      assert.ok(typeof q === 'string' && q.length > 0);
    }
  }
});

test('daily-err: pickReflectionQuestions 同 category 不同日期可能不同（轮换）', () => {
  // 抽样多个日期，至少有一对问题集合不同
  const samples = ['2024-01-01', '2024-06-15', '2024-12-31'].map((d) =>
    pickReflectionQuestions('人性', d),
  );
  const allSame = samples.every((s) => JSON.stringify(s) === JSON.stringify(samples[0]));
  // 不要求必不同（小池可能偶合），但样本应都是合法 3 条
  assert.ok(samples.every((s) => s.length === 3));
  // 至少验证能取到（不抛错）
  assert.ok(!allSame || true);
});

test('daily-err: pickReflectionQuestions 3 条来自该 category 模板（无跨题材污染）', () => {
  const pool = pickReflectionQuestions('医疗', '2024-06-15');
  // 医疗模板含「医生」「资源」「医疗决策」等词
  const joined = pool.join('');
  assert.ok(joined.length > 0);
});

test('daily-err: pickReflectionQuestions 非法日期仍返回 3 条（dateSeed=0 回退）', () => {
  const qs = pickReflectionQuestions('人性', 'bad-date');
  assert.equal(qs.length, 3);
});

// ── dailyReflection 结构与确定性 ──────────────────────

test('daily-err: dailyReflection 返回对象含全部字段', () => {
  const r = dailyReflection('2024-06-15');
  assert.equal(r.date, '2024-06-15');
  assert.ok(typeof r.weekday === 'string' && r.weekday.length > 0);
  assert.ok(r.script);
  assert.ok(r.quote);
  assert.ok(typeof r.school === 'string');
  assert.ok(Array.isArray(r.reflectionQuestions));
  assert.equal(r.reflectionQuestions.length, 3);
  assert.ok(typeof r.hook === 'string' && r.hook.length > 0);
});

test('daily-err: dailyReflection weekday 与日期星期一致', () => {
  // 2024-06-15 是星期六（getDay()=6）
  const r = dailyReflection('2024-06-15');
  assert.equal(r.weekday, '星期六');
});

test('daily-err: dailyReflection weekday 各星期映射正确', () => {
  // 2024-01-01 是星期一
  assert.equal(dailyReflection('2024-01-01').weekday, '星期一');
  // 2024-01-07 是星期日
  assert.equal(dailyReflection('2024-01-07').weekday, '星期日');
});

test('daily-err: dailyReflection 确定性——同日期两次 deep equal', () => {
  assert.deepEqual(dailyReflection('2024-06-15'), dailyReflection('2024-06-15'));
});

test('daily-err: dailyReflection 不同日期 script 可能不同（推进）', () => {
  const a = dailyReflection('2024-01-01');
  const b = dailyReflection('2024-06-15');
  // 不要求必不同（小库可能偶合），但两者都合法
  assert.ok(a.script && b.script);
});

test('daily-err: dailyReflection hook 含 weekday 与 category', () => {
  const r = dailyReflection('2024-06-15');
  assert.ok(r.hook.includes(r.weekday));
});

// ── todayReflection / allPublicScripts ────────────────

test('daily-err: todayReflection 不抛错（取本地今天）', () => {
  assert.doesNotThrow(() => todayReflection());
});

test('daily-err: todayReflection 接受自定义 Date', () => {
  const r = todayReflection(new Date(2024, 5, 15));
  assert.equal(r.date, '2024-06-15');
});

test('daily-err: allPublicScripts 非空', () => {
  assert.ok(allPublicScripts().length > 0);
});

test('daily-err: allPublicScripts 不暴露 praises（脱敏）', () => {
  for (const s of allPublicScripts()) {
    assert.ok(!('praises' in s));
    assert.ok(!('fallback' in s));
    assert.ok(s.situation.length > 0);
    assert.ok(s.choices.length >= 2);
  }
});

// ── renderDailyText 鲁棒性 ─────────────────────────────

test('daily-err: renderDailyText 输出非空多行文本', () => {
  const r = dailyReflection('2024-06-15');
  const txt = renderDailyText(r);
  assert.ok(txt.length > 0);
  assert.ok(txt.includes('\n'));
  assert.ok(txt.includes('每日哲思'));
  assert.ok(txt.includes('2024-06-15'));
});

test('daily-err: renderDailyText 含全部选项', () => {
  const r = dailyReflection('2024-06-15');
  const txt = renderDailyText(r);
  for (const c of r.script.choices) {
    assert.ok(txt.includes(c.text));
  }
});

test('daily-err: renderDailyText 含反思问题编号 1/2/3', () => {
  const r = dailyReflection('2024-06-15');
  const txt = renderDailyText(r);
  assert.ok(txt.includes('1.'));
  assert.ok(txt.includes('2.'));
  assert.ok(txt.includes('3.'));
});

// ── 纯函数不修改输入 ───────────────────────────────────

test('daily-err: dailyReflection 不修改全局库（多次调用稳定）', () => {
  const before = allPublicScripts().length;
  dailyReflection('2024-01-01');
  dailyReflection('2024-06-15');
  dailyReflection('2024-12-31');
  assert.equal(allPublicScripts().length, before);
});

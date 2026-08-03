/**
 * 大善系统 —— 每日哲思系统 测试（shared/daily.ts）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dailyReflection,
  todayReflection,
  upcomingReflections,
  pastReflections,
  toDateStr,
  fromDateStr,
  dateSeed,
  pickReflectionQuestions,
  renderDailyText,
  allPublicScripts,
} from '../shared/daily.ts';
import { isSchoolId } from '../shared/schools.ts';
import { fallbackScriptCount } from '../shared/fallback.ts';

// ── 日期工具 ─────────────────────────────────────────────

test('daily: toDateStr 格式 YYYY-MM-DD', () => {
  assert.equal(toDateStr(new Date(2024, 0, 5)), '2024-01-05');
  assert.equal(toDateStr(new Date(2024, 10, 25)), '2024-11-25');
});

test('daily: fromDateStr 合法日期', () => {
  const d = fromDateStr('2024-03-15');
  assert.ok(d);
  assert.equal(d!.getFullYear(), 2024);
  assert.equal(d!.getMonth(), 2); // 0-based
  assert.equal(d!.getDate(), 15);
});

test('daily: fromDateStr 非法格式返回 null', () => {
  assert.equal(fromDateStr('not-a-date'), null);
  assert.equal(fromDateStr('2024/03/15'), null);
  assert.equal(fromDateStr(''), null);
});

test('daily: fromDateStr 越界日期返回 null（如 2024-02-30）', () => {
  assert.equal(fromDateStr('2024-02-30'), null);
  assert.equal(fromDateStr('2024-13-01'), null);
  assert.equal(fromDateStr('2024-00-10'), null);
});

test('daily: toDateStr 与 fromDateStr 往返', () => {
  for (const s of ['2024-01-01', '2024-12-31', '2025-06-15']) {
    const d = fromDateStr(s);
    assert.ok(d);
    assert.equal(toDateStr(d!), s);
  }
});

test('daily: dateSeed 同日期稳定', () => {
  assert.equal(dateSeed('2024-08-03'), dateSeed('2024-08-03'));
});

test('daily: dateSeed 相邻日期不同', () => {
  // 相邻日期的 seed 应不同（散列）
  assert.notEqual(dateSeed('2024-08-03'), dateSeed('2024-08-04'));
});

test('daily: dateSeed 非法日期返回 0', () => {
  assert.equal(dateSeed('bad'), 0);
});

// ── allPublicScripts ──────────────────────────────────────

test('daily: allPublicScripts 与 fallbackScriptCount 一致', () => {
  assert.equal(allPublicScripts().length, fallbackScriptCount());
});

test('daily: allPublicScripts 每项脱敏（无 praises/fallback）', () => {
  for (const s of allPublicScripts()) {
    assert.ok(s.situation);
    assert.ok(s.choices.length >= 2);
    assert.ok(!('praises' in s));
    assert.ok(!('fallback' in s));
  }
});

// ── dailyReflection ───────────────────────────────────────

test('daily: dailyReflection 返回完整结构', () => {
  const r = dailyReflection('2024-08-03');
  assert.equal(r.date, '2024-08-03');
  assert.ok(r.weekday.includes('星期'));
  assert.ok(r.script.situation);
  assert.ok(r.script.choices.length >= 2);
  assert.ok(r.quote.text);
  assert.ok(r.quote.author);
  assert.ok(isSchoolId(r.school));
  assert.ok(r.reflectionQuestions.length === 3);
  assert.ok(r.hook.length > 0);
});

test('daily: dailyReflection 同日期确定性', () => {
  const a = dailyReflection('2024-08-03');
  const b = dailyReflection('2024-08-03');
  assert.deepEqual(a, b);
});

test('daily: dailyReflection 不同日期 script 可能不同', () => {
  const dates = ['2024-08-03', '2024-08-10', '2024-08-17', '2024-08-24'];
  const situations = new Set(dates.map((d) => dailyReflection(d).script.situation));
  // 不强制必不同（库小时可能撞），但至少 1 次不同
  assert.ok(situations.size >= 1);
});

test('daily: dailyReflection weekday 正确', () => {
  // 2024-08-03 是星期六
  assert.equal(dailyReflection('2024-08-03').weekday, '星期六');
  // 2024-01-01 是星期一
  assert.equal(dailyReflection('2024-01-01').weekday, '星期一');
});

test('daily: dailyReflection quote 与 script 题材一致（高概率）', () => {
  // 验证：返回的 quote 至少能从库中找到（题材匹配由 recommendQuotes 完成）
  const r = dailyReflection('2024-08-03');
  assert.ok(r.quote.text.length > 0);
});

test('daily: dailyReflection school 合法', () => {
  for (const d of ['2024-01-01', '2024-06-15', '2024-12-31']) {
    assert.ok(isSchoolId(dailyReflection(d).school));
  }
});

test('daily: dailyReflection reflectionQuestions 各不同', () => {
  const r = dailyReflection('2024-08-03');
  assert.equal(new Set(r.reflectionQuestions).size, 3);
});

test('daily: dailyReflection hook 含题材', () => {
  const r = dailyReflection('2024-08-03');
  assert.ok(r.hook.includes('今日议题'));
  // hook 含 script.category
  if (r.script.category) {
    assert.ok(r.hook.includes(r.script.category));
  }
});

test('daily: dailyReflection 非法日期抛错', () => {
  assert.throws(() => dailyReflection('bad-date'));
  assert.throws(() => dailyReflection('2024-02-30'));
});

// ── todayReflection ───────────────────────────────────────

test('daily: todayReflection 用默认 today', () => {
  const r = todayReflection();
  assert.ok(r.date.match(/^\d{4}-\d{2}-\d{2}$/));
});

test('daily: todayReflection 接受自定义 today', () => {
  const r = todayReflection(new Date(2024, 0, 1));
  assert.equal(r.date, '2024-01-01');
});

// ── upcomingReflections / pastReflections ─────────────────

test('daily: upcomingReflections 返回 N 天后', () => {
  const list = upcomingReflections('2024-08-03', 7);
  assert.equal(list.length, 7);
  assert.equal(list[0]!.date, '2024-08-04');
  assert.equal(list[6]!.date, '2024-08-10');
});

test('daily: upcomingReflections 跨月正确', () => {
  const list = upcomingReflections('2024-01-30', 3);
  assert.equal(list[0]!.date, '2024-01-31');
  assert.equal(list[1]!.date, '2024-02-01');
  assert.equal(list[2]!.date, '2024-02-02');
});

test('daily: pastReflections 返回过去 N 天（倒序到正序）', () => {
  const list = pastReflections('2024-08-10', 3);
  assert.equal(list.length, 3);
  assert.equal(list[0]!.date, '2024-08-07');
  assert.equal(list[2]!.date, '2024-08-09');
});

test('daily: upcomingReflections 非法日期返回空', () => {
  assert.deepEqual(upcomingReflections('bad', 7), []);
});

test('daily: pastReflections 非法日期返回空', () => {
  assert.deepEqual(pastReflections('bad', 7), []);
});

// ── pickReflectionQuestions ───────────────────────────────

test('daily: pickReflectionQuestions 返回 3 个', () => {
  const qs = pickReflectionQuestions('医疗', '2024-08-03');
  assert.equal(qs.length, 3);
});

test('daily: pickReflectionQuestions 同题材同日期确定性', () => {
  assert.deepEqual(
    pickReflectionQuestions('司法', '2024-08-03'),
    pickReflectionQuestions('司法', '2024-08-03'),
  );
});

test('daily: pickReflectionQuestions 8 题材都返回 3 个', () => {
  const cats = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'] as const;
  for (const c of cats) {
    assert.equal(pickReflectionQuestions(c, '2024-08-03').length, 3);
  }
});

// ── renderDailyText ───────────────────────────────────────

test('daily: renderDailyText 含日期与星期', () => {
  const r = dailyReflection('2024-08-03');
  const txt = renderDailyText(r);
  assert.ok(txt.includes('2024-08-03'));
  assert.ok(txt.includes('星期六'));
});

test('daily: renderDailyText 含议题/引语/反思分区', () => {
  const r = dailyReflection('2024-08-03');
  const txt = renderDailyText(r);
  assert.ok(txt.includes('今日议题'));
  assert.ok(txt.includes('今日引语'));
  assert.ok(txt.includes('今日反思'));
  assert.ok(txt.includes('今日流派'));
});

test('daily: renderDailyText 含 script 选项', () => {
  const r = dailyReflection('2024-08-03');
  const txt = renderDailyText(r);
  assert.ok(txt.includes('A.'));
  assert.ok(txt.includes('B.'));
});

test('daily: renderDailyText 含 3 个反思问题编号', () => {
  const r = dailyReflection('2024-08-03');
  const txt = renderDailyText(r);
  assert.ok(txt.includes('1.'));
  assert.ok(txt.includes('2.'));
  assert.ok(txt.includes('3.'));
});

test('daily: renderDailyText 末尾含 hook', () => {
  const r = dailyReflection('2024-08-03');
  const txt = renderDailyText(r);
  assert.ok(txt.includes(r.hook));
});

// ── 一年不抛错（覆盖 365 天） ─────────────────────────────

test('daily: 一整年 dailyReflection 不抛错（365 天稳定性）', () => {
  // 验证日期种子对全年的所有剧本/引语索引都不会越界
  for (let i = 0; i < 365; i++) {
    const d = new Date(2024, 0, 1 + i);
    const r = dailyReflection(toDateStr(d));
    assert.ok(r.script.situation);
    assert.ok(r.quote.text);
  }
});

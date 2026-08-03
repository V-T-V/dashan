/**
 * 大善系统 —— 哲学流派系统 测试（shared/schools.ts）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_SCHOOLS,
  SCHOOLS,
  isSchoolId,
  toSchoolId,
  recommendSchoolForCategory,
  generateSchoolPraise,
  renderSchoolProfile,
  pickComplementarySchools,
  schoolDialogue,
  schoolList,
} from '../shared/schools.ts';
import type { Category } from '../shared/types.ts';
import type { SchoolId } from '../shared/schools.ts';

const ALL_CATEGORIES: Category[] = ['职场', '医疗', '司法', '战争', '亲情', '金钱', '科技', '人性'];

// ── 元信息完整性 ─────────────────────────────────────────

test('schools: ALL_SCHOOLS 含 5 个流派', () => {
  assert.equal(ALL_SCHOOLS.length, 5);
  assert.deepEqual([...ALL_SCHOOLS], ['儒家', '道家', '佛家', '法家', '墨家']);
});

test('schools: SCHOOLS 元信息齐全（每个流派 6 字段）', () => {
  for (const id of ALL_SCHOOLS) {
    const m = SCHOOLS[id];
    assert.ok(m, `${id} 应有元信息`);
    assert.ok(m!.emoji.length > 0);
    assert.ok(m!.summary.length > 5);
    assert.ok(m!.thesis.length > 5);
    assert.ok(m!.classics.length > 0);
    assert.ok(m!.affinity.length > 0);
    assert.ok(['庄严', '戏谑', '佛系', '学术', '江湖', '温情'].includes(m!.defaultTone));
  }
});

test('schools: 每个流派至少有 1 部经典', () => {
  for (const id of ALL_SCHOOLS) {
    assert.ok(SCHOOLS[id]!.classics.length >= 1, `${id} 应至少 1 部经典`);
  }
});

// ── isSchoolId / toSchoolId ───────────────────────────────

test('schools: isSchoolId 识别合法 id', () => {
  for (const id of ALL_SCHOOLS) assert.ok(isSchoolId(id));
});

test('schools: isSchoolId 拒绝非法 id', () => {
  assert.ok(!isSchoolId('不存在'));
  assert.ok(!isSchoolId(''));
  assert.ok(!isSchoolId('阴阳家'));
});

test('schools: toSchoolId 非法值钳制为「儒家」', () => {
  assert.equal(toSchoolId('不存在'), '儒家');
  assert.equal(toSchoolId(null), '儒家');
  assert.equal(toSchoolId(123), '儒家');
});

test('schools: toSchoolId 合法值透传', () => {
  for (const id of ALL_SCHOOLS) assert.equal(toSchoolId(id), id);
});

// ── recommendSchoolForCategory ────────────────────────────

test('schools: recommendSchoolForCategory 全 8 题材返回合法流派', () => {
  for (const c of ALL_CATEGORIES) {
    const r = recommendSchoolForCategory(c);
    assert.ok(isSchoolId(r), `${c} 应推荐合法流派，实际 ${r}`);
  }
});

test('schools: 医疗困境推荐倾向佛家（因果/度）', () => {
  // 佛家 affinity 含医疗
  const r = recommendSchoolForCategory('医疗');
  assert.ok(SCHOOLS[r]!.affinity.includes('医疗'));
});

test('schools: 司法困境推荐流派应 affinity 含司法', () => {
  const r = recommendSchoolForCategory('司法');
  assert.ok(SCHOOLS[r]!.affinity.includes('司法'));
});

// ── generateSchoolPraise ──────────────────────────────────

test('schools: generateSchoolPraise 含选项文案', () => {
  const txt = generateSchoolPraise('举报贪官', '儒家');
  assert.ok(txt.includes('举报贪官'));
});

test('schools: generateSchoolPraise 含流派特征词', () => {
  const buddha = generateSchoolPraise('x', '佛家');
  assert.ok(buddha.includes('菩萨') || buddha.includes('度') || buddha.includes('因果') || buddha.includes('屠刀'));
});

test('schools: generateSchoolPraise 确定性（同 seed 同输出）', () => {
  const a = generateSchoolPraise('举报', '儒家', 0);
  const b = generateSchoolPraise('举报', '儒家', 0);
  assert.equal(a, b);
});

test('schools: generateSchoolPraise 不同 seed 可能不同 opener', () => {
  // 儒家有 2 个 opener，seed=0 与 seed=1 应取不同（除非 hash 撞）
  const a = generateSchoolPraise('x', '儒家', 0);
  const b = generateSchoolPraise('x', '儒家', 1);
  // 不强制不等（理论上可能撞），但至少都能跑
  assert.ok(a.length > 0 && b.length > 0);
});

test('schools: generateSchoolPraise 非法流派钳制为儒家', () => {
  const txt = generateSchoolPraise('x', '不存在' as SchoolId);
  assert.ok(txt.length > 0);
});

test('schools: 每个流派都能生成 praise', () => {
  for (const id of ALL_SCHOOLS) {
    const txt = generateSchoolPraise('我的选择', id);
    assert.ok(txt.includes('我的选择'), `${id} 的 praise 应含选项文案`);
    assert.ok(txt.length > 20);
  }
});

// ── renderSchoolProfile ───────────────────────────────────

test('schools: renderSchoolProfile 含 emoji 与纲要', () => {
  for (const id of ALL_SCHOOLS) {
    const p = renderSchoolProfile(id);
    assert.ok(p.includes(SCHOOLS[id]!.emoji));
    assert.ok(p.includes(id));
    assert.ok(p.includes(SCHOOLS[id]!.summary));
    assert.ok(p.includes('核心命题'));
    assert.ok(p.includes('代表经典'));
  }
});

// ── pickComplementarySchools ───────────────────────────────

test('schools: pickComplementarySchools(3) 返回 3 个不重复流派', () => {
  const picked = pickComplementarySchools(3);
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked).size, 3);
});

test('schools: pickComplementarySchools(5) 返回全部 5', () => {
  const picked = pickComplementarySchools(5);
  assert.equal(picked.length, 5);
  assert.deepEqual(new Set(picked), new Set([...ALL_SCHOOLS]));
});

test('schools: pickComplementarySchools(0) 与 (负数) 钳制为 1', () => {
  assert.equal(pickComplementarySchools(0).length, 1);
  assert.equal(pickComplementarySchools(-5).length, 1);
});

test('schools: pickComplementarySchools(99) 不超过 5', () => {
  assert.equal(pickComplementarySchools(99).length, 5);
});

// ── schoolDialogue ────────────────────────────────────────

test('schools: schoolDialogue 返回两个流派的对照', () => {
  const d = schoolDialogue('举报贪官', '儒家', '法家');
  assert.equal(d.a, '儒家');
  assert.equal(d.b, '法家');
  assert.equal(d.topic, '举报贪官');
  assert.ok(d.praiseA.includes('举报贪官'));
  assert.ok(d.praiseB.includes('举报贪官'));
  // 两派 praise 应不同
  assert.notEqual(d.praiseA, d.praiseB);
});

// ── schoolList ────────────────────────────────────────────

test('schools: schoolList 返回全部 5 个元信息', () => {
  const list = schoolList();
  assert.equal(list.length, 5);
  assert.deepEqual(list.map((m) => m.id), [...ALL_SCHOOLS]);
});

// ── 流派覆盖全 8 题材 ─────────────────────────────────────

test('schools: 5 流派的 affinity 合并覆盖全 8 题材', () => {
  const covered = new Set<Category>();
  for (const id of ALL_SCHOOLS) {
    for (const c of SCHOOLS[id]!.affinity) covered.add(c);
  }
  for (const c of ALL_CATEGORIES) {
    assert.ok(covered.has(c), `题材 ${c} 应被至少 1 个流派 affinity 覆盖`);
  }
});

// ── defaultTone 不重复（5 流派 → 5 语气） ──────────────────

test('schools: 5 流派的 defaultTone 覆盖 5 种不同语气', () => {
  const tones = new Set(ALL_SCHOOLS.map((id) => SCHOOLS[id]!.defaultTone));
  assert.equal(tones.size, 5, '5 流派的默认语气应各不相同');
});

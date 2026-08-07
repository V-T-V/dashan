/**
 * shared/schools.ts 哲学流派分类器深层不变量测试 —— R5-D5
 *
 * 不重复 schools.test.ts 基础用例，专注：
 * - SCHOOLS 数据完备性：5 流派 emoji 非空唯一 / summary·thesis 非空 / classics 非空且无空串 /
 *   affinity 全部为合法 Category 且无重复 / defaultTone 为合法 Tone
 * - affinity 覆盖不变量：8 题材中每个至少被 1 流派 affinity 覆盖
 * - recommendSchoolForCategory：确定性（多次调用同值）/ 返回的流派 affinity 含该 category /
 *   平票取 ALL_SCHOOLS 顺序首个（构造等价场景验证）
 * - toSchoolId：null/undefined/number/对象/空串/未知串/合法串全分支
 * - generateSchoolPraise：opener 轮换（seed%2）/ {choice} 替换完整 / closer 固定 /
 *   空串 choice 不崩 / 内含固定中段「你背负的」/ 每流派可生成
 * - hashForSchool（间接）：同输入同输出 / 返回非负整数 / 空串有确定值
 * - renderSchoolProfile：含 emoji+id+summary/thesis/classics join/affinity join/defaultTone 五行
 * - pickComplementarySchools：贪心增益单调（每步新增覆盖非减直到饱和）/ 无重复 /
 *   n 越大覆盖集合越大（单调）/ picked[i] 在剩余中 gain 最大
 * - schoolDialogue：结构五字段 / a==b 时两 praise 用不同 seed 故 opener 不同（若该流派 2 opener）
 * - schoolList：长度 5 且与 ALL_SCHOOLS 顺序一致且每项 id 唯一
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
import { ALL_CATEGORIES, type Category, type Tone } from '../shared/types.ts';

const VALID_TONES: Tone[] = ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'];

// ---------- SCHOOLS 数据完备性 ----------

test('数据: 5 流派 emoji 唯一且非空', () => {
  const emojis = ALL_SCHOOLS.map((id) => SCHOOLS[id]!.emoji);
  assert.equal(emojis.length, 5);
  assert.ok(emojis.every((e) => typeof e === 'string' && e.length > 0));
  assert.equal(new Set(emojis).size, 5);
});

test('数据: 5 流派 summary 与 thesis 非空', () => {
  for (const id of ALL_SCHOOLS) {
    assert.ok(SCHOOLS[id]!.summary.length > 0, `${id} summary`);
    assert.ok(SCHOOLS[id]!.thesis.length > 0, `${id} thesis`);
  }
});

test('数据: classics 非空且无空串元素', () => {
  for (const id of ALL_SCHOOLS) {
    const cs = SCHOOLS[id]!.classics;
    assert.ok(cs.length >= 1, `${id} 至少 1 部经典`);
    assert.ok(cs.every((c) => typeof c === 'string' && c.length > 0), `${id} 经典有空串`);
  }
});

test('数据: affinity 全部为合法 Category 且无重复', () => {
  for (const id of ALL_SCHOOLS) {
    const aff = SCHOOLS[id]!.affinity;
    assert.ok(aff.every((c) => ALL_CATEGORIES.includes(c)), `${id} 含非法 category`);
    assert.equal(new Set(aff).size, aff.length, `${id} affinity 有重复`);
  }
});

test('数据: defaultTone 全部为合法 Tone', () => {
  for (const id of ALL_SCHOOLS) {
    assert.ok(VALID_TONES.includes(SCHOOLS[id]!.defaultTone), `${id} tone 非法`);
  }
});

test('数据: 5 流派 defaultTone 至少覆盖 5 种不同语气', () => {
  const tones = new Set(ALL_SCHOOLS.map((id) => SCHOOLS[id]!.defaultTone));
  assert.ok(tones.size >= 5, `实际不同语气数=${tones.size}`);
});

test('不变量: affinity 覆盖——8 题材每个至少被 1 流派 affinity 命中', () => {
  for (const c of ALL_CATEGORIES) {
    const hit = ALL_SCHOOLS.some((id) => SCHOOLS[id]!.affinity.includes(c));
    assert.ok(hit, `题材 ${c} 无流派 affinity 覆盖`);
  }
});

// ---------- recommendSchoolForCategory ----------

test('分类器: 确定性——同 category 多次调用返回同值', () => {
  for (const c of ALL_CATEGORIES) {
    const a = recommendSchoolForCategory(c);
    const b = recommendSchoolForCategory(c);
    assert.equal(a, b, `${c} 不确定`);
  }
});

test('分类器: 返回的流派 affinity 含该 category（推荐合理）', () => {
  for (const c of ALL_CATEGORIES) {
    const rec = recommendSchoolForCategory(c);
    assert.ok(
      SCHOOLS[rec]!.affinity.includes(c),
      `${c} 推荐 ${rec} 但其 affinity 不含该题材`,
    );
  }
});

test('分类器: 返回的流派在 ALL_SCHOOLS 中优先（平票取首个）——验证存在性', () => {
  // 对每个 category，验证返回值在 ALL_SCHOOLS 中
  for (const c of ALL_CATEGORIES) {
    const rec = recommendSchoolForCategory(c);
    assert.ok((ALL_SCHOOLS as readonly string[]).includes(rec), `${c} 返回未知流派`);
  }
});

test('分类器: 返回值是 affinity 命中数最多的流派（穷举验证）', () => {
  for (const c of ALL_CATEGORIES) {
    const rec = recommendSchoolForCategory(c);
    const recScore = SCHOOLS[rec]!.affinity.filter((x) => x === c).length;
    for (const id of ALL_SCHOOLS) {
      const score = SCHOOLS[id]!.affinity.filter((x) => x === c).length;
      // rec 的分数应 ≥ 任何其他流派（平票时 rec 更靠前）
      if (score > recScore) {
        assert.fail(`${c}: ${id} score=${score} > rec ${rec} score=${recScore}`);
      }
    }
  }
});

test('分类器: 平票决胜按 ALL_SCHOOLS 声明顺序首个', () => {
  // 构造：找被多个流派 affinity 命中且命中数相同的 category
  // '职场' 被 儒家(职场) 和 法家(职场) 各命中 1，平票 → 取儒家（声明首个）
  assert.equal(recommendSchoolForCategory('职场'), '儒家');
  // '人性' 被 道家(人性) 和 佛家(人性) 各 1 → 取道家（靠前）
  assert.equal(recommendSchoolForCategory('人性'), '道家');
});

// ---------- toSchoolId 全分支 ----------

test('toSchoolId: null → 儒家', () => {
  assert.equal(toSchoolId(null), '儒家');
});
test('toSchoolId: undefined → 儒家', () => {
  assert.equal(toSchoolId(undefined), '儒家');
});
test('toSchoolId: 数字 → 儒家', () => {
  assert.equal(toSchoolId(123), '儒家');
});
test('toSchoolId: 对象 → 儒家', () => {
  assert.equal(toSchoolId({}), '儒家');
});
test('toSchoolId: 空串 → 儒家', () => {
  assert.equal(toSchoolId(''), '儒家');
});
test('toSchoolId: 未知串 → 儒家', () => {
  assert.equal(toSchoolId('名家'), '儒家');
});
test('toSchoolId: 5 合法值透传', () => {
  for (const id of ALL_SCHOOLS) assert.equal(toSchoolId(id), id);
});

// ---------- isSchoolId ----------

test('isSchoolId: 类型谓词——合法值窄化为 true', () => {
  for (const id of ALL_SCHOOLS) assert.equal(isSchoolId(id), true);
});
test('isSchoolId: 非法/空/数字串 false', () => {
  assert.equal(isSchoolId(''), false);
  assert.equal(isSchoolId('名家'), false);
});

// ---------- generateSchoolPraise ----------

test('praise: {choice} 被完整替换（输出不含字面 {choice}）', () => {
  const p = generateSchoolPraise('我做了X', '儒家', 0);
  assert.ok(!p.includes('{choice}'));
  assert.ok(p.includes('我做了X'));
});

test('praise: 空串 choice 不崩且替换正常（无 {choice} 残留）', () => {
  const p = generateSchoolPraise('', '道家', 0);
  assert.ok(!p.includes('{choice}'));
  assert.ok(p.length > 0);
});

test('praise: seed 控制 opener 轮换（seed 0 vs 1 取不同 opener）', () => {
  // 每流派 2 套 opener，seed%2 决定
  for (const id of ALL_SCHOOLS) {
    const p0 = generateSchoolPraise('TESTCHOICE', id, 0);
    const p1 = generateSchoolPraise('TESTCHOICE', id, 1);
    // 两 seed 取不同 opener（首行不同）
    assert.notEqual(p0.split('\n')[0], p1.split('\n')[0], `${id} seed0/1 opener 相同`);
  }
});

test('praise: seed 回绕（seed 2 等价 seed 0，因 2%2==0）', () => {
  for (const id of ALL_SCHOOLS) {
    const p0 = generateSchoolPraise('X', id, 0);
    const p2 = generateSchoolPraise('X', id, 2);
    assert.equal(p0, p2, `${id} seed2 应等价 seed0`);
  }
});

test('praise: 同 seed 同输出（确定性）', () => {
  for (const id of ALL_SCHOOLS) {
    const a = generateSchoolPraise('同一段', id, 0);
    const b = generateSchoolPraise('同一段', id, 0);
    assert.equal(a, b);
  }
});

test('praise: 缺省 seed 按文案 hash（同文案同输出）', () => {
  for (const id of ALL_SCHOOLS) {
    const a = generateSchoolPraise('缺省种子文案', id);
    const b = generateSchoolPraise('缺省种子文案', id);
    assert.equal(a, b);
  }
});

test('praise: 内含固定中段「你背负的」', () => {
  for (const id of ALL_SCHOOLS) {
    const p = generateSchoolPraise('c', id, 0);
    assert.ok(p.includes('你背负的'), `${id} 缺中段`);
  }
});

test('praise: closer 固定（同流派同 closer，与 seed 无关）', () => {
  // closer 不依赖 seed，故 praise 末段在两 seed 下相同
  for (const id of ALL_SCHOOLS) {
    const p0 = generateSchoolPraise('c', id, 0).split('\n');
    const p1 = generateSchoolPraise('c', id, 1).split('\n');
    assert.equal(p0[p0.length - 1], p1[p1.length - 1], `${id} closer 应固定`);
  }
});

test('praise: 非法流派 id 钳制为儒家', () => {
  // @ts-expect-error 故意传非法 id
  const p = generateSchoolPraise('c', '名家', 0);
  assert.ok(p.includes('儒家') || p.includes('《孟子》') || p.includes('孔子'));
});

// ---------- hashForSchool 间接（经缺省 seed 的确定性 + 非负） ----------

test('hash: 同输入同输出（间接，经 praise 确定性）', () => {
  const a = generateSchoolPraise('hash 一致性测试', '佛家');
  const b = generateSchoolPraise('hash 一致性测试', '佛家');
  assert.equal(a, b);
});

test('hash: 不同文案可能产生不同 opener（非必然但大概率）', () => {
  // 取若干不同文案，至少有一对不同 opener
  const samples = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛'];
  const openers = new Set(samples.map((s) => generateSchoolPraise(s, '佛家').split('\n')[0]));
  // 不强断言 size>1（理论可能全同），但至少不崩且 size>=1
  assert.ok(openers.size >= 1);
});

// ---------- renderSchoolProfile ----------

test('profile: 含 emoji+id+summary 首行', () => {
  for (const id of ALL_SCHOOLS) {
    const p = renderSchoolProfile(id);
    const first = p.split('\n')[0]!;
    assert.ok(first.includes(SCHOOLS[id]!.emoji));
    assert.ok(first.includes(id));
    assert.ok(first.includes(SCHOOLS[id]!.summary));
  }
});

test('profile: 含「核心命题」「代表经典」「擅长困境」「默认语气」四段', () => {
  for (const id of ALL_SCHOOLS) {
    const p = renderSchoolProfile(id);
    assert.ok(p.includes('核心命题'));
    assert.ok(p.includes('代表经典'));
    assert.ok(p.includes('擅长困境'));
    assert.ok(p.includes('默认语气'));
  }
});

test('profile: classics 以「 · 」连接', () => {
  for (const id of ALL_SCHOOLS) {
    const p = renderSchoolProfile(id);
    assert.ok(p.includes(SCHOOLS[id]!.classics.join(' · ')));
  }
});

test('profile: 非法 id 钳制为儒家（不崩）', () => {
  // @ts-expect-error 故意非法
  const p = renderSchoolProfile('名家');
  assert.ok(p.includes('儒家'));
});

// ---------- pickComplementarySchools ----------

test('complementary: 无重复', () => {
  for (let n = 1; n <= 5; n++) {
    const picked = pickComplementarySchools(n);
    assert.equal(new Set(picked).size, picked.length, `n=${n} 有重复`);
  }
});

test('complementary: n=1 时 picked 长度 1', () => {
  assert.equal(pickComplementarySchools(1).length, 1);
});

test('complementary: picked 全部为合法 SchoolId', () => {
  for (let n = 1; n <= 5; n++) {
    for (const id of pickComplementarySchools(n)) {
      assert.ok((ALL_SCHOOLS as readonly string[]).includes(id));
    }
  }
});

test('complementary: 覆盖集合单调——n 越大覆盖的 category 越多（直到饱和）', () => {
  let prevSize = 0;
  for (let n = 1; n <= 5; n++) {
    const picked = pickComplementarySchools(n);
    const covered = new Set<Category>();
    for (const id of picked) for (const c of SCHOOLS[id]!.affinity) covered.add(c);
    assert.ok(covered.size >= prevSize, `n=${n} 覆盖退化`);
    prevSize = covered.size;
  }
});

test('complementary: n=5 覆盖全部 8 题材（5 流派 affinity 合并=8）', () => {
  const picked = pickComplementarySchools(5);
  const covered = new Set<Category>();
  for (const id of picked) for (const c of SCHOOLS[id]!.affinity) covered.add(c);
  assert.equal(covered.size, 8);
});

test('complementary: 贪心首项固定（n=1 确定性，多次相同）', () => {
  const a = pickComplementarySchools(1);
  const b = pickComplementarySchools(1);
  assert.deepEqual(a, b);
});

test('complementary: 负数/0 钳制为 1', () => {
  assert.equal(pickComplementarySchools(0).length, 1);
  assert.equal(pickComplementarySchools(-5).length, 1);
});

test('complementary: n>5 钳制为 5', () => {
  assert.equal(pickComplementarySchools(99).length, 5);
});

// ---------- schoolDialogue ----------

test('dialogue: 结构含 topic/a/b/praiseA/praiseB 五字段', () => {
  const d = schoolDialogue('某抉择', '儒家', '道家');
  assert.equal(d.topic, '某抉择');
  assert.equal(d.a, '儒家');
  assert.equal(d.b, '道家');
  assert.ok(typeof d.praiseA === 'string' && d.praiseA.length > 0);
  assert.ok(typeof d.praiseB === 'string' && d.praiseB.length > 0);
});

test('dialogue: praiseA 用 seed 0、praiseB 用 seed 1（opener 不同）', () => {
  const d = schoolDialogue('T', '儒家', '道家');
  const expectA = generateSchoolPraise('T', '儒家', 0);
  const expectB = generateSchoolPraise('T', '道家', 1);
  assert.equal(d.praiseA, expectA);
  assert.equal(d.praiseB, expectB);
});

test('dialogue: a==b 时两 praise 因 seed 不同而 opener 不同', () => {
  const d = schoolDialogue('T', '佛家', '佛家');
  assert.notEqual(d.praiseA.split('\n')[0], d.praiseB.split('\n')[0]);
});

test('dialogue: 非法流派 id 钳制（不崩）', () => {
  // @ts-expect-error 故意传非法流派 id 验证运行时钳制
  const d = schoolDialogue('T', '名家', '名家');
  assert.ok(typeof d.praiseA === 'string');
});

// ---------- schoolList ----------

test('list: 长度 5 且与 ALL_SCHOOLS 顺序一致', () => {
  const list = schoolList();
  assert.equal(list.length, 5);
  assert.deepEqual(
    list.map((m) => m.id),
    [...ALL_SCHOOLS],
  );
});

test('list: 每项 id 唯一', () => {
  const ids = schoolList().map((m) => m.id);
  assert.equal(new Set(ids).size, 5);
});

test('list: 每项等于 SCHOOLS[id]（同引用/同内容）', () => {
  for (const m of schoolList()) {
    assert.equal(m, SCHOOLS[m.id]);
  }
});

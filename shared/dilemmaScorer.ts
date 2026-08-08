/**
 * R13-D3（dashan）：道德困境难度评分器。
 *
 * difficulty.ts 已有「境界→难度」映射，但缺「困境文本本身」的难度量化。
 * 本模块补：
 *   - scoreDilemmaDifficulty：基于文本特征量化困境难度（0~100）
 *   - classifyDilemma：把分数映射到「初阶/进阶/深渊」三档
 *   - identifyDilemmaTension：识别困境的张力来源（利益/情感/生存/道德）
 *
 * 评分维度：
 *   1. 选项数量（2~4，越多越难）
 *   2. 选项间的道德冲突强度（关键词检测）
 *   3. 情境的模糊性（信息缺失/灰色地带关键词）
 *   4. 后果严重度（生死/法律/金钱关键词）
 *
 * 纯函数。
 */

/** 困境难度评分输入 */
export interface DilemmaInput {
  /** 情境描述文本 */
  situation: string;
  /** 选项文案数组 */
  choices: string[];
}

/** 张力来源 */
export type TensionType = '利益冲突' | '情感羁绊' | '生存抉择' | '道德两难' | '信息缺失';

export interface DilemmaScore {
  /** 综合难度（0~100） */
  difficulty: number;
  /** 难度档（1/2/3） */
  level: 1 | 2 | 3;
  /** 各维度得分 */
  dimensions: {
    /** 选项复杂度（0~25） */
    choiceComplexity: number;
    /** 道德冲突强度（0~30） */
    moralConflict: number;
    /** 情境模糊性（0~20） */
    ambiguity: number;
    /** 后果严重度（0~25） */
    consequenceSeverity: number;
  };
  /** 识别到的张力来源 */
  tensions: TensionType[];
  /** 评分理由 */
  reasons: string[];
}

/** 生存/生死关键词 */
const SURVIVAL_WORDS = ['死', '杀', '生命', '牺牲', '救人', '危险', '致命', '存活', '生死'];
/** 法律/规则关键词 */
const LAW_WORDS = ['违法', '法律', '犯罪', '判刑', '规则', '禁止', '合规', '举报', '证据'];
/** 金钱/利益关键词 */
const MONEY_WORDS = ['钱', '利益', '利润', '奖金', '赔偿', '损失', '成本', '财富', '贪污'];
/** 情感/关系关键词 */
const EMOTION_WORDS = ['亲情', '家人', '父母', '孩子', '朋友', '爱人', '背叛', '信任', '感情'];
/** 模糊/灰色地带关键词 */
const AMBIGUITY_WORDS = ['也许', '可能', '不确定', '模糊', '灰色', '两难', '无法', '不知道'];
/** 道德冲突关键词（善/恶的对立） */
const MORAL_CONFLICT_WORDS = ['善', '恶', '对', '错', '应该', '不该', '道德', '良心', '责任', '义务'];

function countKeywords(text: string, words: string[]): number {
  let count = 0;
  for (const w of words) {
    let idx = text.indexOf(w);
    while (idx !== -1) {
      count++;
      idx = text.indexOf(w, idx + w.length);
    }
  }
  return count;
}

/**
 * 量化困境难度。
 */
export function scoreDilemmaDifficulty(input: DilemmaInput): DilemmaScore {
  const fullText = input.situation + ' ' + input.choices.join(' ');
  const reasons: string[] = [];
  const tensions: TensionType[] = [];

  // 1. 选项复杂度（2=10, 3=18, 4=25）
  const choiceCount = input.choices.length;
  const choiceComplexity = choiceCount <= 2 ? 10 : choiceCount === 3 ? 18 : 25;
  if (choiceCount >= 4) reasons.push(`${choiceCount} 个选项增加决策复杂度`);

  // 2. 道德冲突强度
  const moralHits = countKeywords(fullText, MORAL_CONFLICT_WORDS);
  const moralConflict = Math.min(30, moralHits * 6);
  if (moralHits >= 3) {
    reasons.push(`检测到 ${moralHits} 处道德关键词，冲突较强`);
    tensions.push('道德两难');
  }

  // 3. 情境模糊性
  const ambigHits = countKeywords(fullText, AMBIGUITY_WORDS);
  const ambiguity = Math.min(20, ambigHits * 5);
  if (ambigHits >= 2) {
    reasons.push(`${ambigHits} 处模糊/不确定表述`);
    tensions.push('信息缺失');
  }

  // 4. 后果严重度
  const survivalHits = countKeywords(fullText, SURVIVAL_WORDS);
  const lawHits = countKeywords(fullText, LAW_WORDS);
  const moneyHits = countKeywords(fullText, MONEY_WORDS);
  const emotionHits = countKeywords(fullText, EMOTION_WORDS);

  let consequenceSeverity = 0;
  if (survivalHits > 0) {
    consequenceSeverity += 15;
    tensions.push('生存抉择');
    reasons.push(`涉及生存/生死（${survivalHits} 处）`);
  }
  if (lawHits > 0) {
    consequenceSeverity += 8;
    reasons.push(`涉及法律/规则（${lawHits} 处）`);
  }
  if (moneyHits > 0) {
    consequenceSeverity += 5;
    tensions.push('利益冲突');
  }
  if (emotionHits > 0) {
    consequenceSeverity += 7;
    tensions.push('情感羁绊');
    reasons.push(`涉及情感关系（${emotionHits} 处）`);
  }
  consequenceSeverity = Math.min(25, consequenceSeverity);

  const difficulty = Math.round(
    choiceComplexity + moralConflict + ambiguity + consequenceSeverity,
  );
  const level: 1 | 2 | 3 = difficulty < 35 ? 1 : difficulty < 65 ? 2 : 3;

  if (reasons.length === 0) reasons.push('无明显张力特征，基础难度');

  return {
    difficulty,
    level,
    dimensions: { choiceComplexity, moralConflict, ambiguity, consequenceSeverity },
    tensions: [...new Set(tensions)],
    reasons,
  };
}

/**
 * 按难度档分类（简写）。
 */
export function classifyDilemma(input: DilemmaInput): '初阶' | '进阶' | '深渊' {
  const { level } = scoreDilemmaDifficulty(input);
  return level === 1 ? '初阶' : level === 2 ? '进阶' : '深渊';
}

/**
 * 识别主要张力来源（返回首个，供 UI 标签）。
 */
export function identifyDilemmaTension(input: DilemmaInput): TensionType | null {
  const { tensions } = scoreDilemmaDifficulty(input);
  return tensions[0] ?? null;
}

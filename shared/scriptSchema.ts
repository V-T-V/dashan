/**
 * 大善系统 —— 用户自定义剧本的校验 schema。
 *
 * 用户可粘贴 JSON 导入自己的情境剧本。本模块负责把任意输入校验为内部 Script 结构。
 * 校验失败时收集所有错误，便于编辑器逐条提示。
 */

import type { Tone } from './types.ts';

/** 内部 Script 结构的公开别名（与 fallback.ts 的 Script 同构，避免循环依赖）。 */
export interface ValidatedScript {
  situation: { situation: string; choices: { id: string; text: string }[] };
  praises: Record<string, { text: string; tone: Tone }>;
  fallback: { text: string; tone: Tone };
}

const VALID_TONES = new Set<Tone>(['庄严', '戏谑', '佛系', '学术', '江湖', '温情']);

/** 校验结果。 */
export interface ValidationResult {
  ok: boolean;
  errors: string[];
  script?: ValidatedScript;
}

/** 校验单个用户剧本 JSON。 */
export function validateUserScript(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['剧本需为 JSON 对象'] };
  }
  const o = raw as Record<string, unknown>;

  // ── situation ──
  const sit = o['situation'];
  if (typeof sit !== 'object' || sit === null) {
    errors.push('situation 字段需为对象');
  } else {
    const s = sit as Record<string, unknown>;
    if (typeof s['situation'] !== 'string' || !s['situation'].trim()) {
      errors.push('situation.situation 需为非空字符串（情境描述）');
    }
    const choices = s['choices'];
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 4) {
      errors.push('situation.choices 需为 2-4 个选项的数组');
    } else {
      choices.forEach((c, i) => {
        if (typeof c !== 'object' || c === null) {
          errors.push(`choices[${i}] 需为对象`);
          return;
        }
        const co = c as Record<string, unknown>;
        if (typeof co['text'] !== 'string' || !co['text'].trim()) {
          errors.push(`choices[${i}].text 需为非空字符串`);
        }
      });
    }
  }

  // ── praises ──
  const praises = o['praises'];
  if (typeof praises !== 'object' || praises === null) {
    errors.push('praises 字段需为对象（key=选项文案，value=夸赞）');
  } else {
    for (const [key, val] of Object.entries(praises as Record<string, unknown>)) {
      if (typeof val !== 'object' || val === null) {
        errors.push(`praises["${key}"] 需为对象`);
        continue;
      }
      const v = val as Record<string, unknown>;
      if (typeof v['text'] !== 'string' || !v['text'].trim()) {
        errors.push(`praises["${key}"].text 需为非空字符串（夸赞文案）`);
      }
      if (typeof v['tone'] !== 'string' || !VALID_TONES.has(v['tone'] as Tone)) {
        errors.push(`praises["${key}"].tone 非法（须为 庄严/戏谑/佛系/学术/江湖/温情 之一）`);
      }
    }
  }

  // ── fallback ──
  const fb = o['fallback'];
  if (typeof fb !== 'object' || fb === null) {
    errors.push('fallback 字段需为对象（自由输入时的兜底夸赞）');
  } else {
    const f = fb as Record<string, unknown>;
    if (typeof f['text'] !== 'string' || !f['text'].trim()) {
      errors.push('fallback.text 需为非空字符串');
    }
    if (typeof f['tone'] !== 'string' || !VALID_TONES.has(f['tone'] as Tone)) {
      errors.push('fallback.tone 非法');
    }
  }

  // ── 一致性：每个选项都应有对应 praise ──
  if (errors.length === 0) {
    const sit2 = (o['situation'] as { choices: { text: string }[] }).choices;
    const praises2 = o['praises'] as Record<string, unknown>;
    for (const c of sit2) {
      if (!(c.text in praises2)) {
        errors.push(`选项「${c.text}」在 praises 中缺少对应夸赞`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    script: {
      situation: (o['situation'] as ValidatedScript['situation'])!,
      praises: o['praises'] as ValidatedScript['praises'],
      fallback: o['fallback'] as ValidatedScript['fallback'],
    },
  };
}

/** 校验一批剧本（数组），返回成功的剧本与失败的错误列表。 */
export function validateUserScripts(raw: unknown): {
  scripts: ValidatedScript[];
  errors: string[];
} {
  if (!Array.isArray(raw)) {
    return { scripts: [], errors: ['需为剧本对象数组'] };
  }
  const scripts: ValidatedScript[] = [];
  const errors: string[] = [];
  raw.forEach((item, i) => {
    const r = validateUserScript(item);
    if (r.ok && r.script) {
      scripts.push(r.script);
    } else {
      errors.push(`第 ${i + 1} 个剧本：${r.errors.join('；')}`);
    }
  });
  return { scripts, errors };
}

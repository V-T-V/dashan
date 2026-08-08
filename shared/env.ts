/**
 * 轻量 .env 加载器（零依赖）。
 *
 * 仅做最朴素的事：读取 .env，按 `KEY=VALUE` 解析，注入到 process.env。
 * 不支持多行值、变量插值等高级特性——本项目用不到。
 *
 * 改编自工作区兄弟项目 agentresearch/src/env.ts，仅作路径适配。
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let loaded = false;

/** 解析单行 KEY=VALUE，返回 [key, value] 或 null（注释/空行） */
function parseLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const eqIndex = trimmed.indexOf('=');
  if (eqIndex <= 0) return null;

  const key = trimmed.slice(0, eqIndex).trim();
  let value = trimmed.slice(eqIndex + 1).trim();

  // 去掉首尾成对的引号
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

/**
 * 解析整段 .env 文本为 { key: value } 字典。
 *
 * 纯函数（不碰 process.env、不读文件），便于测试与 SSR。
 * 行为：
 *  - 空行与 `#` 开头的注释行跳过
 *  - 无 `=` 或 `=value`（缺 key）的行静默跳过（容错）
 *  - 后出现的同名 key 覆盖前者（与 shell 行为一致）
 *  - 成对的双引号/单引号被剥离；不成对则原样保留
 *
 * @param raw .env 文件原始文本
 * @returns 解析出的键值字典（空文本/全非法行 → 空对象）
 */
export function parseEnvText(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    // 跳过空 key（parseLine 已保证，但双重防御）
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

/** 从 cwd 向上查找并加载 .env，仅注入未设置的变量（不覆盖已有） */
export function loadEnv(cwd: string = process.cwd()): void {
  if (loaded) return;
  loaded = true;

  const envPath = resolve(cwd, '.env');
  if (!existsSync(envPath)) return;

  const raw = readFileSync(envPath, 'utf8');
  const parsed = parseEnvText(raw);
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** 读取一个环境变量，支持默认值 */
export function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

/**
 * 读取一个数值型环境变量。
 *
 * 与 `Number(env(key, String(fallback))) || fallback` 的关键差异：
 *  - 那种写法会把合法的 `0` 当假值吞掉（如 `KINDNESS_LLM_RETRIES=0` 被当成 3、
 *    `KINDNESS_LLM_TIMEOUT_MS=0` 被当成 30000）。本函数显式区分「未设置/空/NaN」
 *    与「合法的 0」：仅在变量缺失、空串或解析为 NaN 时回退；显式的 `0` 被保留。
 *  - 仍受 fallback 钳制：fallback 必须是有限数（否则也按 NaN 处理返回它本身）。
 *
 * @param key 环境变量名
 * @param fallback 解析失败/未设置时的默认值
 * @returns 解析出的数值（0 也算合法）；解析失败返回 fallback
 */
export function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

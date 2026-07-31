/**
 * 大善系统 —— localStorage 持久化（跨会话保存善恶簿与称号）。
 *
 * 之前每次刷新都从零开始，善恶簿和称号晋升全部丢失。
 * 本模块把 Ledger 的记录序列化到 localStorage，启动时恢复。
 * 与网页/CLI 都无关，纯逻辑 + localStorage API。
 */

import type { LedgerEntry } from './ledgerCore.ts';
import type { Message, Situation } from './types.ts';

const STORAGE_KEY = 'dashan-save-v1';
const CURRENT_VERSION = 1;

/** 持久化的存档结构。 */
export interface DashanSave {
  version: number;
  entries: LedgerEntry[];
  /** 是否已触发过结局（避免每次刷新都弹结局）。 */
  endingReached: boolean;
  /** 对话历史（含 system prompt），用于「继续上局」。 */
  history?: Message[];
  /** 当前未作答的情境，用于「继续上局」时直接渲染。 */
  currentSituation?: Situation | null;
  /** fallback 剧本池游标（决定下一个情境），用于「继续上局」不重头。 */
  cursor?: number;
  /** 用户导入的自定义剧本，跨会话保留。 */
  userScripts?: unknown[];
}

/** 生成空白存档。 */
export function createEmptySave(): DashanSave {
  return { version: CURRENT_VERSION, entries: [], endingReached: false };
}

/** 读取存档；失败/不存在/损坏一律返回空白，永不抛错。 */
export function loadSave(): DashanSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptySave();
    const parsed = JSON.parse(raw) as Partial<DashanSave>;
    return migrate(parsed);
  } catch {
    return createEmptySave();
  }
}

/** 写入存档；失败静默忽略（隐私模式/容量满）。 */
export function writeSave(data: DashanSave): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* 隐私模式或容量满：忽略 */
  }
}

/** 清空存档（"再启新卷"用）。 */
export function resetSave(): DashanSave {
  const fresh = createEmptySave();
  writeSave(fresh);
  return fresh;
}

/** 把任意部分存档修补成完整结构（兼容老版本/损坏数据）。 */
function migrate(parsed: Partial<DashanSave>): DashanSave {
  const entries = Array.isArray(parsed.entries) ? (parsed.entries as LedgerEntry[]) : [];
  return {
    version: CURRENT_VERSION,
    entries,
    endingReached: parsed.endingReached === true,
    // 对话进度字段：老存档没有 → undefined，调用方按"无进度"处理
    history: Array.isArray(parsed.history) ? (parsed.history as Message[]) : undefined,
    currentSituation:
      parsed.currentSituation && typeof parsed.currentSituation === 'object'
        ? (parsed.currentSituation as Situation)
        : undefined,
    cursor: typeof parsed.cursor === 'number' ? parsed.cursor : undefined,
    // 用户自定义剧本：保留为数组（损坏/非数组 → undefined，调用方按"无剧本"处理）
    userScripts: Array.isArray(parsed.userScripts) ? parsed.userScripts : undefined,
  };
}

/** 标记结局已触发并持久化。 */
export function markEndingReached(data: DashanSave): void {
  data.endingReached = true;
  writeSave(data);
}

/** 清除结局标记（继续修行后允许再次触发）。 */
export function clearEndingMark(data: DashanSave): void {
  data.endingReached = false;
  writeSave(data);
}

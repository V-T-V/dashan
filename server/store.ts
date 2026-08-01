/**
 * 大善系统 —— server 侧会话存储（进程内内存）。
 *
 * 网页前端的善恶簿走 localStorage（每用户独立），但 server 也提供一组
 * 读 API（/api/history、/api/titles）和重置 API（/api/reset），用于：
 *  - 不依赖浏览器看「我的修行时间线」（如远程展示 / CLI 联机）。
 *  - 暴露称号阶梯元数据给前端做进度条渲染。
 *  - 清空服务端缓存的对局状态。
 *
 * 设计：
 *  - 纯内存，单进程内单玩家（本地开发 / 单人试用场景；不带鉴权）。
 *  - 通过 createApp 注入，便于测试隔离（每个测试用例独立 store）。
 *  - 持有一个 Ledger 实例 + 时间戳，由 /api/chat 回调写入（可选），
 *    也可由 POST /api/history 直接整体覆盖（前端把 localStorage 的内容同步上来）。
 */

import { Ledger, type LedgerEntry } from '../shared/ledgerCore.ts';

/** server 侧会话存储接口（便于测试注入 mock）。 */
export interface SessionStore {
  /** 读取当前善恶簿记录（只读视图）。 */
  entries(): readonly LedgerEntry[];
  /** 用一整批记录覆盖当前善恶簿。 */
  setEntries(entries: readonly LedgerEntry[]): void;
  /** 追加一笔记录（供 /api/chat 在线记录）。 */
  addEntry(entry: Omit<LedgerEntry, 'index'>): void;
  /** 清空。 */
  clear(): void;
  /** 当前笔数。 */
  count(): number;
}

/** 进程内单例存储（默认实现）。 */
export class MemorySessionStore implements SessionStore {
  private readonly ledger = new Ledger();

  entries(): readonly LedgerEntry[] {
    return this.ledger.all();
  }

  setEntries(entries: readonly LedgerEntry[]): void {
    this.ledger.clear();
    this.ledger.import([...entries]);
  }

  addEntry(entry: Omit<LedgerEntry, 'index'>): void {
    this.ledger.addEntry(entry);
  }

  clear(): void {
    this.ledger.clear();
  }

  count(): number {
    return this.ledger.count();
  }
}

/** 校验并标准化前端传来的 entries（用于 POST /api/history 覆盖）。 */
export function normalizeEntries(raw: unknown): LedgerEntry[] {
  if (!Array.isArray(raw)) {
    throw new Error('entries 需为数组');
  }
  const out: LedgerEntry[] = [];
  raw.forEach((item, i) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`entries[${i}] 非对象`);
    }
    const o = item as Record<string, unknown>;
    if (
      typeof o['situation'] !== 'string' ||
      typeof o['deed'] !== 'string' ||
      typeof o['verdict'] !== 'string' ||
      typeof o['tone'] !== 'string'
    ) {
      throw new Error(`entries[${i}] 字段不完整（需含 situation/deed/verdict/tone）`);
    }
    out.push({
      index: typeof o['index'] === 'number' ? (o['index'] as number) : i + 1,
      situation: o['situation'],
      deed: o['deed'],
      verdict: o['verdict'],
      tone: o['tone'] as LedgerEntry['tone'],
    });
  });
  return out;
}

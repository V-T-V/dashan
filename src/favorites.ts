/**
 * 大善系统 —— 收藏夹（把觉得有意思的困境存起来）。
 *
 * 纯逻辑 + localStorage 持久化：与 ledgerCore 一样，核心（增删查/分类筛选）做成纯函数，
 * 本文件再薄薄包一层 DOM 渲染与抽屉开关。
 */
import { type Category, ALL_CATEGORIES, CATEGORY_EMOJI } from '../shared/types.ts';
import { escapeHtml } from '../shared/ledgerCore.ts';

/** 一条收藏。 */
export interface FavoriteEntry {
  /** 情境文本。 */
  situation: string;
  /** 分类（可缺省 → 归入「人性」展示）。 */
  category?: Category;
  /** 用户当时的选择（可缺省，开局情境可能还没选）。 */
  deed?: string;
  /** 收藏时间戳。 */
  savedAt: number;
}

const STORAGE_KEY = 'dashan-favorites-v1';

/** 读取收藏列表；失败返回空。 */
export function loadFavorites(): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FavoriteEntry[]) : [];
  } catch {
    return [];
  }
}

/** 写入收藏列表；失败静默。 */
function writeFavorites(list: FavoriteEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* 忽略 */
  }
}

/** 添加一条收藏。已存在（相同情境文本）则不重复。返回是否新增。 */
export function addFavorite(entry: Omit<FavoriteEntry, 'savedAt'>): boolean {
  const list = loadFavorites();
  if (list.some((e) => e.situation === entry.situation)) return false;
  list.push({ ...entry, savedAt: Date.now() });
  writeFavorites(list);
  return true;
}

/** 删除一条收藏（按情境文本匹配）。返回是否删除。 */
export function removeFavorite(situation: string): boolean {
  const list = loadFavorites();
  const next = list.filter((e) => e.situation !== situation);
  if (next.length === list.length) return false;
  writeFavorites(next);
  return true;
}

/** 是否已收藏某情境。 */
export function isFavorited(situation: string): boolean {
  return loadFavorites().some((e) => e.situation === situation);
}

/** 按分类筛选收藏（category 为 undefined 时返回全部）。 */
export function filterByCategory(
  list: readonly FavoriteEntry[],
  category: Category | undefined,
): FavoriteEntry[] {
  if (category === undefined) return [...list];
  return list.filter((e) => normalizeCategory(e.category) === category);
}

/** 统计各分类的收藏数。 */
export function countByCategory(list: readonly FavoriteEntry[]): Record<Category, number> {
  const counts = {} as Record<Category, number>;
  for (const c of ALL_CATEGORIES) counts[c] = 0;
  for (const e of list) {
    const c = normalizeCategory(e.category);
    counts[c] += 1;
  }
  return counts;
}

/** 清空全部收藏。 */
export function clearFavorites(): void {
  writeFavorites([]);
}

// ---------- DOM 渲染（抽屉页签） ----------

let activeFilter: Category | undefined = undefined;

/** 翻开收藏抽屉。 */
export function openFavorites(): void {
  const ov = document.getElementById('favorites-overlay');
  if (!ov) return;
  activeFilter = undefined;
  renderFavorites();
  ov.classList.remove('hidden');
}

/** 合上收藏抽屉。 */
export function closeFavorites(): void {
  const ov = document.getElementById('favorites-overlay');
  if (ov) ov.classList.add('hidden');
}

/** 切换分类筛选。 */
export function setFilter(category: Category | undefined): void {
  activeFilter = category;
  renderFavorites();
}

/** 渲染收藏抽屉内容。 */
export function renderFavorites(): void {
  const body = document.getElementById('favorites-body');
  const tabs = document.getElementById('favorites-tabs');
  const summary = document.getElementById('favorites-summary');
  if (!body || !tabs || !summary) return;

  const all = loadFavorites();
  const counts = countByCategory(all);
  const shown = filterByCategory(all, activeFilter);

  // 分类筛选标签
  tabs.innerHTML = '';
  const allBtn = makeTab('全部', all.length, activeFilter === undefined, () =>
    setFilter(undefined),
  );
  tabs.appendChild(allBtn);
  for (const c of ALL_CATEGORIES) {
    tabs.appendChild(
      makeTab(`${CATEGORY_EMOJI[c]}${c}`, counts[c], activeFilter === c, () => setFilter(c)),
    );
  }

  summary.textContent = `共收藏 ${all.length} 条${activeFilter ? ` · 当前筛选 ${activeFilter}` : ''}`;

  body.innerHTML = '';
  if (shown.length === 0) {
    body.innerHTML =
      '<div class="fav-empty">尚未收藏任何困境。<br>对话中点击情境旁的 ☆ 可收藏。</div>';
    return;
  }

  // 倒序：最新在上
  for (const e of [...shown].reverse()) {
    const cat = normalizeCategory(e.category);
    const row = document.createElement('div');
    row.className = 'fav-entry';
    row.innerHTML = `
      <div class="fav-head">
        <span class="fav-cat">${CATEGORY_EMOJI[cat]}${cat}</span>
        <button class="fav-remove" data-sit="${escapeHtml(e.situation)}" type="button">✕</button>
      </div>
      <div class="fav-situation">${escapeHtml(e.situation)}</div>
      ${e.deed ? `<div class="fav-deed">汝之所为：${escapeHtml(e.deed)}</div>` : ''}
    `;
    body.appendChild(row);
  }

  // 绑定删除按钮
  body.querySelectorAll<HTMLButtonElement>('.fav-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sit = btn.dataset['sit'] ?? '';
      removeFavorite(sit);
      renderFavorites();
    });
  });
}

/** 构造一个分类筛选标签按钮。 */
function makeTab(label: string, count: number, active: boolean, onClick: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fav-tab' + (active ? ' fav-tab--active' : '');
  btn.textContent = `${label} (${count})`;
  btn.addEventListener('click', onClick);
  return btn;
}

/** 把可能缺省的分类归一到合法值（缺省 → 人性）。 */
function normalizeCategory(c?: Category): Category {
  return c ?? '人性';
}

export const PREDEFINED_CATEGORIES = [
  'Housing',
  'Food',
  'Transportation',
  'Utilities',
  'Health',
  'Shopping',
  'Entertainment',
  'Education',
  'Personal',
  'Other',
] as const;

export type PredefinedCategory = (typeof PREDEFINED_CATEGORIES)[number];

/** Stable palette for category tiles & chart segments */
const CATEGORY_COLORS = [
  '#9E2B1E',
  '#1A5F7A',
  '#1A7A4C',
  '#9A6700',
  '#6B4C9A',
  '#C45C26',
  '#2C6E6A',
  '#8B4557',
  '#4A5568',
  '#5C544D',
] as const;

const PREDEFINED_COLOR_MAP: Record<string, string> = {
  Housing: '#1A5F7A',
  Food: '#C45C26',
  Transportation: '#2C6E6A',
  Utilities: '#9A6700',
  Health: '#8B4557',
  Shopping: '#6B4C9A',
  Entertainment: '#9E2B1E',
  Education: '#1A7A4C',
  Personal: '#4A5568',
  Other: '#5C544D',
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Resolve a consistent color for a category name (or use stored color). */
export function getCategoryColor(name: string, stored?: string | null): string {
  if (stored && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(stored)) return stored;
  if (!name) return CATEGORY_COLORS[CATEGORY_COLORS.length - 1];
  const predefined = PREDEFINED_COLOR_MAP[name];
  if (predefined) return predefined;
  return CATEGORY_COLORS[hashString(name.toLowerCase()) % CATEGORY_COLORS.length];
}

/** Soft tinted background from category color (dark-friendly opacity). */
export function getCategoryTint(color: string, alpha = 0.22): string {
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getCategoryEmoji(name: string) {
  if (!name) return '🏷️';
  const lower = name.toLowerCase();

  if (
    lower.includes('education') ||
    lower.includes('school') ||
    lower.includes('college') ||
    lower.includes('uni') ||
    lower.includes('course') ||
    lower.includes('tuition') ||
    lower.includes('book')
  ) {
    return '🎓';
  }
  if (
    lower.includes('food') ||
    lower.includes('burger') ||
    lower.includes('eat') ||
    lower.includes('dine') ||
    lower.includes('restaurant') ||
    lower.includes('pizza')
  ) {
    return '🍔';
  }
  if (lower.includes('grocer') || lower.includes('mart') || lower.includes('supermarket') || lower.includes('bazaar')) {
    return '🛒';
  }
  if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('tea') || lower.includes('chai')) {
    return '☕';
  }
  if (lower.includes('petrol') || lower.includes('fuel') || lower.includes('gas')) {
    return '⛽';
  }
  if (
    lower.includes('transportation') ||
    lower.includes('car') ||
    lower.includes('vehicle') ||
    lower.includes('taxi') ||
    lower.includes('uber') ||
    lower.includes('careem') ||
    lower.includes('indrive') ||
    lower.includes('ride')
  ) {
    return '🚗';
  }
  if (lower.includes('travel') || lower.includes('flight') || lower.includes('trip') || lower.includes('train')) {
    return '✈️';
  }
  if (
    lower.includes('utilit') ||
    lower.includes('bill') ||
    lower.includes('electric') ||
    lower.includes('internet') ||
    lower.includes('wifi') ||
    lower.includes('water') ||
    lower.includes('stormfiber')
  ) {
    return '⚡';
  }
  if (
    lower.includes('housing') ||
    lower.includes('rent') ||
    lower.includes('house') ||
    lower.includes('home') ||
    lower.includes('mortgage')
  ) {
    return '🏠';
  }
  if (
    lower.includes('health') ||
    lower.includes('med') ||
    lower.includes('doctor') ||
    lower.includes('pharmacy') ||
    lower.includes('clinic')
  ) {
    return '💊';
  }
  if (
    lower.includes('sport') ||
    lower.includes('gym') ||
    lower.includes('fitness') ||
    lower.includes('padel') ||
    lower.includes('workout')
  ) {
    return '🎾';
  }
  if (
    lower.includes('shop') ||
    lower.includes('cloth') ||
    lower.includes('apparel') ||
    lower.includes('shoes') ||
    lower.includes('fashion') ||
    lower.includes('mall')
  ) {
    return '🛍️';
  }
  if (
    lower.includes('sub') ||
    lower.includes('software') ||
    lower.includes('app') ||
    lower.includes('tech') ||
    lower.includes('chatgpt')
  ) {
    return '💻';
  }
  if (
    lower.includes('entertainment') ||
    lower.includes('movie') ||
    lower.includes('cinema') ||
    lower.includes('netflix') ||
    lower.includes('game')
  ) {
    return '🍿';
  }
  if (lower.includes('gift') || lower.includes('charity') || lower.includes('donation') || lower.includes('zakat')) {
    return '🎁';
  }
  if (lower.includes('family') || lower.includes('kids')) {
    return '👨‍👩‍👧‍👦';
  }
  if (
    lower.includes('personal') ||
    lower.includes('grooming') ||
    lower.includes('salon') ||
    lower.includes('hair') ||
    lower.includes('barber')
  ) {
    return '✂️';
  }

  return '🏷️';
}

/** @deprecated Prefer PaymentBadge — text labels without emoji */
export function getPaymentEmoji(method: string) {
  if (method === 'cash') return 'Cash';
  if (method === 'card') return 'Card';
  if (method === 'bank') return 'Bank';
  return method;
}

/** Merge DB category names with predefined defaults. DB list wins when non-empty. */
export function mergeCategoryNames(dbNames: string[] | null | undefined): string[] {
  const fromDb = (dbNames || []).map((n) => n.trim()).filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  const source = fromDb.length > 0 ? fromDb : [...PREDEFINED_CATEGORIES];

  for (const name of source) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }

  return result;
}

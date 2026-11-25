import { getCategoryColor, getCategoryEmoji, getCategoryTint } from '../../../utils/categories';

export function CategoryTile({
  name,
  color,
  emoji,
  size = 'md',
}: {
  name: string;
  color?: string | null;
  emoji?: string | null;
  size?: 'sm' | 'md';
}) {
  const resolvedColor = getCategoryColor(name, color);
  const tint = getCategoryTint(resolvedColor);
  const resolvedEmoji = emoji || getCategoryEmoji(name);
  const showLetter = !resolvedEmoji || resolvedEmoji === '🏷️';
  const dim = size === 'sm' ? 'w-8 h-8 text-[15px]' : 'w-9 h-9 text-[18px]';

  return (
    <span
      className={`${dim} rounded-lg flex items-center justify-center shrink-0 border border-white/10`}
      style={{ backgroundColor: tint, color: resolvedColor }}
      aria-hidden
      title={name}
    >
      {showLetter && !emoji ? (
        <span className="text-xs font-semibold uppercase leading-none">
          {(name || '?').charAt(0)}
        </span>
      ) : (
        <span className="ef-emoji leading-none">{resolvedEmoji}</span>
      )}
    </span>
  );
}

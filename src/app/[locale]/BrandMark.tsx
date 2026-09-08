/**
 * Знак Araqs — клавиатура телефона, где подсвеченные точки складываются
 * в диагональ, букву «A».
 *
 * Рисунком, а не картинкой: он нужен в трёх размерах (шапка, подвал, иконка),
 * и в каждом должен оставаться чётким.
 */
export default function BrandMark({
  size = 32,
  inverted = false,
}: {
  size?: number;
  /** На тёмной подложке квадрат становится янтарным, а точки — чернильными. */
  inverted?: boolean;
}) {
  const plate = inverted ? "#c9982a" : "#101418";
  const dim = inverted ? "rgba(16,20,24,.45)" : "#5b646e";
  const lit = inverted ? "#101418" : "#c9982a";

  // Диагональ снизу слева вверх направо — та самая «A».
  const dots = [
    [13, 13, dim], [22, 13, dim], [31, 13, lit],
    [13, 22, dim], [22, 22, lit], [31, 22, dim],
    [13, 31, lit], [22, 31, dim], [31, 31, dim],
  ] as const;

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <rect width="44" height="44" rx="12" fill={plate} />
      {dots.map(([cx, cy, fill]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" fill={fill} />
      ))}
    </svg>
  );
}

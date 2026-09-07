/**
 * Номер с подсвеченным узором.
 *
 * Движок отдаёт восемь значащих цифр (window) и границы найденного узора
 * patternFrom..patternTo — включительные индексы внутри этих восьми цифр.
 * Подсвечиваем ровно этот участок: покупатель видит, за что платит,
 * без чтения пояснений.
 */
export default function PatternNumber({
  window: digits,
  from,
  to,
}: {
  window: string;
  from?: number | null;
  to?: number | null;
}) {
  const hasPattern = typeof from === "number" && typeof to === "number" && to >= from;

  // Восемь цифр читаются парами: 77 24 44 44.
  const groups: number[][] = [];
  for (let i = 0; i < digits.length; i += 2) {
    groups.push([i, Math.min(i + 2, digits.length)]);
  }

  return (
    <div className="number mono pattern-number">
      <span className="pattern-prefix">+374</span>
      {groups.map(([start, end]) => (
        <span key={start} className="pattern-group">
          {digits
            .slice(start, end)
            .split("")
            .map((digit, offset) => {
              const i = start + offset;
              const lit = hasPattern && i >= (from as number) && i <= (to as number);
              return (
                <span key={i} className={lit ? "pattern-digit lit" : "pattern-digit"}>
                  {digit}
                </span>
              );
            })}
        </span>
      ))}
    </div>
  );
}

export function parseItemPrefixAndNum(numStr: string): { prefix: string; num: number } {
  const str = (numStr || '').trim();
  if (!str) return { prefix: '', num: 0 };

  const match = str.match(/^([A-Za-z\s_-]+)?(\d+)$/);
  if (match) {
    const rawP = match[1] || '';
    const normP = rawP.trim().toUpperCase().replace(/[-_]+$/, '');
    const num = parseInt(match[2], 10);
    return { prefix: normP, num };
  }

  const digitMatch = str.match(/\d+$/);
  if (digitMatch) {
    const num = parseInt(digitMatch[0], 10);
    const rawP = str.substring(0, str.length - digitMatch[0].length);
    const normP = rawP.trim().toUpperCase().replace(/[-_]+$/, '');
    return { prefix: normP, num };
  }

  return { prefix: str.toUpperCase(), num: 0 };
}

export function sortItemsNaturally<T extends Record<string, any>>(
  items: T[],
  numberKey: string = 'seatNumber'
): T[] {
  return [...items].sort((a, b) => {
    const floorA = Math.max(1, Number(a.floor) || 1);
    const floorB = Math.max(1, Number(b.floor) || 1);
    if (floorA !== floorB) return floorA - floorB;

    const valA = String(a[numberKey] || a.seatNumber || a.lockerNumber || '');
    const valB = String(b[numberKey] || b.seatNumber || b.lockerNumber || '');

    const pA = parseItemPrefixAndNum(valA);
    const pB = parseItemPrefixAndNum(valB);

    if (pA.prefix !== pB.prefix) {
      return pA.prefix.localeCompare(pB.prefix);
    }
    if (pA.num !== pB.num) {
      return pA.num - pB.num;
    }
    return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

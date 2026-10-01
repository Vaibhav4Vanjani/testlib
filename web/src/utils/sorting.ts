export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortItemsNaturally<T>(items: T[], keyExtractor: (item: T) => string): T[] {
  return [...items].sort((a, b) => naturalCompare(keyExtractor(a), keyExtractor(b)));
}

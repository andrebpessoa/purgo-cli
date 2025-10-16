export function toBytes(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  
  if (typeof value === 'bigint') {
    return Number(value);
  }
  
  if (value && typeof value === 'object') {
    const obj = value as Record<string, any>;
    
    if (typeof obj.size === 'number') return obj.size;
    if (typeof obj.bytes === 'number') return obj.bytes;
    if (typeof obj.raw === 'number') return obj.raw;
    
    const primitive = obj.valueOf?.();
    if (typeof primitive === 'number') return primitive;
  }
  
  return 0;
}

export function deduplicatePaths(paths: string[]): string[] {
  const normalizePath = (p: string) => p.replace(/\\/g, '/');
  const sorted = [...paths]
    .map(normalizePath)
    .sort((a, b) => a.length - b.length);
  
  const kept: string[] = [];
  for (const p of sorted) {
    if (!kept.some(k => p === k || p.startsWith(k + '/'))) {
      kept.push(p);
    }
  }
  
  return kept;
}


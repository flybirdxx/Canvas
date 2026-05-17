import type { ModelDescriptor } from './types';

export function computeUnitPrice(
  model: ModelDescriptor,
  args: { resolution?: string; qualityLevel?: string },
): { amount: number; currency: string } | undefined {
  const pricing = model.pricing;
  if (!pricing) return undefined;
  if (typeof pricing.flat === 'number') {
    return { amount: pricing.flat, currency: pricing.currency };
  }
  if (!pricing.matrix) return undefined;

  const resolution = (args.resolution ?? '720p').toLowerCase();
  const keys = Object.keys(pricing.matrix);
  if (keys.length === 0) return undefined;

  const firstKey = keys[0] ?? '';
  const firstValue = (pricing.matrix as unknown as Record<string, unknown>)[firstKey];
  if (typeof firstValue === 'number') {
    const value = (pricing.matrix as Record<string, number>)[resolution];
    return typeof value === 'number' ? { amount: value, currency: pricing.currency } : undefined;
  }

  const level = (args.qualityLevel ?? 'medium').toLowerCase();
  const row = (pricing.matrix as Record<string, Record<string, number>>)[level];
  const value = row ? row[resolution] : undefined;
  return typeof value === 'number' ? { amount: value, currency: pricing.currency } : undefined;
}

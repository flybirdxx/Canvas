import { RunningHubProvider } from './providers/runninghub';
import { T8StarProvider } from './providers/t8star';
import type { Capability, GatewayProvider, ModelDescriptor } from './types';

const PROVIDERS: GatewayProvider[] = [
  T8StarProvider,
  RunningHubProvider,
];

export function listProviders(): GatewayProvider[] {
  return PROVIDERS;
}

export function getProvider(providerId: string): GatewayProvider | undefined {
  return PROVIDERS.find(provider => provider.id === providerId);
}

export function listModels(capability: Capability): ModelDescriptor[] {
  const out: ModelDescriptor[] = [];
  for (const provider of PROVIDERS) {
    for (const model of provider.models) {
      if (model.capability === capability) out.push(model);
    }
  }
  return out;
}

export function findModel(modelId: string): { model: ModelDescriptor; provider: GatewayProvider } | undefined {
  for (const provider of PROVIDERS) {
    const model = provider.models.find(item => item.id === modelId);
    if (model) return { model, provider };
  }
  return undefined;
}

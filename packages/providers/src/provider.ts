export type ProviderCapability = "balances" | "transactions" | "prices";

export interface ProviderRequestContext {
  accountId: string;
  connectionId: string;
  walletId?: string;
  chainId?: string;
  capability: ProviderCapability;
  cursor?: unknown;
  requestId: string;
}

export interface ProviderPage {
  sourceKey?: string;
  payload: unknown;
  observedAt?: string;
  effectiveAt?: string;
  nextCursor?: unknown;
  complete: boolean;
  requestMetadata: {
    endpoint: string;
    statusCode?: number;
    credits?: string;
    rateLimitRemaining?: string;
  };
}

export interface ProviderAdapter {
  readonly provider: string;
  readonly version: string;
  readonly capabilities: readonly ProviderCapability[];
  fetch(context: ProviderRequestContext, signal: AbortSignal): AsyncIterable<ProviderPage>;
}

export class ProviderRegistry {
  readonly #adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    if (this.#adapters.has(adapter.provider)) throw new Error(`provider ${adapter.provider} is already registered`);
    this.#adapters.set(adapter.provider, adapter);
  }

  require(provider: string): ProviderAdapter {
    const adapter = this.#adapters.get(provider);
    if (!adapter) throw new Error(`provider ${provider} is not configured`);
    return adapter;
  }
}

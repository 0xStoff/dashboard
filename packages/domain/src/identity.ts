declare const brand: unique symbol;

export type Branded<T, Name extends string> = T & { readonly [brand]: Name };
export type AccountId = Branded<string, "AccountId">;
export type UserId = Branded<string, "UserId">;
export type WalletId = Branded<string, "WalletId">;
export type AssetId = Branded<string, "AssetId">;
export type ChainId = Branded<string, "ChainId">;
export type CurrencyCode = Branded<string, "CurrencyCode">;

const slugPattern = /^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/;
const currencyPattern = /^[A-Z][A-Z0-9]{2,11}$/;

export function canonicalId<Name extends string>(value: string, name: Name): Branded<string, Name> {
  const normalized = value.trim().toLowerCase();
  if (!slugPattern.test(normalized)) {
    throw new TypeError(`${name} must be a lowercase canonical identifier`);
  }
  return normalized as Branded<string, Name>;
}

export function currencyCode(value: string): CurrencyCode {
  const normalized = value.trim().toUpperCase();
  if (!currencyPattern.test(normalized)) {
    throw new TypeError("currency code must contain 3-12 uppercase letters or digits");
  }
  return normalized as CurrencyCode;
}

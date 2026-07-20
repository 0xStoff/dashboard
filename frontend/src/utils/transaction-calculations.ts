import type { GnosisTransactionRecord, TransactionRecord } from "../interfaces";

const SUCCESSFUL_STATUSES = new Set(["approved", "completed", "successful", "success"]);
const XMR_ASSETS = new Set(["XMR", "XXMR", "MONERO"]);
const FIAT_ASSETS = new Set(["CHF", "CHF.HOLD"]);
const BINANCE_DEPOSIT_TYPES = new Set([
  "",
  "bank transfer",
  "credit card",
  "deposit",
  "third party",
]);

export interface TransactionTotals {
  deposits: number;
  depositBreakdown: {
    binance: number;
    krakenChf: number;
    krakenEur: number;
    krakenXmr: number;
  };
  fiatWithdrawals: number;
  xmrWithdrawals: number;
  rubicWithdrawals: number;
  fees: number;
}

const normalize = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const absoluteNumber = (value: unknown) => Math.abs(Number(value) || 0);

export const isIncluded = (transaction: { excludedFromTotals?: boolean }) =>
  !transaction.excludedFromTotals;

export const isSuccessful = (transaction: { status: string }) =>
  SUCCESSFUL_STATUSES.has(normalize(transaction.status));

export const isApprovedGnosisTransaction = (transaction: GnosisTransactionRecord) =>
  isIncluded(transaction) && normalize(transaction.status) === "approved";

export const gnosisAmountChf = (transaction: GnosisTransactionRecord) =>
  absoluteNumber(transaction.transactionAmount) / 100;

const isDeposit = (transaction: TransactionRecord) => {
  const exchange = normalize(transaction.exchange);
  const type = normalize(transaction.type);

  if (exchange === "kraken") return type === "deposit";
  if (exchange === "binance") return BINANCE_DEPOSIT_TYPES.has(type);
  return false;
};

const isWithdrawal = (transaction: TransactionRecord) =>
  normalize(transaction.type) === "withdrawal";

const isXmr = (transaction: TransactionRecord) =>
  XMR_ASSETS.has((transaction.asset || "").trim().toUpperCase());

const depositAmountChf = (transaction: TransactionRecord, eurToChfRate: number) => {
  if (isXmr(transaction)) return absoluteNumber(transaction.chf_value);
  if ((transaction.asset || "").trim().toUpperCase().startsWith("EUR")) {
    return absoluteNumber(transaction.amount) * eurToChfRate;
  }

  // Binance's fiat-payment API stores sourceAmount here even though older rows
  // carry the purchased crypto symbol in `asset`. Kraken fiat rows carry CHF,
  // CHF.HOLD, or the original EUR amount.
  return absoluteNumber(transaction.amount);
};

const addDeposit = (
  totals: TransactionTotals,
  transaction: TransactionRecord,
  eurToChfRate: number
) => {
  const amountChf = depositAmountChf(transaction, eurToChfRate);
  const exchange = normalize(transaction.exchange);
  const asset = (transaction.asset || "").trim().toUpperCase();

  totals.deposits += amountChf;
  if (exchange === "binance") {
    totals.depositBreakdown.binance += amountChf;
  } else if (isXmr(transaction)) {
    totals.depositBreakdown.krakenXmr += amountChf;
  } else if (asset.startsWith("EUR")) {
    totals.depositBreakdown.krakenEur += amountChf;
  } else {
    totals.depositBreakdown.krakenChf += amountChf;
  }
};

const feeAmountChf = (transaction: TransactionRecord, eurToChfRate: number) => {
  const exchange = normalize(transaction.exchange);
  const asset = (transaction.asset || "").trim().toUpperCase();

  if (exchange === "binance") return absoluteNumber(transaction.fee);
  if (exchange === "kraken" && FIAT_ASSETS.has(asset)) return absoluteNumber(transaction.fee);
  if (exchange === "kraken" && asset.startsWith("EUR")) {
    return absoluteNumber(transaction.fee) * eurToChfRate;
  }
  if (exchange === "kraken" && isXmr(transaction)) {
    const amount = absoluteNumber(transaction.amount);
    return amount
      ? absoluteNumber(transaction.chf_value) * (absoluteNumber(transaction.fee) / amount)
      : 0;
  }
  return 0;
};

export const calculateTransactionTotals = (
  transactions: TransactionRecord[],
  eurToChfRate: number
): TransactionTotals =>
  transactions.reduce<TransactionTotals>(
    (totals, transaction) => {
      if (!isIncluded(transaction) || !isSuccessful(transaction)) return totals;

      const exchange = normalize(transaction.exchange);
      if (isDeposit(transaction)) {
        addDeposit(totals, transaction, eurToChfRate);
      }

      if (isWithdrawal(transaction)) {
        if (isXmr(transaction)) {
          totals.xmrWithdrawals += absoluteNumber(transaction.chf_value);
        } else if (exchange === "binance" || FIAT_ASSETS.has((transaction.asset || "").toUpperCase())) {
          totals.fiatWithdrawals += absoluteNumber(transaction.amount);
        }
      }

      if (exchange === "rubic" && isXmr(transaction)) {
        totals.rubicWithdrawals += absoluteNumber(transaction.chf_value);
      }

      totals.fees += feeAmountChf(transaction, eurToChfRate);
      return totals;
    },
    {
      deposits: 0,
      depositBreakdown: {
        binance: 0,
        krakenChf: 0,
        krakenEur: 0,
        krakenXmr: 0,
      },
      fiatWithdrawals: 0,
      xmrWithdrawals: 0,
      rubicWithdrawals: 0,
      fees: 0,
    }
  );

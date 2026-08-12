import assert from "node:assert/strict";
import test from "node:test";
import { calculateRobinhoodPerformance, robinhoodAccountingConstants } from "../services/robinhood/performanceAccounting.js";

const MM = "0x00000000000000000000000000000000000000aa";
const RABBY = "0x00000000000000000000000000000000000000bb";
const EXTERNAL = "0x00000000000000000000000000000000000000cc";
const wei = (eth) => BigInt(Math.round(eth * 1e18)).toString();

test("MM to Rabby is an internal move, not funding or a withdrawal", () => {
  const result = calculateRobinhoodPerformance({
    address: MM,
    addresses: [MM, RABBY],
    account: { coin_balance: wei(0.99), exchange_rate: 2000 },
    transactions: [{ hash: "0xinternal", from: MM, to: RABBY, value: wei(1), fee: { value: wei(0.01) }, status: "ok" }],
    internalTransactions: [],
    tokenTransfers: [],
    tokenBalances: [],
  });

  assert.equal(result.funding.grossExternalFunding, 0);
  assert.equal(result.funding.externalWithdrawals, 0);
  assert.equal(result.reconciliation.nativeOutflow, 0);
  assert.equal(result.funding.gasPaid, 0.01);
});

test("a historical GMGN relocation is internal when its address is in the accounting scope", () => {
  const GMGN = "0x00000000000000000000000000000000000000dd";
  const result = calculateRobinhoodPerformance({
    address: MM,
    addresses: [MM, RABBY, GMGN],
    account: { coin_balance: wei(0.99), exchange_rate: 2000 },
    transactions: [{ hash: "0xgmgn-internal", from: GMGN, to: MM, value: wei(1), fee: { value: "0" }, status: "ok" }],
    internalTransactions: [],
    tokenTransfers: [],
    tokenBalances: [],
  });

  assert.equal(result.funding.grossExternalFunding, 0);
  assert.equal(result.funding.externalWithdrawals, 0);
  assert.equal(result.reconciliation.nativeOutflow, 0);
});

test("FUEL-linked flow becomes one closed developer-expense position", () => {
  const result = calculateRobinhoodPerformance({
    address: MM,
    addresses: [MM, RABBY],
    account: { coin_balance: "0", exchange_rate: 2000 },
    transactions: [{ hash: "0xfuel", from: MM, to: EXTERNAL, value: wei(0.5), fee: { value: wei(0.01) }, status: "ok" }],
    internalTransactions: [],
    tokenTransfers: [{
      transaction_hash: "0xfuel",
      from: MM,
      to: EXTERNAL,
      token: { address_hash: robinhoodAccountingConstants.FUEL, decimals: 18, symbol: "FUEL" },
      total: { value: "1000000000000000000", decimals: 18 },
    }],
    tokenBalances: [],
  });

  assert.equal(result.tokenPnl.length, 1);
  assert.equal(result.tokenPnl[0].classification, "developer-expense");
  assert.equal(result.tokenPnl[0].manuallyClosed, true);
  assert.equal(result.tokenPnl[0].ethInvested, 0.51);
  assert.equal(result.tokenPnl[0].totalPnlEth, -0.51);
  assert.equal(result.funding.externalWithdrawals, 0);
  assert.equal(result.creatorProject.fuelLinkedNativeFlow.outboundNativeEth, 0.5);
  assert.equal(result.creatorProject.fuelLinkedNativeFlow.matchingGasEth, 0.01);
  assert.equal(result.creatorProject.fuelLinkedNativeFlow.netNativeEth, 0.51);
  assert.equal(result.creatorProject.events.length, 1);
  assert.equal(result.creatorProject.audit.status, "partial");
});

test("CASHCAT supplied alongside FUEL LP activity stays in the CASHCAT position", () => {
  const cashcatTransfer = (hash, from, to, amount) => ({
    transaction_hash: hash,
    from,
    to,
    token: {
      address_hash: robinhoodAccountingConstants.CASHCAT,
      decimals: 18,
      symbol: "CASHCAT",
      name: "Cash Cat",
      exchange_rate: 20,
    },
    total: { value: wei(amount), decimals: 18 },
  });
  const fuelTransfer = {
    transaction_hash: "0xlp",
    from: MM,
    to: EXTERNAL,
    token: { address_hash: robinhoodAccountingConstants.FUEL, decimals: 18, symbol: "FUEL" },
    total: { value: wei(1), decimals: 18 },
  };
  const result = calculateRobinhoodPerformance({
    address: MM,
    addresses: [MM, RABBY],
    account: { coin_balance: "0", exchange_rate: 2000 },
    transactions: [
      { hash: "0xbuy", from: MM, to: EXTERNAL, value: wei(1), fee: { value: "0" }, status: "ok", timestamp: "2026-01-01" },
      { hash: "0xlp", from: MM, to: EXTERNAL, value: wei(0.1), fee: { value: wei(0.01) }, status: "ok", timestamp: "2026-01-02" },
    ],
    internalTransactions: [],
    tokenTransfers: [
      cashcatTransfer("0xbuy", EXTERNAL, MM, 100),
      cashcatTransfer("0xlp", MM, EXTERNAL, 40),
      fuelTransfer,
    ],
    tokenBalances: [],
  });

  const cashcat = result.tokenPnl.find((row) => row.contract === robinhoodAccountingConstants.CASHCAT);
  const developer = result.tokenPnl.find((row) => row.classification === "developer-expense");
  assert.equal(cashcat.ethInvested, 1);
  assert.equal(cashcat.otherOutflowQuantity, 0);
  assert.equal(cashcat.externalOutflowQuantity, 0);
  assert.equal(cashcat.remainingCostBasis, 1);
  assert.equal(cashcat.walletBalance, 60);
  assert.equal(result.funding.externalWithdrawals, 0);
  assert.equal(developer.ethInvested, 0.11);
  assert.equal(developer.totalPnlEth, -0.11);
});

test("gas on an internal FUEL relocation is still developer cost", () => {
  const result = calculateRobinhoodPerformance({
    address: MM,
    addresses: [MM, RABBY],
    account: { coin_balance: "0", exchange_rate: 2000 },
    transactions: [{ hash: "0xfuel-internal", from: MM, to: RABBY, value: "0", fee: { value: wei(0.01) }, status: "ok" }],
    internalTransactions: [],
    tokenTransfers: [{
      transaction_hash: "0xfuel-internal",
      from: MM,
      to: RABBY,
      token: { address_hash: robinhoodAccountingConstants.FUEL, decimals: 18, symbol: "FUEL" },
      total: { value: wei(1), decimals: 18 },
    }],
    tokenBalances: [],
  });

  const developer = result.tokenPnl.find((row) => row.classification === "developer-expense");
  assert.equal(developer.ethInvested, 0.01);
  assert.equal(developer.totalPnlEth, -0.01);
  assert.equal(result.creatorProject.fuelLinkedNativeFlow.matchingGasEth, 0.01);
});

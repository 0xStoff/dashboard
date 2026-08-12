import test from "node:test";
import assert from "node:assert/strict";
import { robinhoodEventKey } from "../services/robinhood/incrementalIndexService.js";

test("legacy and v2 token transfer shapes share one durable event key", () => {
    const legacy = {
        transaction_hash: "0xabc",
        log_index: "0x0f",
        token: { address_hash: "0xDEF" },
        total: { token_id: "0x10" },
    };
    const v2 = {
        transaction_hash: "0xabc",
        log_index: 15,
        token: { address_hash: "0xdef" },
        token_id: "16",
    };
    assert.equal(
        robinhoodEventKey("token-transfers", legacy),
        robinhoodEventKey("token-transfers", v2)
    );
});

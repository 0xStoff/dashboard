import RobinhoodTransactionClassification from "../../models/RobinhoodTransactionClassificationModel.js";

const ALLOWED_CLASSIFICATIONS = new Set(["lp", "swap", "transfer", "fee-collection", "ignore", "unknown"]);
const lower = (value) => String(value || "").toLowerCase();
const clean = (value, max = 160) => String(value || "").trim().slice(0, max) || null;

const publicAssignment = (row) => ({
    transactionHash: row.transaction_hash,
    classification: row.classification,
    lifecycleKey: row.lifecycle_key,
    label: row.label,
    notes: row.notes,
    metadata: row.metadata || {},
    updatedAt: row.updatedAt,
});

export const listRobinhoodClassifications = async (userId) => {
    if (!userId) throw new Error("Authenticated user is required");
    const rows = await RobinhoodTransactionClassification.findAll({
        where: { user_id: userId },
        order: [["updatedAt", "DESC"]],
    });
    return rows.map(publicAssignment);
};

export const saveRobinhoodClassification = async ({ userId, transactionHash, classification, lifecycleKey, label, notes, metadata }) => {
    const hash = lower(transactionHash);
    if (!/^0x[a-f0-9]{64}$/.test(hash)) throw new Error("A valid transaction hash is required");
    if (!ALLOWED_CLASSIFICATIONS.has(classification)) throw new Error("Unsupported transaction classification");
    if (classification === "lp" && !clean(lifecycleKey)) throw new Error("LP assignments require a lifecycle key");
    const [row] = await RobinhoodTransactionClassification.upsert({
        user_id: userId,
        transaction_hash: hash,
        classification,
        lifecycle_key: classification === "lp" ? clean(lifecycleKey) : null,
        label: clean(label),
        notes: clean(notes, 2000),
        metadata: metadata && typeof metadata === "object" ? metadata : {},
    }, { returning: true });
    return publicAssignment(row);
};

export const deleteRobinhoodClassification = async ({ userId, transactionHash }) => {
    await RobinhoodTransactionClassification.destroy({
        where: { user_id: userId, transaction_hash: lower(transactionHash) },
    });
};

const pairForEvents = (events) => {
    const symbols = new Set();
    for (const event of events) {
        if (Number(event.nativeDepositEth || 0) > 0 || Number(event.nativeReturnedEth || 0) > 0) symbols.add("ETH");
        for (const token of [...(event.depositedTokens || []), ...(event.returnedTokens || [])]) {
            if (token.symbol) symbols.add(token.symbol);
        }
    }
    return Array.from(symbols).slice(0, 3).join(" / ") || "Unidentified LP";
};

const canonicalLpSymbol = (value) => {
    const symbol = String(value || "").trim().toUpperCase();
    return symbol === "WETH" ? "ETH" : symbol;
};

const canonicalLpPair = (value) => {
    const symbols = String(value || "")
        .split(/[+/]/)
        .map(canonicalLpSymbol)
        .filter(Boolean);
    return [...new Set(symbols)].sort((left, right) => {
        if (left === "ETH") return -1;
        if (right === "ETH") return 1;
        return left.localeCompare(right);
    }).join(" / ");
};

const inferredLpPair = (position, live) => {
    const explicit = canonicalLpPair(live?.pair || position.pair);
    if (explicit) return explicit;
    const symbols = new Set();
    for (const event of position.events || []) {
        if (Number(event.nativeDepositEth || 0) > 0 || Number(event.nativeReturnedEth || 0) > 0) symbols.add("ETH");
        for (const token of [...(event.depositedTokens || []), ...(event.returnedTokens || [])]) {
            const symbol = canonicalLpSymbol(token.symbol);
            if (symbol) symbols.add(symbol);
        }
    }
    if (symbols.size === 1 && !symbols.has("ETH")) symbols.add("ETH");
    return canonicalLpPair([...symbols].join(" / ")) || `POSITION ${position.positionId}`;
};

export const buildRobinhoodLpStrategies = (data) => {
    const exactPositions = data.lpLifecycle?.positions || [];
    const liveRows = (data.lpPerformance || []).filter((item) => item.positionId);
    const liveById = new Map(liveRows.map((item) => [String(item.positionId), item]));
    const groups = new Map();

    for (const position of exactPositions) {
        const live = liveById.get(String(position.positionId))
            || (position.status === "open" && position.currentValueUsd != null ? {
                positionId: position.positionId,
                pair: position.pair,
                currentValueUsd: position.currentValueUsd,
            } : null);
        const pair = inferredLpPair(position, live);
        if (!groups.has(pair)) groups.set(pair, []);
        groups.get(pair).push({ position, live });
    }

    // Provider discovery can precede explorer indexing. Keep those positions
    // visible as unmatched strategies without guessing their cash-flow P&L.
    for (const live of liveRows) {
        if (exactPositions.some((position) => String(position.positionId) === String(live.positionId))) continue;
        const pair = canonicalLpPair(live.pair) || `POSITION ${live.positionId}`;
        if (!groups.has(pair)) groups.set(pair, []);
        groups.get(pair).push({
            live,
            position: {
                positionId: String(live.positionId),
                status: "open",
                valuationStatus: "partial",
                depositsUsd: 0,
                returnedUsd: 0,
                gasUsd: 0,
                events: [],
            },
        });
    }

    return [...groups.entries()].map(([pair, rows]) => {
        const liveRowsForPair = rows.filter((row) => row.live);
        const depositsUsd = rows.reduce((sum, row) => sum + Number(row.position.depositsUsd || 0), 0);
        const returnedUsd = rows.reduce((sum, row) => sum + Number(row.position.returnedUsd || 0), 0);
        const gasUsd = rows.reduce((sum, row) => sum + Number(row.position.gasUsd || 0), 0);
        const currentValueUsd = liveRowsForPair.reduce((sum, row) => sum + Number(row.live.currentValueUsd || 0), 0);
        const incompletePositionIds = rows.filter(({ position, live }) => {
            if (position.valuationStatus !== "valued") return true;
            if (live) return false;
            if (position.status === "closed") return false;
            // Explorer NFT ownership can lag after a burn. A valued return is
            // enough to establish that this old shell has zero current value.
            return !(Number(position.depositsUsd || 0) > 0 && Number(position.returnedUsd || 0) > 0);
        }).map((row) => String(row.position.positionId));
        const complete = incompletePositionIds.length === 0 && depositsUsd > 0;
        const pnlUsd = complete ? currentValueUsd + returnedUsd - depositsUsd - gasUsd : null;
        const netInvestedUsd = depositsUsd - returnedUsd;

        return {
            strategyKey: pair.toLowerCase().replace(/\s+/g, "-"),
            pair,
            status: liveRowsForPair.length ? "open" : "closed",
            positionIds: rows.map((row) => String(row.position.positionId)),
            livePositionIds: liveRowsForPair.map((row) => String(row.position.positionId)),
            depositsUsd,
            returnedUsd,
            gasUsd,
            netInvestedUsd,
            currentValueUsd,
            pnlUsd,
            returnPercent: pnlUsd != null && netInvestedUsd > 0 ? pnlUsd / netInvestedUsd * 100 : null,
            accountingStatus: complete ? "tracked" : "pending",
            incompletePositionIds,
            events: rows.flatMap((row) => row.position.events || [])
                .sort((left, right) => String(left.timestamp || "").localeCompare(String(right.timestamp || ""))),
        };
    }).sort((left, right) => {
        if (left.status !== right.status) return left.status === "open" ? -1 : 1;
        return right.currentValueUsd - left.currentValueUsd;
    });
};

export const applyRobinhoodClassifications = (data, assignments) => {
    const assignmentByHash = new Map(assignments.map((item) => [lower(item.transactionHash), item]));
    const rawUnmatched = data.lpLifecycle?.unmatchedMovements || [];
    const classifiedActivities = [];
    const stillUnmatched = [];
    const groups = new Map();

    for (const event of rawUnmatched) {
        const assignment = assignmentByHash.get(lower(event.hash));
        if (!assignment || assignment.classification === "unknown") {
            stillUnmatched.push(event);
            continue;
        }
        const decorated = { ...event, manualClassification: assignment };
        classifiedActivities.push(decorated);
        if (assignment.classification !== "lp") continue;
        const key = assignment.lifecycleKey;
        if (!groups.has(key)) groups.set(key, { key, assignment, events: [] });
        groups.get(key).events.push(decorated);
    }

    const livePositions = data.currentState?.protocolPositions || [];
    const liveById = new Map(livePositions.map((position) => [String(position.id), position]));
    const reconstructed = Array.from(groups.values()).map(({ key, assignment, events }) => {
        events.sort((left, right) => String(left.timestamp || "").localeCompare(String(right.timestamp || "")));
        const live = liveById.get(String(key));
        const status = live ? "open" : assignment.metadata?.status === "closed" ? "closed" : "unresolved";
        const depositsUsd = events.reduce((sum, event) => sum + Number(event.nativeDepositUsd || 0) + Number(event.tokenDepositUsd || 0), 0);
        const returnedUsd = events.reduce((sum, event) => sum + Number(event.returnedUsd || 0), 0);
        const gasUsd = events.reduce((sum, event) => sum + Number(event.gasUsd || 0), 0);
        const valuationStatus = events.every((event) => event.valuationStatus === "valued") ? "valued" : "partial";
        const currentValueUsd = live ? Number(live.currentValueUsd || 0) : status === "closed" ? 0 : null;
        const pnlUsd = valuationStatus === "valued" && currentValueUsd != null
            ? currentValueUsd + returnedUsd - depositsUsd - gasUsd
            : null;
        return {
            positionId: `manual:${key}`,
            providerPositionId: live?.id || null,
            wallet: events[0]?.wallet || "",
            walletTag: live?.walletTag || null,
            pair: live?.assets?.map((asset) => asset.symbol).join(" / ") || assignment.label || pairForEvents(events),
            openedAt: events[0]?.timestamp || null,
            closedAt: status === "closed" ? events[events.length - 1]?.timestamp || null : null,
            status,
            matchConfidence: "manual",
            valuationStatus,
            depositsUsd,
            returnedUsd,
            gasUsd,
            currentValueUsd,
            pnlUsd,
            returnPercent: pnlUsd == null || depositsUsd <= 0 ? null : pnlUsd / depositsUsd * 100,
            events,
            manual: true,
        };
    });

    const exactPositions = data.lpLifecycle?.positions || [];
    const classifiedData = {
        ...data,
        lpLifecycle: {
            ...(data.lpLifecycle || {}),
            positions: [...exactPositions, ...reconstructed],
        },
    };
    const lpStrategies = buildRobinhoodLpStrategies(classifiedData);
    const knownLpPnl = lpStrategies.filter((item) => item.pnlUsd != null).map((item) => Number(item.pnlUsd));
    const incompleteLpStrategies = lpStrategies.filter((item) => item.accountingStatus !== "tracked");
    const tokenPnlUsd = Number(data.summary?.totalPnlUsd || 0);
    const knownLpPnlUsd = knownLpPnl.reduce((sum, value) => sum + value, 0);
    const tokenPnlComplete = data.summary?.partial !== true;
    const completeness = !tokenPnlComplete || stillUnmatched.length || incompleteLpStrategies.length ? "partial" : "complete";

    return {
        ...data,
        manualClassifications: assignments,
        portfolioPnl: {
            tokenPnlUsd,
            lpPnlUsd: completeness === "complete" ? knownLpPnlUsd : null,
            totalPnlUsd: completeness === "complete" ? tokenPnlUsd + knownLpPnlUsd : null,
            knownLpPnlUsd,
            knownTotalPnlUsd: tokenPnlComplete ? tokenPnlUsd + knownLpPnlUsd : null,
            completeness,
            tokenPnlComplete,
            unassignedOperationCount: stillUnmatched.length,
            valuedLpLifecycleCount: knownLpPnl.length,
            incompleteLpStrategyCount: incompleteLpStrategies.length,
        },
        lpStrategies,
        lpLifecycle: {
            ...(data.lpLifecycle || {}),
            positions: [...exactPositions, ...reconstructed],
            unmatchedMovements: stillUnmatched,
            classifiedActivities,
        },
    };
};

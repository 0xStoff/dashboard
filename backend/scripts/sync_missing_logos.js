import dotenv from "dotenv";
import sequelize from "../sequelize.js";
import EvmChains from "../models/EvmChainsModel.js";
import TokenModel from "../models/TokenModel.js";
import WalletModel from "../models/WalletModel.js";
import fetchDebankData from "../utils/debank_api.js";
import {downloadLogo} from "../utils/download_logo.js";

dotenv.config();

const ACTIVE_CHAIN_IDS = ["hood", "monad", "hyper"];

const syncActiveChains = async () => {
    const chains = await fetchDebankData("/chain/list");

    for (const chainId of ACTIVE_CHAIN_IDS) {
        const chain = chains.find((item) => item.id === chainId);
        if (!chain) {
            throw new Error(`${chainId} chain metadata was not returned by DeBank`);
        }

        const logoPath = await downloadLogo(chain.logo_url, chain.id);
        await EvmChains.upsert({
            chain_id: chain.id,
            name: chain.name,
            native_token_id: chain.native_token_id,
            wrapped_token_id: chain.wrapped_token_id,
            logo_path: logoPath,
        }, {
            conflictFields: ["chain_id"],
        });
    }
};

const syncTokenLogos = async () => {
    const wallets = await WalletModel.findAll({
        where: {chain: "evm"},
        attributes: ["wallet"],
        order: [["id", "ASC"]],
    });

    let updated = 0;
    for (const wallet of wallets) {
        const tokens = await fetchDebankData("/user/all_token_list", {
            id: wallet.wallet,
            is_all: false,
        });

        for (const token of tokens) {
            if (!token.logo_url) continue;

            const dbToken = await TokenModel.findOne({
                where: {chain_id: token.chain, symbol: token.symbol},
            });
            if (!dbToken) continue;

            const logoPath = await downloadLogo(token.logo_url, token.id);
            if (logoPath && dbToken.logo_path !== logoPath) {
                dbToken.logo_path = logoPath;
                await dbToken.save();
                updated += 1;
            }
        }
    }

    return updated;
};

try {
    await syncActiveChains();
    const updatedTokens = await syncTokenLogos();
    console.log(`${ACTIVE_CHAIN_IDS.join(", ")} chains synced; ${updatedTokens} token logo paths updated`);
} catch (error) {
    console.error("Failed to sync chain and token logos:", error);
    process.exitCode = 1;
} finally {
    await sequelize.close();
}

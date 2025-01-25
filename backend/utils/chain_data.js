import {downloadLogo} from "./download_logo.js";
import EvmChains from "../models/EvmChainsModel.js";
import NonEvmChains from "../models/NonEvmChainsModel.js";

const insertOrUpdateChain = async (model, data) => {
    try {
        await model.upsert(data, {
            conflictFields: ['chain_id'], returning: true,
        });
    } catch (error) {
        console.error('Error during upsert:', error);
        throw new Error('Failed to upsert data');
    }
};

const updateChainData = async (chains, model) => {
    try {
        const updatePromises = chains.map(async (chain) => {
            const {id, name, native_token_id, wrapped_token_id, symbol, decimals, endpoint, logo_url} = chain;
            const logo_path = await downloadLogo(logo_url, id);

            const data = model.name === 'evm_chains' ? {
                chain_id: id,
                name,
                native_token_id,
                wrapped_token_id,
                logo_path,
            } : {
                chain_id: id,
                name,
                symbol,
                decimals,
                endpoint,
                logo_path,
            };

            await insertOrUpdateChain(model, data);
        });

        await Promise.all(updatePromises);
        console.log(`${model.name} data updated successfully`);
    } catch (error) {
        console.error(`Error updating ${model.name}:`, error);
        throw new Error(`Failed to update ${model.name}`);
    }
};

export const updateChainsData = (chains) => updateChainData(chains, EvmChains);
export const updateNonEvmChainsData = (chains) => updateChainData(chains, NonEvmChains);
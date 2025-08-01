import { Context } from '@/shared';
import { Plugin } from '@/shared/plugin';
import airdropFungibleToken, {
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-hts-plugin/tools/fungible-token/airdrop-fungible-token';
import createFungibleTokenTool, {
  CREATE_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-hts-plugin/tools/fungible-token/create-fungible-token';
import mintFungibleTokenTool, {
  MINT_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-hts-plugin/tools/fungible-token/mint-fungible-token';
import createNonFungibleTokenTool, {
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-hts-plugin/tools/non-fungible-token/create-non-fungible-token';
import mintNonFungibleTokenTool, {
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-hts-plugin/tools/non-fungible-token/mint-non-fungible-token';

export const coreHTSPlugin: Plugin = {
  name: 'core-hts-plugin',
  version: '1.0.0',
  description: 'A plugin for the Hedera Transaction Service',
  tools: (context: Context) => {
    return [
      createFungibleTokenTool(context),
      mintFungibleTokenTool(context),
      createNonFungibleTokenTool(context),
      airdropFungibleToken(context),
      mintNonFungibleTokenTool(context),
    ];
  },
};

// Export tool names as an object for destructuring
export const coreHTSPluginToolNames = {
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
  CREATE_FUNGIBLE_TOKEN_TOOL,
  MINT_FUNGIBLE_TOKEN_TOOL,
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
} as const;

export default { coreHTSPlugin, coreHTSPluginToolNames };

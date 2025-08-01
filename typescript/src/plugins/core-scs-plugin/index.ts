import { Context } from '@/shared';
import { Plugin } from '@/shared/plugin';
import transferERC721Tool, {
  TRANSFER_ERC721_TOOL,
} from '@/plugins/core-scs-plugin/tools/erc721/transfer-erc721';

export const coreSCSPlugin: Plugin = {
  name: 'core-scs-plugin',
  version: '1.0.0',
  description: 'A plugin for the Hedera Smart Contract Service',
  tools: (context: Context) => {
    return [
      transferERC721Tool(context),
    ];
  },
};

// Export tool names as an object for destructuring
export const coreSCSPluginToolNames = {
  TRANSFER_ERC721_TOOL,
} as const;

export default { coreSCSPlugin, coreSCSPluginToolNames };

import { Context } from '@/shared';
import { Plugin } from '@/shared/plugin';
import transferERC20Tool, {
  TRANSFER_ERC20_TOOL,
} from '@/plugins/core-scs-plugin/tools/erc20/transfer-erc20';

export const coreSCSPlugin: Plugin = {
  name: 'core-scs-plugin',
  version: '1.0.0',
  description: 'A plugin for the Hedera Smart Contract Service',
  tools: (context: Context) => {
    return [
      transferERC20Tool(context),
    ];
  },
};

// Export tool names as an object for destructuring
export const coreSCSPluginToolNames = {
  TRANSFER_ERC20_TOOL,
} as const;

export default { coreSCSPlugin, coreSCSPluginToolNames };

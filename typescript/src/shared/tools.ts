import { z } from 'zod';
import { Client } from '@hashgraph/sdk';
import { Context } from './configuration';
import createNonFungibleTokenTool, {
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
} from './tools/non-fungible-token/create-non-fungible-token';
import createFungibleTokenTool, {
  CREATE_FUNGIBLE_TOKEN_TOOL,
} from './tools/fungible-token/create-fungible-token';
import transferHbarTool, { TRANSFER_HBAR_TOOL } from './tools/account/transfer-hbar';
import airdropFungibleToken, {
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
} from './tools/fungible-token/airdrop-fungible-token';
import submitTopicMessageTool, {
  SUBMIT_TOPIC_MESSAGE_TOOL,
} from './tools/consensus/submit-topic-message';
import getHbarBalanceQuery, {
  GET_HBAR_BALANCE_QUERY_TOOL,
} from './tools/queries/get-hbar-balance-query';
import getAccountTokenBalancesQuery, {
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
} from './tools/queries/get-account-token-balances-query';
import getAccountQuery, { GET_ACCOUNT_QUERY_TOOL } from './tools/queries/get-account-query';
import getTopicMessagesQuery, {
  GET_TOPIC_MESSAGES_QUERY_TOOL,
} from './tools/queries/get-topic-messages-query';
import createTopicTool, { CREATE_TOPIC_TOOL } from './tools/consensus/create-topic';
import transferERC20Tool, { TRANSFER_ERC20_TOOL } from './tools/erc20/transfer-erc20';

export type Tool = {
  method: string;
  name: string;
  description: string;
  parameters: z.ZodObject<any, any>;
  execute: (client: Client, context: Context, params: any) => Promise<any>;
};

const tools = (context: Context): Tool[] => [
  createFungibleTokenTool(context),
  createNonFungibleTokenTool(context),
  transferHbarTool(context),
  airdropFungibleToken(context),
  createTopicTool(context),
  submitTopicMessageTool(context),
  getHbarBalanceQuery(context),
  getAccountQuery(context),
  getAccountTokenBalancesQuery(context),
  getTopicMessagesQuery(context),
  transferERC20Tool(context),
];

export const hederaTools = {
  CREATE_FUNGIBLE_TOKEN_TOOL,
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  TRANSFER_HBAR_TOOL,
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
  CREATE_TOPIC_TOOL,
  SUBMIT_TOPIC_MESSAGE_TOOL,
  GET_HBAR_BALANCE_QUERY_TOOL,
  GET_ACCOUNT_QUERY_TOOL,
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
  GET_TOPIC_MESSAGES_QUERY_TOOL,
  TRANSFER_ERC20_TOOL,
};

export default tools;

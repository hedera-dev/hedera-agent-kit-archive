import { Tool } from "@langchain/core/tools";
import HederaAgentKit from "../agent";
import * as dotenv from "dotenv";
import { HederaGetBalanceTool } from "./tools/hbar/get_hbar_balance_tool";
import { HederaCreateTopicTool } from "./tools/hcs/create_topic_tool";
import { HederaGetTopicInfoTool } from "./tools/hcs/get_topic_info_tool";
import { HederaDeleteTopicTool } from "./tools/hcs/delete_topic_tool";
import { HederaGetTopicMessagesTool } from "./tools/hcs/get_topic_messages_tool";
import { HederaSubmitTopicMessageTool } from "./tools/hcs/submit_topic_message_tool";
import { HederaAirdropTokenTool } from "./tools/hts/airdrop_token_tool";
import { HederaAssociateTokenTool } from "./tools/hts/associate_token_tool";
import { HederaClaimAirdropTool } from "./tools/hts/claim_airdrop_tool";
import { HederaCreateFungibleTokenTool } from "./tools/hts/create_fungible_token_tool";
import { HederaCreateNonFungibleTokenTool } from "./tools/hts/create_non_fungible_token_tool";
import { HederaGetAllTokenBalancesTool } from "./tools/hts/get_all_token_balances_tool";
import { HederaGetHtsBalanceTool } from "./tools/hts/get_hts_balance_tool";
import { HederaGetPendingAirdropTool } from "./tools/hts/get_pending_airdrop_tool";
import { HederaGetTokenHoldersTool } from "./tools/hts/get_token_holders_tool";
import { HederaMintFungibleTokenTool } from "./tools/hts/mint_fungible_token_tool";
import { HederaMintNFTTool } from "./tools/hts/mint_non_fungible_token_tool";
import { HederaRejectTokenTool } from "./tools/hts/reject_token_tool";
import { HederaTransferHbarTool } from "./tools/hbar/transfer_native_hbar_token_tool";
import { HederaTransferTokenTool } from "./tools/hts/transfer_token_tool";
import { HederaDissociateTokenTool } from "./tools/hts/dissociate_token_tool";

dotenv.config();

export function createHederaTools(hederaKit: HederaAgentKit): Tool[] {

  return [
    new HederaGetBalanceTool(hederaKit),
    new HederaCreateTopicTool(hederaKit),
    new HederaDeleteTopicTool(hederaKit),
    new HederaGetTopicInfoTool(hederaKit),
    new HederaGetTopicMessagesTool(hederaKit),
    new HederaSubmitTopicMessageTool(hederaKit),
    new HederaAirdropTokenTool(hederaKit),
    new HederaAssociateTokenTool(hederaKit),
    new HederaClaimAirdropTool(hederaKit),
    new HederaCreateFungibleTokenTool(hederaKit),
    new HederaCreateNonFungibleTokenTool(hederaKit),
    new HederaDissociateTokenTool(hederaKit),
    new HederaGetAllTokenBalancesTool(hederaKit),
    new HederaGetHtsBalanceTool(hederaKit),
    new HederaGetPendingAirdropTool(hederaKit),
    new HederaGetTokenHoldersTool(hederaKit),
    new HederaMintFungibleTokenTool(hederaKit),
    new HederaMintNFTTool(hederaKit),
    new HederaRejectTokenTool(hederaKit),
    new HederaTransferHbarTool(hederaKit),
    new HederaTransferTokenTool(hederaKit),
  ]
}
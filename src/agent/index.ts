import { Client, TokenId, AccountId, PendingAirdropId, TopicId, TokenType, ContractId } from "@hashgraph/sdk";
import { ethers } from "ethers";
import {
  create_token,
  transfer_token,
  airdrop_token,
  get_hbar_balance,
  get_hts_balance,
  get_hts_token_details,
  get_all_tokens_balances,
  get_token_holders,
  get_pending_airdrops,
  associate_token,
  reject_token,
  create_topic,
  delete_topic,
  submit_topic_message,
  claim_airdrop,
  dissociate_token,
  mint_token,
  approve_asset_allowance,
  transfer_hbar,
  get_topic_info,
  get_topic_messages,
  mint_nft
} from "../tools";
import {
  Airdrop,
  AirdropResult,
  AssociateTokenResult,
  ClaimAirdropResult,
  CreateTokenResult,
  HederaNetworkType,
  HtsTokenDetails,
  RejectTokenResult,
  TokenBalance,
  TransferHBARResult,
  TransferTokenResult,
  TopicInfoApiResponse,
  SubmitMessageResult,
  DissociateTokenResult,
  CreateTopicResult,
  MintTokenResult,
  HCSMessage,
  DeleteTopicResult,
  AssetAllowanceResult,
  CreateNFTOptions,
  CreateFTOptions,
  MintNFTResult,
  SwapExactTokensParams,
  AddLiquidityParams,
  RemoveLiquidityParams,
  ApiLiquidityPoolV2,
  ApiNftPositionV2,
  QuoteResult,
  SwapResult,
  LiquidityResult
} from "../types";
import { AirdropRecipient } from "../tools/hts/transactions/airdrop";
import {
  get_pools,
  get_user_positions,
  get_swap_quote,
  swap_exact_tokens,
  add_liquidity,
  remove_liquidity
} from "../tools/saucerswap";
import {
  SAUCERSWAP_CONTRACTS,
  SAUCERSWAP_ABIS,
  createSaucerSwapProvider
} from "../tools/saucerswap";


export default class HederaAgentKit {

  public client: Client

  constructor(
    accountId: string,
    privateKey: string,
    network: 'mainnet' | 'testnet' | 'previewnet' = 'mainnet'
  ) {
    // @ts-ignore
    this.client = Client.forNetwork(network).setOperator(accountId, privateKey)
  }

  async createFT(options: CreateFTOptions): Promise<CreateTokenResult> {
    return create_token({
      ...options,
      tokenType: TokenType.FungibleCommon,
      client: this.client,
    });
  }

  async createNFT(options: CreateNFTOptions): Promise<CreateTokenResult> {
    return create_token({
      ...options,
      decimals: 0,
      initialSupply: 0,
      isSupplyKey: true,
      tokenType: TokenType.NonFungibleUnique,
      client: this.client,
    });
  }

  async transferToken(
    tokenId: TokenId,
    toAccountId: string | AccountId,
    amount: number
  ): Promise<TransferTokenResult> {
    return transfer_token(
      tokenId,
      toAccountId,
      amount,
      this.client
    )
  }

  async getHbarBalance(accountId?: string): Promise<number> {
    const targetAccountId = accountId || this.client.operatorAccountId;
    return get_hbar_balance(this.client, targetAccountId);
  }

  async getHtsBalance(
      tokenId: string,
      networkType: HederaNetworkType,
      accountId?: string
  ): Promise<number> {
    const targetAccountId = accountId || this.client.operatorAccountId;
    return get_hts_balance(tokenId, networkType, targetAccountId as string);
  }

  async getAllTokensBalances(
      networkType: HederaNetworkType,
      accountId?: string
  ) {
    const targetAccountId = accountId || this.client.operatorAccountId;
    return get_all_tokens_balances(networkType, targetAccountId as string);
  }

  async getHtsTokenDetails(
      tokenId: string,
      networkType: HederaNetworkType
  ): Promise<HtsTokenDetails> {
    return get_hts_token_details(tokenId, networkType);
  }

  async getTokenHolders(
      tokenId: string | TokenId,
      networkType: HederaNetworkType,
      threshold?: number,
  ): Promise<Array<TokenBalance>> {
    return get_token_holders(tokenId.toString(), networkType, threshold);
  }

  async associateToken(
      tokenId: TokenId
  ): Promise<AssociateTokenResult> {
    return associate_token(tokenId, this.client);
  }

  async dissociateToken(
      tokenId: TokenId
  ): Promise <DissociateTokenResult> {
    return dissociate_token(tokenId, this.client);
  }

  async airdropToken(
    tokenId: TokenId,
    recipients: AirdropRecipient[]
  ): Promise<AirdropResult> {
    return airdrop_token(
      tokenId,
      recipients,
      this.client
    )
  }

  async rejectToken(
      tokenId: TokenId,
  ): Promise<RejectTokenResult> {
    return reject_token(
        tokenId,
        this.client
    );
  }

  async mintToken(
      tokenId: TokenId,
      amount: number
  ): Promise<MintTokenResult> {
    return mint_token(
        tokenId,
        amount,
        this.client
    );
  }

  async mintNFTToken(
      tokenId: TokenId,
      tokenMetadata: Uint8Array<ArrayBufferLike>
  ): Promise<MintNFTResult> {
    return mint_nft(
        tokenId,
        tokenMetadata,
        this.client
    )
  }

  async transferHbar(
      toAccountId: string | AccountId,
      amount: string
  ): Promise<TransferHBARResult> {
    return transfer_hbar(
        this.client,
        toAccountId,
        amount,
    )
  }

  async claimAirdrop(
      airdropId: PendingAirdropId
  ): Promise<ClaimAirdropResult> {
    return claim_airdrop(this.client, airdropId)
  }

  async getPendingAirdrops(
      accountId: string,
      networkType: HederaNetworkType
  ): Promise<Airdrop[]> {
    return get_pending_airdrops(networkType, accountId)
  }

  async createTopic(
      topicMemo: string,
      isSubmitKey: boolean,
  ): Promise<CreateTopicResult> {
    return create_topic(topicMemo, this.client, isSubmitKey);
  }

  async deleteTopic(
      topicId: TopicId
  ): Promise<DeleteTopicResult> {
    return delete_topic(topicId, this.client)
  }

  async getTopicInfo(
      topicId: TopicId,
      networkType: HederaNetworkType,
  ): Promise<TopicInfoApiResponse> {
    return get_topic_info(topicId, networkType)
  }

  async submitTopicMessage(
      topicId: TopicId,
      message: string,
  ): Promise<SubmitMessageResult> {
    return submit_topic_message(topicId, message, this.client)
  }

  async getTopicMessages(
      topicId: TopicId,
      networkType: HederaNetworkType,
      lowerTimestamp?: number,
      upperTimestamp?: number,
  ): Promise<Array<HCSMessage>> {
    return get_topic_messages(topicId, networkType, lowerTimestamp, upperTimestamp);
  }

  async approveAssetAllowance(
      spenderAccount: AccountId,
      amount: number,
      tokenId?: TokenId,
  ): Promise<AssetAllowanceResult> {
    return approve_asset_allowance(spenderAccount, tokenId, amount, this.client);
  }

  // SaucerSwap Methods
  async getSaucerSwapPools(networkType: 'mainnet' | 'testnet' = 'mainnet'): Promise<ApiLiquidityPoolV2[]> {
    return get_pools(networkType);
  }

  async getSaucerSwapPositions(accountId: string, networkType: 'mainnet' | 'testnet' = 'mainnet'): Promise<ApiNftPositionV2[]> {
    return get_user_positions(accountId, networkType);
  }

  async getSwapQuote(
    jsonRpcUrl: string,
    path: string[],
    amount: string,
    isExactInput: boolean = true,
    networkType: 'mainnet' | 'testnet' = 'mainnet'
  ): Promise<QuoteResult> {
    const provider = createSaucerSwapProvider(jsonRpcUrl);
    const quoterContractId = ContractId.fromString(SAUCERSWAP_CONTRACTS[networkType].quoter);
    return get_swap_quote(
      provider,
      quoterContractId,
      SAUCERSWAP_ABIS.quoter,
      path,
      amount,
      isExactInput
    );
  }

  async swapExactTokens(params: SwapExactTokensParams): Promise<SwapResult> {
    return swap_exact_tokens(params);
  }

  async addLiquidity(params: AddLiquidityParams): Promise<LiquidityResult> {
    return add_liquidity(params);
  }

  async removeLiquidity(params: RemoveLiquidityParams): Promise<LiquidityResult> {
    return remove_liquidity(params);
  }
}

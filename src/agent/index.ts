import {
    AccountId,
    Client,
    PendingAirdropId,
    PublicKey,
    TokenId,
    TokenType,
    TopicId,
} from "@hashgraph/sdk";
import {
    Airdrop,
    CreateFTOptions,
    CreateNFTOptions,
    ExecutorAccountDetails,
    HCSMessage,
    HederaNetworkType,
    HtsTokenDetails,
    TokenBalance,
    TopicInfoApiResponse,
} from "../types";
import {
    AccountTransactionBuilder,
    AirdropRecipient,
    AirdropResult,
    AssetAllowanceResult,
    AssociateTokenResult,
    BaseResult,
    ClaimAirdropResult,
    CreateTokenResult,
    CreateTopicResult,
    CustodialAirdropTokenResult,
    CustodialAssociateTokenResult,
    CustodialAssetAllowanceResult,
    CustodialClaimAirdropResult,
    CustodialCreateTokenResult,
    CustodialCreateTopicResult,
    CustodialDeleteTopicResult,
    CustodialDissociateTokenResult,
    CustodialMintNFTResult,
    CustodialMintTokenResult,
    CustodialRejectTokenResult,
    CustodialSubmitMessageResult,
    CustodialTransferHbarResult,
    CustodialTransferTokenResult,
    DeleteTopicResult,
    DissociateTokenResult,
    get_all_tokens_balances,
    get_hbar_balance,
    get_hts_balance,
    get_hts_token_details,
    get_pending_airdrops,
    get_token_holders,
    get_topic_info,
    get_topic_messages,
    HbarTransactionBuilder,
    HcsTransactionBuilder,
    HtsTransactionBuilder,
    MintTokenResult,
    NonCustodialAirdropTokenResult,
    NonCustodialAssociateTokenResult,
    NonCustodialAssetAllowanceResult,
    NonCustodialClaimAirdropResult,
    NonCustodialCreateTokenResult,
    NonCustodialCreateTopicResult,
    NonCustodialDeleteTopicResult,
    NonCustodialDissociateTokenResult,
    NonCustodialMintNFTResult,
    NonCustodialMintTokenResult,
    NonCustodialRejectTokenResult,
    NonCustodialSubmitMessageResult,
    NonCustodialTransferHbarResult,
    NonCustodialTransferTokenResult,
    RejectTokenResult,
    SubmitMessageResult,
    TransferHBARResult,
    TransferTokenResult,
} from "../tools";

export class HederaAgentKit {
    public client: Client
    readonly network: 'mainnet' | 'testnet' | 'previewnet' = 'mainnet'
    private readonly privateKey: string | undefined;
    readonly accountId: string;
    private readonly isCustodial: boolean;

    constructor(
        accountId: string,
        privateKey?: string,
        network: 'mainnet' | 'testnet' | 'previewnet' = 'mainnet',
    ) {
        if(privateKey){
            // @ts-ignore
            this.client = Client.forNetwork(network).setOperator(accountId, privateKey);
            this.privateKey = privateKey;
            this.isCustodial = true;
        } else {
            // @ts-ignore
            this.client = Client.forNetwork(network);
            this.isCustodial = false;
        }
        this.network = network;
        this.accountId = accountId;
    }

    private isClient(x: any): x is Client {
        return typeof x.setOperator === 'function';
    }

    async createTopic(
        topicMemo: string,
        isSubmitKey: boolean,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails
    ): Promise<BaseResult<string> | BaseResult<CreateTopicResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.createTopicCustodial(topicMemo, isSubmitKey);
        }

        return this.createTopicNonCustodial(topicMemo, isSubmitKey, executorAccountDetails?.executorPublicKey, executorAccountDetails?.executorAccountId);
    }

    private async createTopicCustodial(
        topicMemo: string,
        isSubmitKey: boolean,
    ) : Promise<CustodialCreateTopicResult> {
        if(!this.privateKey) throw new Error("Custodial actions require privateKey!");

        const response: CreateTopicResult =  await HcsTransactionBuilder
            .createTopic(topicMemo, this.client.operatorPublicKey!, isSubmitKey)
            .signAndExecute(this.client);

        return new CustodialCreateTopicResult(response.topicId, response.txHash, response.status)
    }

    private async createTopicNonCustodial(
        topicMemo: string,
        isSubmitKey: boolean,
        executorPublicKey?: string | undefined,
        executorAccountId?: string | undefined,
    ) : Promise<NonCustodialCreateTopicResult> {
        if(executorPublicKey === undefined) throw new Error("Executor public key is missing in non custodial action call!");
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        console.log("Executor public key: " + executorPublicKey);
        const txBytes =  await HcsTransactionBuilder
            .createTopic(topicMemo, PublicKey.fromString(executorPublicKey as string), isSubmitKey)
            .getTxBytesString(this.client, executorAccountId);

        return new NonCustodialCreateTopicResult(txBytes);
    }


    async submitTopicMessage(
        topicId: TopicId,
        message: string,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails
    ): Promise<BaseResult<string> | BaseResult<SubmitMessageResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.submitTopicMessageCustodial(topicId, message);
        }

        return this.submitTopicMessageNonCustodial(topicId, message, executorAccountDetails?.executorAccountId);
    }

    private async submitTopicMessageCustodial(
        topicId: TopicId,
        message: string,
    ): Promise<CustodialSubmitMessageResult> {
        if(!this.privateKey) throw new Error("Custodial actions require privateKey!");

        const response: SubmitMessageResult =  await HcsTransactionBuilder
            .submitTopicMessage(topicId, message)
            .signAndExecute(this.client);

        return new CustodialSubmitMessageResult(response.txHash, response.status, response.topicId);
    }

    private async submitTopicMessageNonCustodial(
        topicId: TopicId,
        message: string,
        executorAccountId?: string | undefined,
    ): Promise<NonCustodialSubmitMessageResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await HcsTransactionBuilder
            .submitTopicMessage(topicId, message)
            .getTxBytesString(this.client, executorAccountId);

        return new NonCustodialSubmitMessageResult(txBytes);
    }

    async transferHbar(
        toAccountId: string | AccountId,
        amount: string,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails
    ): Promise<BaseResult<string> | BaseResult<TransferHBARResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.transferHbarCustodial(toAccountId, amount);
        }

        return this.transferHbarNonCustodial(toAccountId, amount, executorAccountDetails?.executorAccountId);
    }

    private async transferHbarCustodial(
        toAccountId: string | AccountId,
        amount: string,
    ): Promise<CustodialTransferHbarResult> {
        if(!this.privateKey) throw new Error("Custodial actions require privateKey!");

        const response = await HbarTransactionBuilder
            .transferHbar(this.client.operatorAccountId!, toAccountId, amount)
            .signAndExecute(this.client);

        return new CustodialTransferHbarResult(response.txHash, response.status);
    }

    private async transferHbarNonCustodial(
        toAccountId: string | AccountId,
        amount: string,
        executorAccountId: string | undefined,
    ): Promise<NonCustodialTransferHbarResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await HbarTransactionBuilder
            .transferHbar(executorAccountId, toAccountId, amount)
            .getTxBytesString(this.client, executorAccountId);

        return new NonCustodialTransferHbarResult(txBytes);
    }


    async createFT(
        options: CreateFTOptions,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails,
    ): Promise<BaseResult<string> | BaseResult<CreateTokenResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.createFTCustodial(options);
        }

        return this.createFTNonCustodial(
          options,
          executorAccountDetails?.executorPublicKey,
          executorAccountDetails?.executorAccountId
        );
    }

    private async createFTCustodial(options: CreateFTOptions): Promise<CustodialCreateTokenResult> {
        if(!this.privateKey) throw new Error("Custodial actions require privateKey!");
        const response: CreateTokenResult = await HtsTransactionBuilder.createToken(
            {
                ...options,
                tokenType: TokenType.FungibleCommon,
                client: this.client,
            },
            this.client.operatorPublicKey!,
            this.client.operatorAccountId!,
        ).signAndExecute(this.client);

        return new CustodialCreateTokenResult(response.txHash, response.status, response.tokenId);
    }

    private async createFTNonCustodial(
      options: CreateFTOptions,
      executorPublicKey?: string | undefined,
      executorAccountId?: string | undefined,
    ): Promise<NonCustodialCreateTokenResult> {
        if(executorPublicKey === undefined) throw new Error("Executor public key is missing in non custodial action call!");
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await HtsTransactionBuilder.createToken(
            {
                ...options,
                tokenType: TokenType.FungibleCommon,
                client: this.client,
            },
          PublicKey.fromString(executorPublicKey),
          executorAccountId
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialCreateTokenResult(txBytes);
    }


    async createNFT(
        options: CreateNFTOptions,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails,
    ): Promise<BaseResult<string> | BaseResult<CreateTokenResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.createNFTCustodial(options);
        }

        return this.createNFTNonCustodial(
          options,
          executorAccountDetails?.executorPublicKey,
          executorAccountDetails?.executorAccountId
        );
    }

    private async createNFTCustodial(options: CreateNFTOptions): Promise<CustodialCreateTokenResult> {
        if(!this.privateKey) throw new Error("Custodial actions require privateKey!");
        const response: CreateTokenResult = await HtsTransactionBuilder.createToken(
            {
                ...options,
                decimals: 0,
                initialSupply: 0,
                isSupplyKey: true,
                tokenType: TokenType.NonFungibleUnique,
                client: this.client,
            },
            this.client.operatorPublicKey!,
            this.client.operatorAccountId!,
        ).signAndExecute(this.client);

        return new CustodialCreateTokenResult(response.txHash, response.status, response.tokenId);
    }

    private async createNFTNonCustodial(
      options: CreateNFTOptions,
      executorPublicKey?: string | undefined,
      executorAccountId?: string | undefined,
    ): Promise<NonCustodialCreateTokenResult> {
        if(executorPublicKey === undefined) throw new Error("Executor public key is missing in non custodial action call!");
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");
        const txBytes = await HtsTransactionBuilder.createToken(
            {
                ...options,
                decimals: 0,
                initialSupply: 0,
                isSupplyKey: true,
                tokenType: TokenType.NonFungibleUnique,
                client: this.client,
            },
            PublicKey.fromString(executorPublicKey),
            executorAccountId,
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialCreateTokenResult(txBytes);
    }


    async transferToken(
        tokenId: TokenId,
        toAccountId: string | AccountId,
        amount: number,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails,
    ): Promise<BaseResult<string> | BaseResult<TransferTokenResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.transferTokenCustodial(tokenId, toAccountId, amount);
        }

        return this.transferTokenNonCustodial(
          tokenId,
          toAccountId,
          amount,
          executorAccountDetails?.executorAccountId
        );
    }

    private async transferTokenCustodial(
        tokenId: TokenId,
        toAccountId: string | AccountId,
        amount: number
    ): Promise<CustodialTransferTokenResult> {
        const response: TransferTokenResult = await HtsTransactionBuilder.transferToken(
            tokenId,
            amount,
            toAccountId,
            this.accountId
        ).signAndExecute(this.client);

        return new CustodialTransferTokenResult(response.txHash, response.status);
    }

    private async transferTokenNonCustodial(
        tokenId: TokenId,
        toAccountId: string | AccountId,
        amount: number,
        executorAccountId: string | undefined,
    ): Promise<NonCustodialTransferTokenResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await HtsTransactionBuilder.transferToken(
            tokenId,
            amount,
            toAccountId,
            executorAccountId
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialTransferTokenResult(txBytes);
    }


    async getHbarBalance(
      accountId?: string,
      isCustodial?: boolean,
      executorAccountDetails?: ExecutorAccountDetails,
    ): Promise<number> {
        const useCustodial = isCustodial ?? this.isCustodial;
        if (!useCustodial && !executorAccountDetails?.executorAccountId) {
            throw new Error(
                "Executor account id is required for non-custodial actions"
            );
        }

        // Pick the right fallback based on custodial vs non‑custodial
        // fallback accountId will be used if no specific account id is passed
        const fallbackAccountId = useCustodial
          ? this.client.operatorAccountId!.toString()
          : executorAccountDetails!.executorAccountId!;

        const targetAccountId = accountId ?? fallbackAccountId;
        return get_hbar_balance(this.client, targetAccountId);
    }



    async getHtsBalance(
        tokenId: string,
        networkType: HederaNetworkType,
        accountId?: string,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails,
    ): Promise<number> {
        const useCustodial = custodial ?? this.isCustodial;
        if (!useCustodial && !executorAccountDetails?.executorAccountId) {
            throw new Error(
              "Executor account id is required for non-custodial actions"
            );
        }

        // Pick the right fallback based on custodial vs non‑custodial
        // fallback accountId will be used if no specific account id is passed
        const fallbackAccountId = useCustodial
          ? this.client.operatorAccountId!.toString()
          : executorAccountDetails!.executorAccountId!;

        const targetAccountId = accountId ?? fallbackAccountId;
        return get_hts_balance(tokenId, networkType, targetAccountId);
    }


    async getAllTokensBalances(
      networkType: HederaNetworkType,
      accountId?: string,
      custodial?: boolean,
      executorAccountDetails?: ExecutorAccountDetails,
    ) {
        const useCustodial = custodial ?? this.isCustodial;
        if (!useCustodial && !executorAccountDetails?.executorAccountId) {
            throw new Error(
              "Executor account id is required for non-custodial actions"
            );
        }

        // Pick the right fallback based on custodial vs non‑custodial
        // fallback accountId will be used if no specific account id is passed
        const fallbackAccountId = useCustodial
          ? this.client.operatorAccountId!.toString()
          : executorAccountDetails!.executorAccountId!;

        const targetAccountId = accountId ?? fallbackAccountId;
        return get_all_tokens_balances(networkType, targetAccountId);
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
        tokenId: TokenId,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails,
    ): Promise<BaseResult<string> | BaseResult<AssociateTokenResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.associateTokenCustodial(tokenId);
        }

        return this.associateTokenNonCustodial(tokenId, executorAccountDetails?.executorAccountId);
    }

    private async associateTokenCustodial(
        tokenId: TokenId
    ): Promise<CustodialAssociateTokenResult> {
        const response: AirdropResult = await HtsTransactionBuilder.associateToken(
            tokenId,
            this.accountId
        ).signAndExecute(this.client);

        return new CustodialAssociateTokenResult(response.txHash, response.status);
    }

    private async associateTokenNonCustodial(
        tokenId: TokenId,
        executorAccountId: string | undefined,
    ): Promise<NonCustodialAssociateTokenResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await HtsTransactionBuilder.associateToken(
          tokenId,
          executorAccountId
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialAssociateTokenResult(txBytes);
    }


    async dissociateToken(
        tokenId: TokenId,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails
    ): Promise<BaseResult<string> | BaseResult<DissociateTokenResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.dissociateTokenCustodial(tokenId);
        }

        return this.dissociateTokenNonCustodial(tokenId, executorAccountDetails?.executorAccountId);
    }

    private async dissociateTokenCustodial(
        tokenId: TokenId
    ): Promise<CustodialDissociateTokenResult> {
        const response: DissociateTokenResult = await HtsTransactionBuilder.dissociateToken(
            tokenId,
            this.accountId
        ).signAndExecute(this.client);

        return new CustodialDissociateTokenResult(response.txHash, response.status);
    }

    private async dissociateTokenNonCustodial(
        tokenId: TokenId,
        executorAccountId: string | undefined,
    ): Promise<NonCustodialDissociateTokenResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await HtsTransactionBuilder.dissociateToken(
            tokenId,
            executorAccountId
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialDissociateTokenResult(txBytes);
    }


    async airdropToken(
        tokenId: TokenId,
        recipients: AirdropRecipient[],
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails,
    ): Promise<BaseResult<string> | BaseResult<AirdropResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.airdropTokenCustodial(tokenId, recipients);
        }

        return this.airdropTokenNonCustodial(tokenId, recipients, executorAccountDetails?.executorAccountId);
    }

    private async airdropTokenCustodial(
        tokenId: TokenId,
        recipients: AirdropRecipient[]
    ): Promise<CustodialAirdropTokenResult> {
        const response: AirdropResult = await HtsTransactionBuilder.airdropToken(
            tokenId,
            recipients,
            this.accountId
        ).signAndExecute(this.client);

        return new CustodialAirdropTokenResult(response.txHash, response.status);
    }

    private async airdropTokenNonCustodial(
        tokenId: TokenId,
        recipients: AirdropRecipient[],
        executorAccountId: string | undefined
    ): Promise<NonCustodialAirdropTokenResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await HtsTransactionBuilder.airdropToken(
            tokenId,
            recipients,
            executorAccountId
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialAirdropTokenResult(txBytes);
    }


    async rejectToken(
        tokenId: TokenId,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails,
    ): Promise<BaseResult<string> | BaseResult<RejectTokenResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.rejectTokenCustodial(tokenId);
        }

        return this.rejectTokenNonCustodial(tokenId, executorAccountDetails?.executorAccountId);
    }

    private async rejectTokenCustodial(
        tokenId: TokenId,
    ): Promise<CustodialRejectTokenResult> {
        const response: RejectTokenResult = await HtsTransactionBuilder.rejectToken(
            tokenId,
            AccountId.fromString(this.accountId)
        ).signAndExecute(this.client);

        return new CustodialRejectTokenResult(response.txHash, response.status);
    }

    private async rejectTokenNonCustodial(
        tokenId: TokenId,
        executorAccountId: string | undefined
    ): Promise<NonCustodialRejectTokenResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await HtsTransactionBuilder.rejectToken(
            tokenId,
            AccountId.fromString(executorAccountId)
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialRejectTokenResult(txBytes);
    }


    async mintToken(
        tokenId: TokenId,
        amount: number,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails,
    ): Promise<BaseResult<string> | BaseResult<MintTokenResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.mintTokenCustodial(tokenId, amount);
        }

        return this.mintTokenNonCustodial(tokenId, amount, executorAccountDetails?.executorAccountId);
    }

    private async mintTokenCustodial(
        tokenId: TokenId,
        amount: number
    ): Promise<CustodialMintTokenResult> {
        const response: MintTokenResult = await HtsTransactionBuilder.mintToken(
            tokenId,
            amount,
        ).signAndExecute(this.client);

        return new CustodialMintTokenResult(response.txHash, response.status);
    }

    private async mintTokenNonCustodial(
        tokenId: TokenId,
        amount: number,
        executorAccountId: string | undefined
    ): Promise<NonCustodialMintTokenResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await HtsTransactionBuilder.mintToken(
            tokenId,
            amount,
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialMintTokenResult(txBytes);
    }


    async mintNFTToken(
        tokenId: TokenId,
        tokenMetadata: Uint8Array,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails
    ): Promise<BaseResult<string> | BaseResult<MintTokenResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.mintNFTTokenCustodial(tokenId, tokenMetadata);
        }

        return this.mintNFTTokenNonCustodial(tokenId, tokenMetadata, executorAccountDetails?.executorAccountId);
    }

    private async mintNFTTokenCustodial(
        tokenId: TokenId,
        tokenMetadata: Uint8Array
    ): Promise<CustodialMintNFTResult> {
        const response: MintTokenResult = await HtsTransactionBuilder.mintNft(
            tokenId,
            tokenMetadata,
        ).signAndExecute(this.client);

        return new CustodialMintNFTResult(response.txHash, response.status);
    }

    private async mintNFTTokenNonCustodial(
        tokenId: TokenId,
        tokenMetadata: Uint8Array,
        executorAccountId: string | undefined
    ): Promise<NonCustodialMintNFTResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await HtsTransactionBuilder.mintNft(
            tokenId,
            tokenMetadata,
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialMintNFTResult(txBytes);
    }


    async claimAirdrop(
        airdropId: PendingAirdropId,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails,
    ): Promise<BaseResult<string> | BaseResult<ClaimAirdropResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.claimAirdropCustodial(airdropId);
        }

        return this.claimAirdropNonCustodial(airdropId, executorAccountDetails?.executorAccountId);
    }

    private async claimAirdropCustodial(
        airdropId: PendingAirdropId
    ): Promise<CustodialClaimAirdropResult> {
        const response: ClaimAirdropResult =  await HtsTransactionBuilder.claimAirdrop(
            airdropId
        ).signAndExecute(this.client);

        return new CustodialClaimAirdropResult(response.txHash, response.status);
    }

    private async claimAirdropNonCustodial(
        airdropId: PendingAirdropId,
        executorAccountId?: string | undefined
    ): Promise<NonCustodialClaimAirdropResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await HtsTransactionBuilder.claimAirdrop(
            airdropId
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialClaimAirdropResult(txBytes);
    }

    async getPendingAirdrops(
      networkType: HederaNetworkType,
      accountId?: string,
      custodial?: boolean,
      executorAccountDetails?: ExecutorAccountDetails,
    ): Promise<Airdrop[]> {
        const useCustodial = custodial ?? this.isCustodial;

        if (!useCustodial && !executorAccountDetails?.executorAccountId) {
            throw new Error(
              "Executor account id is required for non-custodial actions"
            );
        }

        // Pick the right fallback based on custodial vs non‑custodial
        // fallback accountId will be used if no specific account id is passed
        const fallbackAccountId = useCustodial
          ? this.client.operatorAccountId!.toString()
          : executorAccountDetails!.executorAccountId!;

        const targetAccountId = accountId ?? fallbackAccountId;
        return get_pending_airdrops(networkType, targetAccountId)
    }


    async deleteTopic(
        topicId: TopicId,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails
    ): Promise<BaseResult<string> | BaseResult<DeleteTopicResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.deleteTopicCustodial(topicId);
        }

        return this.deleteTopicNonCustodial(topicId, executorAccountDetails?.executorAccountId);
    }

    private async deleteTopicCustodial(
        topicId: TopicId
    ): Promise<CustodialDeleteTopicResult> {
        const response: DeleteTopicResult = await HcsTransactionBuilder.deleteTopic(
            topicId
        ).signAndExecute(this.client);

        return new CustodialDeleteTopicResult(response.txHash, response.status);
    }

    private async deleteTopicNonCustodial(
        topicId: TopicId,
        executorAccountId: string | undefined,
    ): Promise<NonCustodialDeleteTopicResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");
        const txBytes =  await HcsTransactionBuilder.deleteTopic(
            topicId
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialDeleteTopicResult(txBytes);
    }


    async getTopicInfo(
        topicId: TopicId,
        networkType: HederaNetworkType,
    ): Promise<TopicInfoApiResponse> {
        return get_topic_info(topicId, networkType)
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
        spenderAccount: AccountId | string,
        amount: number,
        tokenId?: TokenId,
        custodial?: boolean,
        executorAccountDetails?: ExecutorAccountDetails
    ): Promise<BaseResult<string> | BaseResult<AssetAllowanceResult>> {
        const useCustodial = custodial ?? this.isCustodial;

        if (useCustodial) {
            if (!this.privateKey) {
                throw new Error("Private key is missing. To perform custodial action you should pass private key!");
            }
            return this.approveAssetAllowanceCustodial(spenderAccount, amount, tokenId);
        }

        return this.approveAssetAllowanceNonCustodial(
          spenderAccount,
          amount,
          executorAccountDetails?.executorAccountId,
          tokenId,
        );
    }

    async approveAssetAllowanceCustodial(
        spenderAccount: AccountId | string,
        amount: number,
        tokenId?: TokenId,
    ): Promise<CustodialAssetAllowanceResult> {
        const response: AssetAllowanceResult = await AccountTransactionBuilder.approveAssetAllowance(
            spenderAccount,
            amount,
            this.accountId,
            tokenId
        ).signAndExecute(this.client);

        return new CustodialAssetAllowanceResult(response.txHash, response.status);
    }

    async approveAssetAllowanceNonCustodial(
      spenderAccount: AccountId | string,
      amount: number,
      executorAccountId: string | undefined,
      tokenId?: TokenId,
    ): Promise<NonCustodialAssetAllowanceResult> {
        if(executorAccountId === undefined) throw new Error("Executor account id is missing in non custodial action call!");

        const txBytes = await AccountTransactionBuilder.approveAssetAllowance(
          spenderAccount,
          amount,
          executorAccountId,
          tokenId
        ).getTxBytesString(this.client, executorAccountId);

        return new NonCustodialAssetAllowanceResult(txBytes);
    }
}

export default HederaAgentKit;
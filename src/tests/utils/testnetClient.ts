import {
  AccountCreateTransaction,
  AccountId,
  AccountUpdateTransaction,
  Client,
  Hbar,
  PrivateKey,
  TokenId,
  TopicId,
} from "@hashgraph/sdk";
import { AccountData, hederaPrivateKeyFromString } from "./testnetUtils";
import HederaAgentKit from "../../agent";
import { CreateFTOptions, CreateNFTOptions, HederaNetworkType } from "../../types";
import {
  AirdropResult,
  AssociateTokenResult,
  CreateTokenResult,
  CreateTopicResult,
  SubmitMessageResult,
  AirdropRecipient
} from "../../tools";

export class NetworkClientWrapper {
  private readonly accountId: AccountId;
  private readonly privateKey: PrivateKey;
  private readonly client: Client;
  private readonly agentKit: HederaAgentKit;

  constructor(
    accountIdString: string,
    privateKeyString: string,
    keyType: string,
    networkType: HederaNetworkType
  ) {
    this.accountId = AccountId.fromString(accountIdString);
    this.privateKey = hederaPrivateKeyFromString({
      key: privateKeyString,
      keyType,
    }).privateKey;

    this.client = Client.forTestnet();
    this.client.setOperator(this.accountId, this.privateKey);

    this.agentKit = new HederaAgentKit(
      this.accountId.toString(),
      this.privateKey.toString(),
      networkType
    );
  }

  async createAccount(
    initialHBARAmount: number = 0,
    maxAutoAssociation: number = -1 // defaults to setting max auto association to unlimited
  ): Promise<AccountData> {
    const accountPrivateKey = PrivateKey.generateECDSA();
    const accountPublicKey = accountPrivateKey.publicKey;

    const tx = new AccountCreateTransaction()
      .setKey(accountPublicKey)
      .setInitialBalance(new Hbar(initialHBARAmount))
      .setMaxAutomaticTokenAssociations(maxAutoAssociation);
    const txResponse = await tx.execute(this.client);
    const receipt = await txResponse.getReceipt(this.client);
    const txStatus = receipt.status;

    if (!txStatus.toString().includes("SUCCESS"))
      throw new Error("Token Association failed");

    const accountId = receipt.accountId;

    return {
      accountId: accountId!.toString(),
      privateKey: accountPrivateKey.toStringRaw(),
      publicKey: accountPublicKey.toStringRaw(),
    };
  }

  async setMaxAutoAssociation(maxAutoAssociation: number): Promise<void> {
    const tx = new AccountUpdateTransaction()
      .setAccountId(this.accountId)
      .setMaxAutomaticTokenAssociations(maxAutoAssociation)
      .freezeWith(this.client);
    const txResponse = await tx.execute(this.client);
    await txResponse.getReceipt(this.client);
  }

  async createFT(options: CreateFTOptions): Promise<string> {
    const isCustodial: boolean = true; // this method is hardcoded as custodial

    const result = await this.agentKit
        .createFT(options, isCustodial)
        .then(response => response.getRawResponse() as CreateTokenResult)
    return result.tokenId.toString();
  }

  async createNFT(options: CreateNFTOptions): Promise<string> {
    const isCustodial: boolean = true; // this method is hardcoded as custodial

    const result = await this.agentKit
        .createNFT(options, isCustodial)
        .then(response => response.getRawResponse() as CreateTokenResult)
    return result.tokenId.toString();
  }

  async transferToken(
    receiverId: string,
    tokenId: string,
    amount: number
  ): Promise<void> {
    const isCustodial: boolean = true; // this method is hardcoded as custodial

    await this.agentKit.transferToken(
      TokenId.fromString(tokenId),
      receiverId,
      amount,
      isCustodial,
    );
  }

  async airdropToken(
    tokenId: string,
    recipients: AirdropRecipient[]
  ): Promise<AirdropResult> {
    const isCustodial: boolean = true; // this method is hardcoded as custodial

    return await this.agentKit
      .airdropToken(TokenId.fromString(tokenId), recipients, isCustodial)
      .then(response => response.getRawResponse() as AirdropResult);
  }

  getAccountId(): string {
    return this.accountId.toString();
  }

  async createTopic(
    topicMemo: string,
    submitKey: boolean
  ): Promise<CreateTopicResult> {
    const isCustodial: boolean = true; // this method is hardcoded as custodial

    return this.agentKit
        .createTopic(topicMemo, submitKey, isCustodial)
        .then(response => response.getRawResponse() as CreateTopicResult);
  }

  async getAccountTokenBalance(
      tokenId: string,
      networkType: string,
      accountId: string
  ): Promise<number> {
    return this.agentKit.getHtsBalance(tokenId, networkType as HederaNetworkType, accountId, true);
  }

  async submitTopicMessage(topicId: string, message: string): Promise<SubmitMessageResult> {
    const isCustodial: boolean = true; // this method is hardcoded as custodial

    return this.agentKit
      .submitTopicMessage(TopicId.fromString(topicId), message, isCustodial)
      .then(response => response.getRawResponse() as SubmitMessageResult);
  }

  /*
  Associates token to the operator account.
  @param tokenId - token id to associate
  @returns AssociateTokenResult - response from the transaction
   */
  async associateToken(
    tokenId: string,
  ) : Promise<AssociateTokenResult> {
    return this.agentKit
      .associateToken(TokenId.fromString(tokenId), true)
      .then(response => response.getRawResponse() as AssociateTokenResult);
  }

}

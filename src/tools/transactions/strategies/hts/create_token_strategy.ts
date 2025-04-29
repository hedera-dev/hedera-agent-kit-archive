import {
    AccountId,
    Client, PublicKey,
    TokenCreateTransaction,
    TokenSupplyType,
    TokenType,
    Transaction, TransactionReceipt, TransactionResponse
} from "@hashgraph/sdk";
import { TransactionStrategy } from "../base_strategy";
import { CreateTokenResult } from "../../../results";

export interface CreateTokenOptions {
    name: string;
    symbol: string;
    decimals?: number;
    initialSupply?: number | undefined;
    isSupplyKey?: boolean;
    tokenType: TokenType;
    client: Client;
    maxSupply?: number;
    isMetadataKey?: boolean;
    isAdminKey?: boolean;
    tokenMetadata?: Uint8Array;
    memo?: string;
}

export class CreateTokenStrategy implements TransactionStrategy<CreateTokenResult> {
    constructor(
        private options: CreateTokenOptions,
        private publicKey: PublicKey,
        private issuerAccountId: AccountId | string,
    ) {}

    build(): Transaction {
        const tx = new TokenCreateTransaction()
            .setTokenName(this.options.name)
            .setTokenSymbol(this.options.symbol)
            .setTokenType(this.options.tokenType)
            .setDecimals(this.options?.decimals || 0)
            .setInitialSupply(this.options?.initialSupply || 0)
            .setTreasuryAccountId(this.issuerAccountId)
            .setTransactionValidDuration(180);

        // Optional and conditional parameters
        if (this.options.maxSupply) {
            tx.setMaxSupply(this.options.maxSupply).setSupplyType(TokenSupplyType.Finite);
        }
        if (this.options.tokenMetadata) {
            tx.setMetadata(this.options.tokenMetadata);
        }
        if (this.options.memo) {
            tx.setTokenMemo(this.options.memo);
        }
        if (this.options.isMetadataKey) {
            tx.setMetadataKey(this.publicKey);
        }
        if (this.options.isSupplyKey) {
            tx.setSupplyKey(this.publicKey);
        }
        if (this.options.isAdminKey) {
            tx.setAdminKey(this.publicKey);
        }
        return tx;
    }

    formatResult(txResponse: TransactionResponse, receipt:  TransactionReceipt): CreateTokenResult {
        if (!receipt.tokenId) throw new Error("Token Create Transaction failed");

        return {
            status: receipt.status.toString(),
            txHash: txResponse.transactionId.toString(),
            tokenId: receipt.tokenId,
        }
    }
}
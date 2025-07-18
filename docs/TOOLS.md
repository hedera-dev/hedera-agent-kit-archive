# Available Tools

The Hedera Agent Kit provides a comprehensive set of tools organized by service type. These tools can be used both by the conversational agent and programmatically.

## Hedera Transaction Tools
These tools provided by the toolkit enable you to execute basic transacitons on the Hedera network.

| Tool Name                                       | Description                                        |  Usage                                             |
| ----------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------- |
| `transfer_hbar_tool`| Transfer HBAR between accounts | Provide the amount of of HBAR to transfer, the account to transfer to, and optionally, a transaction memo.|
| `create_fungible_token`| Creates a new Hedera fungible token| Provide the name of the token, and the symbol. Optionally, and initial supply amount for the token, and if it is a treasury account, the treasury account ID. |
| `create_non_fungible_token`| Create NFTs on the Hedera network | Requires a name and symbol for the NFT, and can include a max supply limit and treasury account ID. |
| `airdrop_fungible_token`| Airdrop fungible token(s) to a specific account | Provide the token ID to airdrop, amount of tokens, and recipient account ID. Can inslude a source account and memo.|
| `transfer_fungible_token`| Transfer Fungible tokens between accounts on Hedera | Provide the token ID to transfter, amount, and recipient account ID. YOu can also add the source account ID and a memo |
<!-- | `tool-name`| Description of what Tool Does | How to use| -->

## Hedera Query Tools
These tools provided by the toolkit enable you to complete (free) queries against mirror nodes on the Hedera network.

| Tool Name                      | Description                           | Usage                                       |
| ------------------------------ | ------------------------------------- | --------------------------------------------------- |
| `get_account_query`| Returns comprehensive account information for a given Hedera account | Provide an account ID to query |
| `get_hbar_balance_query`| Returns the HBAR balance for a given Hedera account in tinybars| Requires a Hedera account ID to query (uses context operator account if not specified)|
| `get_account_token_balances_query`| Returns token balances for a Hedera acocunt | rovide the account ID to query (optional - uses context account if not provided). Optionally, provide a specific token ID to query|
| `get_topic_messages_query`| Returns messages for a given Hedera Consensus Service (HCS) topic | Provide the topic ID to query (required). Optionally, provide start time, end time, and limit for message filtering|

<!-- | `tool-name`| Description of what Tool Does | How to use| -->
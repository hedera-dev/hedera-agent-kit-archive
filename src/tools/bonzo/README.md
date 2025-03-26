# Bonzo Finance Tools

This module provides tools for interacting with the Bonzo Finance protocol on Hedera. It allows you to query information about the protocol, including account positions, market data, and protocol statistics.

## API Tools

The following tools are available for interacting with the Bonzo Finance API:

### Dashboard

Get detailed information about an account's lending and borrowing positions.

```typescript
import { get_bonzo_dashboard } from '@hedera-agent-kit/tools/bonzo';

// Get dashboard for account 0.0.1234
const dashboard = await get_bonzo_dashboard('0.0.1234');
console.log(`Health Factor: ${dashboard.user_credit.health_factor}`);
```

### Debtors

Get a list of all accounts with outstanding debt.

```typescript
import { get_bonzo_debtors } from '@hedera-agent-kit/tools/bonzo';

// Get all debtors
const debtors = await get_bonzo_debtors();
console.log(`Number of debtors: ${debtors.debtors.length}`);
```

### Market

Get current global state of all Bonzo liquidity pools.

```typescript
import { get_bonzo_market } from '@hedera-agent-kit/tools/bonzo';

// Get market data
const market = await get_bonzo_market();
console.log(`Number of reserves: ${market.reserves.length}`);
```

### Stats

Get 24-hour usage statistics for the protocol.

```typescript
import { get_bonzo_stats } from '@hedera-agent-kit/tools/bonzo';

// Get protocol statistics
const stats = await get_bonzo_stats();
console.log(`Total supply value: ${stats.total_supply_value.usd_display}`);
```

### Info

Get server and protocol configuration information.

```typescript
import { get_bonzo_info } from '@hedera-agent-kit/tools/bonzo';

// Get protocol information
const info = await get_bonzo_info();
console.log(`Lending pool address: ${info.lending_pool_address}`);
```

### Token

Get circulation information for the BONZO token.

```typescript
import { get_bonzo_token, get_bonzo_circulation } from '@hedera-agent-kit/tools/bonzo';

// Get BONZO token information
const token = await get_bonzo_token();
console.log(`Total supply: ${token.total_supply}`);

// Get BONZO circulation
const circulation = await get_bonzo_circulation();
console.log(`Circulating supply: ${circulation}`);
```

## API Client

You can also use the `BonzoApiClient` directly for more advanced use cases:

```typescript
import { BonzoApiClient } from '@hedera-agent-kit/tools/bonzo';

// Create a client with a custom base URL
const client = new BonzoApiClient('https://custom-bonzo-api.example.com');

// Get market data
const market = await client.getMarket();
```

## Types

The module includes TypeScript types for all API responses, which can be imported from the main package:

```typescript
import { 
  BonzoDashboardResponse, 
  BonzoDebtorsResponse, 
  BonzoMarketResponse, 
  BonzoStatsResponse, 
  BonzoInfoResponse, 
  BonzoTokenResponse,
  BonzoReserve,
  BonzoUserCredit,
  BalanceInfo
} from '@hedera-agent-kit/types';
``` 
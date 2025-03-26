import { Provider } from "ethers";
import { BonzoApiClient } from "./api/client";
import { BonzoReserve, BonzoDashboardResponse, BonzoMarketResponse } from "../../types";

/**
 * Bonzo Finance Liquidity Pool integration
 * 
 * This class provides a wrapper around the Bonzo Finance API to interact with
 * the Bonzo Liquidity Pools in a way that's compatible with the existing
 * LiquidityPool class pattern.
 */
export class BonzoLiquidityPool {
  private readonly _client: BonzoApiClient;
  private _marketData: BonzoMarketResponse | null = null;

  /**
   * Private constructor, should only be invoked within
   * the context of the user calling the create method.
   * @param client instance of the Bonzo API client.
   */
  private constructor(client: BonzoApiClient) {
    this._client = client;
  }

  /**
   * Asynchronously creates and configures a BonzoLiquidityPool class.
   * @param provider provides read-only access to the remote network (not used directly but kept for API compatibility).
   * @param address the address of the lending pool contract (not used directly but kept for API compatibility).
   * @returns a promise returning a configured instance of the BonzoLiquidityPool class.
   */
  static async create(provider: Provider, address: string): Promise<BonzoLiquidityPool> {
    const client = new BonzoApiClient();
    const pool = new BonzoLiquidityPool(client);
    
    // Pre-fetch market data
    await pool.refreshMarketData();
    
    return pool;
  }

  /**
   * Refreshes the cached market data
   * @returns A promise that resolves when the market data has been refreshed
   */
  async refreshMarketData(): Promise<void> {
    this._marketData = await this._client.getMarket();
  }

  /**
   * Gets the current market data
   * @returns The current market data
   */
  async getMarketData(): Promise<BonzoMarketResponse> {
    if (!this._marketData) {
      await this.refreshMarketData();
    }
    return this._marketData!;
  }

  /**
   * Gets the reserves from the market data
   * @returns The reserves from the market data
   */
  async getReserves(): Promise<BonzoReserve[]> {
    const marketData = await this.getMarketData();
    return marketData.reserves;
  }

  /**
   * Retrieves detailed information about an account's lending and borrowing positions
   * @param account the account address to query
   * @returns a promise returning the dashboard data for the account
   */
  async getDashboard(account: string): Promise<BonzoDashboardResponse> {
    return await this._client.getDashboard(account);
  }

  /**
   * Retrieves a list of all accounts with outstanding debt
   * @returns a promise returning the list of debtor accounts
   */
  async getDebtors(): Promise<string[]> {
    const debtors = await this._client.getDebtors();
    return debtors.debtors;
  }

  /**
   * Retrieves the health factor for an account
   * @param account the account address to query
   * @returns a promise returning the health factor for the account
   */
  async getHealthFactor(account: string): Promise<number> {
    const dashboard = await this.getDashboard(account);
    return dashboard.user_credit.health_factor;
  }

  /**
   * Checks if an account is at risk of liquidation
   * @param account the account address to query
   * @param threshold the health factor threshold below which an account is considered at risk (default: 1.1)
   * @returns a promise returning true if the account is at risk of liquidation
   */
  async isAtRiskOfLiquidation(account: string, threshold: number = 1.1): Promise<boolean> {
    const healthFactor = await this.getHealthFactor(account);
    return healthFactor < threshold;
  }

  /**
   * Finds accounts that are at risk of liquidation
   * @param threshold the health factor threshold below which an account is considered at risk (default: 1.1)
   * @returns a promise returning an array of accounts that are at risk of liquidation
   */
  async findAccountsAtRiskOfLiquidation(threshold: number = 1.1): Promise<string[]> {
    const debtors = await this.getDebtors();
    const atRiskAccounts: string[] = [];
    
    for (const debtor of debtors) {
      try {
        if (await this.isAtRiskOfLiquidation(debtor, threshold)) {
          atRiskAccounts.push(debtor);
        }
      } catch (error: any) {
        console.error(`Error checking if account ${debtor} is at risk: ${error.message}`);
      }
    }
    
    return atRiskAccounts;
  }
} 
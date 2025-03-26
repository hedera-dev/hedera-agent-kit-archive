import axios from 'axios';
import { 
  BonzoDashboardResponse, 
  BonzoDebtorsResponse, 
  BonzoInfoResponse, 
  BonzoMarketResponse, 
  BonzoStatsResponse, 
  BonzoTokenResponse 
} from '../../../types';

/**
 * Client for interacting with the Bonzo Finance API
 */
export class BonzoApiClient {
  private readonly baseUrl: string;

  /**
   * Creates a new instance of the Bonzo API client
   * @param baseUrl Optional base URL for the API (defaults to the production API)
   */
  constructor(baseUrl: string = 'https://bonzo-data-api-eceac9d8a2aa.herokuapp.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get detailed information about an account's lending and borrowing positions
   * @param accountId Hedera account ID in format shard.realm.num
   * @returns Dashboard information for the specified account
   */
  async getDashboard(accountId: string): Promise<BonzoDashboardResponse> {
    try {
      const response = await axios.get<BonzoDashboardResponse>(`${this.baseUrl}/dashboard/${accountId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get dashboard for account ${accountId}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get a list of all accounts with outstanding debt
   * @returns List of debtor accounts
   */
  async getDebtors(): Promise<BonzoDebtorsResponse> {
    try {
      const response = await axios.get<BonzoDebtorsResponse>(`${this.baseUrl}/debtors`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get debtors: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get current global state of all Bonzo liquidity pools
   * @returns Market information for all liquidity pools
   */
  async getMarket(): Promise<BonzoMarketResponse> {
    try {
      const response = await axios.get<BonzoMarketResponse>(`${this.baseUrl}/market`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get market information: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get 24-hour usage statistics for the protocol
   * @returns Protocol statistics
   */
  async getStats(): Promise<BonzoStatsResponse> {
    try {
      const response = await axios.get<BonzoStatsResponse>(`${this.baseUrl}/stats`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get protocol statistics: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get server and protocol configuration information
   * @returns Protocol information
   */
  async getInfo(): Promise<BonzoInfoResponse> {
    try {
      const response = await axios.get<BonzoInfoResponse>(`${this.baseUrl}/info`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get protocol information: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get circulation information for the BONZO token
   * @returns BONZO token information
   */
  async getBonzoToken(): Promise<BonzoTokenResponse> {
    try {
      const response = await axios.get<BonzoTokenResponse>(`${this.baseUrl}/bonzo`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get BONZO token information: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get current circulating supply of BONZO token in decimal notation
   * @returns Circulating supply as a string
   */
  async getBonzoCirculation(): Promise<string> {
    try {
      const response = await axios.get<string>(`${this.baseUrl}/bonzo/circulation`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get BONZO circulation: ${error.message}`);
      }
      throw error;
    }
  }
} 
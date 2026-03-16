// Keys are range strings like "0-200USDC", values are APR decimals like "0.05000000"
export type TierAPR = Record<string, string>;

export interface FlexibleProduct {
  asset: string;
  latestAnnualPercentageRate: string;
  tierAnnualPercentageRate: TierAPR;
  airDropPercentageRate: string;
  canPurchase: boolean;
  canRedeem: boolean;
  isSoldOut: boolean;
  hot: boolean;
  minPurchaseAmount: string;
  productId: string;
  subscriptionStartTime: number;
  status: string;
}

export interface EarnData {
  updatedAt: string;
  total: number;
  stablecoins: string[];
  products: FlexibleProduct[];
}

export type SortKey = 'asset' | 'apr' | 'minPurchase' | 'price' | 'change24h';
export type SortDir = 'asc' | 'desc';
export type FilterStatus = 'all' | 'available' | 'soldout' | 'hot' | 'stablecoin' | 'has-tiers';

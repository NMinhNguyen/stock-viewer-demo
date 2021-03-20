import { endOfDay, getUnixTime } from 'date-fns';

export const FINNHUB_API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

if (!FINNHUB_API_KEY) {
  throw new Error(
    'Please define the `REACT_APP_FINNHUB_API_KEY` environment variable inside .env.local',
  );
}

export type StockSymbol = {
  currency: string;
  description: string;
  displaySymbol: string;
  symbol: string;
};

export async function fetchStockSymbols(): Promise<StockSymbol[]> {
  const response = await fetch(
    `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${FINNHUB_API_KEY}`,
  );
  if (!response.ok) {
    throw new Error('Failed to fetch stock symbols');
  }
  return response.json();
}

export type Candle = {
  // It appears that the API can sometimes return `null`.
  c?: number[] | null;
  h?: number[] | null;
  l?: number[] | null;
  o?: number[] | null;
  // TODO do I need to do anything differently here?
  s: 'ok' | 'no_data';
  t?: number[] | null;
  v?: number[] | null;
};

export async function fetchCandle(
  symbol: StockSymbol,
  [start, end]: [Date, Date],
): Promise<Candle> {
  const response = await fetch(
    `https://finnhub.io/api/v1/stock/candle?symbol=${symbol.symbol}&resolution=D&from=${getUnixTime(
      start,
    )}&to=${getUnixTime(endOfDay(end))}&token=${FINNHUB_API_KEY}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch candlestick data for symbol '${symbol.symbol}'`);
  }

  return response.json();
}

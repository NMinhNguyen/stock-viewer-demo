import { rest } from 'msw';
import type { Candle } from '../api';
import { symbols } from './symbols';

// https://github.com/mswjs/msw/issues/397#issuecomment-751230924
function finnhub(path: string) {
  return new URL(path, 'https://finnhub.io').toString();
}

const handlers = [
  rest.get(finnhub('/api/v1/stock/symbol'), async (req, res, ctx) => {
    const { searchParams } = req.url;
    const token = searchParams.get('token');
    const exchange = searchParams.get('exchange');

    if (!(token && exchange)) {
      return res(ctx.status(400));
    }

    return res(ctx.json(symbols));
  }),
  rest.get(finnhub('/api/v1/stock/candle'), async (req, res, ctx) => {
    const { searchParams } = req.url;
    const token = searchParams.get('token');
    const symbol = searchParams.get('symbol');
    const resolution = searchParams.get('resolution');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!(token && symbol && resolution && from && to)) {
      return res(ctx.status(400));
    }

    const candle: Candle = {
      c: [122.8155, 122.56986900000001, 122.7902615316],
      h: [123.492, 123.245016, 122.99852596800001],
      l: [122.631, 122.385738, 122.140966524],
      o: [123, 122.754, 122.508492],
      s: 'ok',
      t: [1614643200, 1614729600, 1614816000],
      v: [52, 39, 99],
    };

    return res(ctx.json(candle));
  }),
];

export { handlers };

/** @jsxImportSource @emotion/react */

import { useEffect, useMemo, useReducer, useState } from 'react';
import { css } from '@emotion/react';
import { isAfter, fromUnixTime } from 'date-fns';
import ToggleButton from '@material-ui/core/ToggleButton';
import ToggleButtonGroup from '@material-ui/core/ToggleButtonGroup';
import type { DateRange } from '@material-ui/lab/DateRangePicker';
// @ts-expect-error ts(2307) There's no typings for `react-charts`
import { Chart } from 'react-charts';
import { useErrorHandler } from 'react-error-boundary';
import { fetchCandle } from './api';
import type { Candle, StockSymbol } from './api';
import { useRemoteData } from './useRemoteData';

const PRICE_PROPERTY_BY_KEY = {
  OPEN: 'o',
  HIGH: 'h',
  LOW: 'l',
  CLOSE: 'c',
} as const;

type PriceKey = keyof typeof PRICE_PROPERTY_BY_KEY;

const priceKeys = Object.keys(PRICE_PROPERTY_BY_KEY) as PriceKey[];

type PriceTypeToggleProps = {
  value: PriceKey;
  onChange: (value: PriceKey) => void;
};

function PriceTypeToggle({ value, onChange }: PriceTypeToggleProps) {
  return (
    <ToggleButtonGroup value={value} exclusive orientation="vertical">
      {priceKeys.map((key) => (
        <ToggleButton
          key={key}
          value={key}
          onClick={() => {
            onChange(key);
          }}
        >
          {key}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function isValidDateRange(dateRange: DateRange<Date>): dateRange is [Date, Date] {
  const [start, end] = dateRange;
  return Boolean(start && end && !isAfter(start, end));
}

const axes = [
  {
    primary: true,
    type: 'time',
    position: 'bottom',
  },
  {
    type: 'linear',
    position: 'left',
  },
];

type StockSymbolWithCandle = StockSymbol & Candle;

type ChartProps = {
  symbols: StockSymbol[];
  dateRange: DateRange<Date>;
};

export function StockChart({ symbols, dateRange }: ChartProps) {
  const [priceKey, setPriceKey] = useState<PriceKey>('OPEN');

  const { isIdle, isLoading, error, data, createRemoteDataEffect } = useRemoteData<
    StockSymbolWithCandle[]
  >();

  useErrorHandler(error);

  const [chartKey, incrementChartKey] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (!(symbols.length > 0 && isValidDateRange(dateRange))) {
      return;
    }

    return createRemoteDataEffect(
      () =>
        Promise.all(
          symbols.map(async (symbol) => {
            const candle = await fetchCandle(symbol, dateRange);
            return { ...symbol, ...candle };
          }),
        ),
      {
        onSuccess: () => {
          // See comment about `react-charts` below
          incrementChartKey();
        },
      },
    );
  }, [dateRange, symbols, createRemoteDataEffect]);

  const chartData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.map((candle) => ({
      label: candle.displaySymbol,
      data: (candle[PRICE_PROPERTY_BY_KEY[priceKey]] ?? []).map((price, index) => ({
        // If `candle[PRICE_KEYS[priceKey]]` was not null, we can probably assume
        // `candle.t` is present too.
        primary: fromUnixTime(candle.t![index]),
        secondary: price,
      })),
    }));
  }, [data, priceKey]);

  return (
    <>
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 85%;
          height: 60%;
        `}
      >
        {
          // This API seems to be fairly quick,
          // showing a spinner for a few ms can actually appear jarring.
          isIdle || isLoading ? null : chartData.length > 0 ? (
            <>
              <div
                css={css`
                  width: 85%;
                  height: 100%;
                `}
              >
                <Chart
                  // `react-charts` seems to have issues with props changing,
                  // and remounting the component fixes them:
                  // https://github.com/tannerlinsley/react-charts/issues/134
                  key={`${priceKey}-${chartKey}`}
                  data={chartData}
                  axes={axes}
                  tooltip
                />
              </div>
              <PriceTypeToggle value={priceKey} onChange={setPriceKey} />
            </>
          ) : null
        }
      </div>
    </>
  );
}

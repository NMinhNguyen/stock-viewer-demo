/** @jsxImportSource @emotion/react */

import { useEffect, useMemo, useReducer, useState } from 'react';
import type { DependencyList, PropsWithChildren } from 'react';
import { css } from '@emotion/react';
import { endOfDay, isAfter, getUnixTime, fromUnixTime } from 'date-fns';
import CssBaseline from '@material-ui/core/CssBaseline';
import TextField from '@material-ui/core/TextField';
import Autocomplete, {
  createFilterOptions,
} from '@material-ui/core/Autocomplete';
import CircularProgress from '@material-ui/core/CircularProgress';
import Alert from '@material-ui/core/Alert';
import AlertTitle from '@material-ui/core/AlertTitle';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import ToggleButton from '@material-ui/core/ToggleButton';
import ToggleButtonGroup from '@material-ui/core/ToggleButtonGroup';
import { useEventCallback } from '@material-ui/core/utils';
import DateFnsAdapter from '@material-ui/lab/AdapterDateFns';
import MuiDateRangePicker from '@material-ui/lab/DateRangePicker';
import type { DateRange } from '@material-ui/lab/DateRangePicker';
import LocalizationProvider from '@material-ui/lab/LocalizationProvider';
// @ts-expect-error ts(2307) There's no typings for `react-charts`
import { Chart } from 'react-charts';
import {
  ErrorBoundary as ReactErrorBoundary,
  useErrorHandler,
} from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';

const USE_SANDBOX = true;

const FINNHUB_API_TOKEN = USE_SANDBOX
  ? 'sandbox_c17489f48v6se55vleeg'
  : 'c17489f48v6se55vlee0';

const PRICE_PROPERTY_BY_KEY = {
  OPEN: 'o',
  HIGH: 'h',
  LOW: 'l',
  CLOSE: 'c',
} as const;

type PriceKey = keyof typeof PRICE_PROPERTY_BY_KEY;

const priceKeys = Object.keys(PRICE_PROPERTY_BY_KEY) as PriceKey[];

type StockSymbol = {
  currency: string;
  description: string;
  displaySymbol: string;
  symbol: string;
};

const filterOptions = createFilterOptions<StockSymbol>({
  // TODO add virtualisation instead.
  limit: 100,
});

type StockSelectProps = {
  symbols: StockSymbol[];
  onChange: (values: StockSymbol[]) => void;
};

function StockSelect({ symbols, onChange }: StockSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  // const [options, setOptions] = useState<StockSymbol[]>([]);
  // const isLoading = isOpen && options.length === 0;

  // useEffect(() => {
  //   if (!isLoading) {
  //     return;
  //   }

  //   let isCancelled = false;

  //   (async () => {
  //     // TODO think about error handling perhaps
  //     const response = await fetch(
  //       `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${FINNHUB_API_TOKEN}`,
  //     );
  //     const data = (await response.json()) as StockSymbol[];

  //     if (!isCancelled) {
  //       setOptions(data);
  //     }
  //   })();

  //   return () => {
  //     isCancelled = true;
  //   };
  // }, [isLoading]);

  const { data: options } = useAsync(
    () => {
      if (!isLoading) {
        return SKIP_FETCH;
      }

      return (async () => {
        const response = await fetch(
          `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${FINNHUB_API_TOKEN}`,
        );
        return (await response.json()) as StockSymbol[];
      })();
    },
    [isOpen && options?.length === 0],
    {
      initialData: [],
    },
  );

  const isLoading = isOpen && options?.length === 0;

  return (
    <Autocomplete
      // disablePortal
      css={css`
        width: 300px;
      `}
      disableCloseOnSelect
      multiple
      loading={isLoading}
      open={isOpen}
      onOpen={() => {
        setIsOpen(true);
      }}
      onClose={() => {
        setIsOpen(false);
      }}
      options={options}
      // TODO I think I should instead set `optionLabel` to this long string
      // and then customise Chips - because I wanna be able to search using the full name
      // Or just bite the bullet and implement custom `filterOptions`
      getOptionLabel={(option) => option.displaySymbol}
      // TODO if the variable height turns out to be a problem when virtualising, get rid of this
      renderOption={(optionProps, option) => (
        <li {...optionProps}>
          {option.description} ({option.displaySymbol})
        </li>
      )}
      filterOptions={filterOptions}
      value={symbols}
      onChange={(_event, values) => {
        if (values.length <= 3) {
          onChange(values);
        }
      }}
      renderInput={(inputProps) => (
        <TextField
          {...inputProps}
          label="Stonks"
          InputProps={{
            ...inputProps.InputProps,
            endAdornment: (
              <>
                {isLoading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {inputProps.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

type DateRangePickerProps = {
  value: DateRange<Date>;
  onChange: (value: DateRange<Date>) => void;
};

function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <MuiDateRangePicker
      value={value}
      onChange={onChange}
      renderInput={(startProps, endProps) => (
        <>
          <TextField {...startProps} variant="standard" />
          <Box sx={{ mx: 2 }}> to </Box>
          <TextField {...endProps} variant="standard" />
        </>
      )}
    />
  );
}

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

type Candle = {
  // It appears that the API can sometimes return `null`.
  c?: number[] | null;
  h?: number[] | null;
  l?: number[] | null;
  o?: number[] | null;
  s: 'ok' | 'no_data';
  t?: number[] | null;
  v?: number[] | null;
};

type StockSymbolWithCandle = StockSymbol & Candle;

type ChartProps = {
  symbols: StockSymbol[];
  dateRange: DateRange<Date>;
};

type RemoteData<T> =
  | { isIdle: true; isLoading: false; data?: T; error?: never }
  | { isIdle: false; isLoading: true; data?: T; error?: never }
  | { isIdle: false; isLoading: false; data: T; error?: never }
  | { isIdle: false; isLoading: false; data?: never; error: Error };

const PENDING = 'PENDING';
const RESOLVED = 'RESOLVED';
const REJECTED = 'REJECTED';

type RemoteDataAction<T> =
  | [typeof PENDING]
  | [typeof RESOLVED, T]
  | [typeof REJECTED, Error];

const SKIP_FETCH = Symbol.for('useAsync.SKIP_FETCH');

type UseAsyncOptions<T> = {
  initialData?: T;
  onSuccess?: () => void;
};

function useAsync<T>(
  fnProp: () => Promise<T> | typeof SKIP_FETCH,
  dependencies: DependencyList,
  { initialData, onSuccess: onSuccessProp }: UseAsyncOptions<T> = {},
) {
  // Avoid stale closure problems by storing function props in refs:
  // https://reactjs.org/docs/hooks-faq.html#how-to-read-an-often-changing-value-from-usecallback
  const fn = useEventCallback(fnProp);
  const onSuccess = useEventCallback(() => {
    onSuccessProp?.();
  });

  const [fetchState, dispatch] = useReducer(
    (state: RemoteData<T>, action: RemoteDataAction<T>): RemoteData<T> => {
      switch (action[0]) {
        case PENDING:
          return { ...state, isIdle: false, isLoading: true, error: undefined };
        case REJECTED:
          return {
            ...state,
            isIdle: false,
            isLoading: false,
            error: action[1],
            data: undefined,
          };
        case RESOLVED:
          return {
            ...state,
            isIdle: false,
            isLoading: false,
            data: action[1],
            error: undefined,
          };
      }
    },
    { isIdle: true, isLoading: false, data: initialData },
  );

  useEffect(() => {
    let isCancelled = false;

    (async () => {
      let data: T;
      // Allow SKIP_FETCH to be returned synchronously.
      const maybePromise = fn();
      if (maybePromise === SKIP_FETCH) {
        return;
      }

      try {
        dispatch([PENDING]);
        data = await maybePromise;
      } catch (error) {
        if (!isCancelled) {
          dispatch([REJECTED, error]);
        }
        throw error;
      }

      if (!isCancelled) {
        dispatch([RESOLVED, data]);
        onSuccess();
      }
    })();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, onSuccess, ...dependencies]);

  return fetchState;
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

function StockChart({ symbols, dateRange }: ChartProps) {
  const [priceKey, setPriceKey] = useState<PriceKey>('OPEN');

  const [chartKey, incrementChartKey] = useReducer((x) => x + 1, 0);

  const { error, isIdle, isLoading, ...fetchState } = useAsync(
    () => {
      const [start, end] = dateRange;
      if (!(symbols.length > 0 && start && end && !isAfter(start, end))) {
        return SKIP_FETCH;
      }

      return Promise.all(
        symbols.map(async (symbol) => {
          const response = await fetch(
            `https://finnhub.io/api/v1/stock/candle?symbol=${
              symbol.symbol
            }&resolution=D&from=${getUnixTime(start)}&to=${getUnixTime(
              endOfDay(end),
            )}&token=${FINNHUB_API_TOKEN}`,
          );
          const candle = (await response.json()) as Candle;
          return { ...symbol, ...candle };
        }),
      );
    },
    [dateRange, symbols],
    {
      onSuccess: () => {
        incrementChartKey();
      },
    },
  );

  useErrorHandler(error);

  const data = useMemo(() => {
    if (!fetchState.data) {
      return [];
    }

    return fetchState.data.map((candle) => ({
      label: candle.displaySymbol,
      data: (candle[PRICE_PROPERTY_BY_KEY[priceKey]] ?? []).map(
        (price, index) => ({
          // If `candle[PRICE_KEYS[priceKey]]` was not null, we can probably assume
          // `candle.t` is present too.
          primary: fromUnixTime(candle.t![index]),
          secondary: price,
        }),
      ),
    }));
  }, [fetchState, priceKey]);

  if (isIdle) {
    return null;
  }
  if (isLoading) {
    return <CircularProgress color="inherit" />;
  }

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
        {data.length > 0 ? (
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
                data={data}
                axes={axes}
                tooltip
              />
            </div>
            <PriceTypeToggle value={priceKey} onChange={setPriceKey} />
          </>
        ) : null}
      </div>
    </>
  );
}

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <Alert
      severity="error"
      action={
        <Button color="secondary" onClick={resetErrorBoundary}>
          Try again
        </Button>
      }
    >
      <AlertTitle>Something went wrong</AlertTitle>
      <pre>{error.toString()}</pre>
    </Alert>
  );
}

function ErrorBoundary({ children }: PropsWithChildren<{}>) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error(error);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

function App() {
  const [symbols, setSymbols] = useState<StockSymbol[]>([]);
  const [dateRange, setDateRange] = useState<DateRange<Date>>([null, null]);

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-evenly;
        height: 100vh;
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          flex-wrap: wrap;
          width: 100%;
        `}
      >
        <StockSelect symbols={symbols} onChange={setSymbols} />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>
      <ErrorBoundary>
        <StockChart symbols={symbols} dateRange={dateRange} />
      </ErrorBoundary>
    </div>
  );
}

export default function Root() {
  return (
    <LocalizationProvider dateAdapter={DateFnsAdapter}>
      <CssBaseline />
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </LocalizationProvider>
  );
}

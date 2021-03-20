/** @jsxImportSource @emotion/react */

import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';
import type { ComponentType, HTMLAttributes } from 'react';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { endOfDay, isAfter, getUnixTime, fromUnixTime } from 'date-fns';
import CssBaseline from '@material-ui/core/CssBaseline';
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/core/Autocomplete';
import type { AutocompleteProps } from '@material-ui/core/Autocomplete';
import CircularProgress from '@material-ui/core/CircularProgress';
import Alert from '@material-ui/core/Alert';
import AlertTitle from '@material-ui/core/AlertTitle';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import ToggleButton from '@material-ui/core/ToggleButton';
import ToggleButtonGroup from '@material-ui/core/ToggleButtonGroup';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import DateFnsAdapter from '@material-ui/lab/AdapterDateFns';
import MuiDateRangePicker from '@material-ui/lab/DateRangePicker';
import type { DateRange } from '@material-ui/lab/DateRangePicker';
import LocalizationProvider from '@material-ui/lab/LocalizationProvider';
// @ts-expect-error ts(2307) There's no typings for `react-charts`
import { Chart } from 'react-charts';
import { ErrorBoundary as ReactErrorBoundary, useErrorHandler } from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';
import { FixedSizeList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';

import { createFilterOptions } from './createFilterOptions';

const FINNHUB_API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

if (!FINNHUB_API_KEY) {
  throw new Error(
    'Please define the `REACT_APP_FINNHUB_API_KEY` environment variable inside .env.local',
  );
}

// Disable virtualisation due to
// 1. terrible UX when the list is 26k items long
// 2. Material-UI's Autocomplete component has some performance issues:
// https://github.com/mui-org/material-ui/issues/25417
// However, I've left the virtualisation code in to show that I've considered it as an option.
const USE_VIRTUALISATION = false;

const PRICE_PROPERTY_BY_KEY = {
  OPEN: 'o',
  HIGH: 'h',
  LOW: 'l',
  CLOSE: 'c',
} as const;

type PriceKey = keyof typeof PRICE_PROPERTY_BY_KEY;

const priceKeys = Object.keys(PRICE_PROPERTY_BY_KEY) as PriceKey[];

type RemoteData<T> =
  | { isIdle: true; isLoading: false; data?: never; error?: never }
  // Let previous data still be available
  | { isIdle: false; isLoading: true; data?: T; error?: never }
  | { isIdle: false; isLoading: false; data: T; error?: never }
  | { isIdle: false; isLoading: false; data?: never; error: Error };

const PENDING = 'PENDING';
const RESOLVED = 'RESOLVED';
const REJECTED = 'REJECTED';

type RemoteDataAction<T> = [typeof PENDING] | [typeof RESOLVED, T] | [typeof REJECTED, Error];

function useRemoteData<T>() {
  const [state, dispatch] = useReducer(
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
    { isIdle: true, isLoading: false },
  );

  type CreateRemoteDataEffectOptions = {
    onSuccess?: (data: T) => void;
  };

  const createRemoteDataEffect = useCallback(
    (fetchData: () => Promise<T>, { onSuccess }: CreateRemoteDataEffectOptions = {}) => {
      let isCancelled = false;
      (async () => {
        dispatch([PENDING]);
        let data: T;
        try {
          data = await fetchData();
        } catch (error) {
          if (!isCancelled) {
            dispatch([REJECTED, error]);
          }
          return;
        }

        if (!isCancelled) {
          dispatch([RESOLVED, data]);
          onSuccess?.(data);
        }
      })();

      return () => {
        isCancelled = true;
      };
    },
    // There appears to be a bug in the current version of react-hooks ESLint plugin used in CodeSandbox:
    // https://github.com/facebook/react/issues/19808#issuecomment-690621723
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    ...state,
    createRemoteDataEffect,
  };
}

const LISTBOX_PADDING = 8; // px

function Row(props: ListChildComponentProps) {
  const { data, index, style } = props;

  return cloneElement(data[index], {
    style: {
      ...style,
      top: (style.top as number) + LISTBOX_PADDING,
    },
  });
}

const OuterElementContext = createContext({});

const OuterElementType = forwardRef<HTMLDivElement>(function OuterElementType(props, ref) {
  const outerProps = useContext(OuterElementContext);
  return (
    <div
      css={css`
        box-sizing: border-box;
      `}
      ref={ref}
      {...props}
      {...outerProps}
    />
  );
});

const InnerElementType = styled.ul`
  padding: 0;
  margin: 0;
`;

// Based on https://next.material-ui.com/components/autocomplete/#virtualization
const ListboxComponent = forwardRef<HTMLDivElement>(function ListboxComponent(
  { children, ...other },
  ref,
) {
  const itemData = Children.toArray(children);
  const theme = useTheme();
  const smUp = useMediaQuery(theme.breakpoints.up('sm'), {
    noSsr: true,
  });
  const itemCount = itemData.length;
  const itemSize = smUp ? 36 : 48;

  function getHeight() {
    if (itemCount > 8) {
      return 8 * itemSize;
    }
    return itemCount * itemSize;
  }

  return (
    <div ref={ref}>
      <OuterElementContext.Provider value={other}>
        <FixedSizeList
          itemData={itemData}
          height={getHeight() + 2 * LISTBOX_PADDING}
          width="100%"
          outerElementType={OuterElementType}
          innerElementType={InnerElementType}
          itemSize={itemSize}
          overscanCount={5}
          itemCount={itemCount}
        >
          {Row}
        </FixedSizeList>
      </OuterElementContext.Provider>
    </div>
  );
});

function useVirtualisation(
  value: boolean,
): Pick<
  AutocompleteProps<any, any, any, any>,
  'disableListWrap' | 'filterOptions' | 'ListboxComponent'
> {
  const filterOptions = useMemo(
    () =>
      createFilterOptions<StockSymbol>({
        matchFrom: 'start',
        limit: value ? undefined : 100,
        stringify: (option) => [option.displaySymbol, option.description],
      }),
    [value],
  );

  if (!value) {
    return {
      filterOptions,
    };
  }

  return {
    filterOptions,
    disableListWrap: true,
    ListboxComponent: ListboxComponent as ComponentType<HTMLAttributes<HTMLElement>>,
  };
}

type StockSymbol = {
  currency: string;
  description: string;
  displaySymbol: string;
  symbol: string;
};

type StockSelectProps = {
  symbols: StockSymbol[];
  onChange: (values: StockSymbol[]) => void;
};

function StockSelect({ symbols, onChange }: StockSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { error, data: options = [], createRemoteDataEffect } = useRemoteData<StockSymbol[]>();

  useErrorHandler(error);

  // TODO do I need to allow reloading?
  const isLoading = isOpen && options.length === 0;

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    return createRemoteDataEffect(async () => {
      const response = await fetch(
        `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${FINNHUB_API_KEY}`,
      );

      if (!response.ok) {
        throw new Error('Failed to fetch stock symbols');
      }

      return ((await response.json()) as StockSymbol[]).sort((a, b) =>
        a.displaySymbol.localeCompare(b.displaySymbol, undefined, {
          sensitivity: 'base',
        }),
      );
    });
  }, [isLoading, createRemoteDataEffect]);

  const virtualisationProps = useVirtualisation(USE_VIRTUALISATION);

  return (
    <Autocomplete
      css={css`
        width: 300px;
      `}
      {...virtualisationProps}
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
      getOptionLabel={(option) => option.displaySymbol}
      renderOption={(optionProps, option) => (
        <li {...optionProps}>
          {/* TODO figure out what to do with text wrapping */}
          <Typography noWrap>
            {
              // It appears that the description can be empty
              option.description
                ? `${option.displaySymbol} - ${option.description}`
                : option.displaySymbol
            }
          </Typography>
        </li>
      )}
      value={symbols}
      onChange={(_event, values) => {
        if (values.length <= 3) {
          onChange(values);
        }
      }}
      renderInput={(inputProps) => (
        <TextField
          {...inputProps}
          label="Choose up to 3 stocks"
          InputProps={{
            ...inputProps.InputProps,
            endAdornment: (
              <>
                {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
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
  // TODO do I need to do anything differently here?
  s: 'ok' | 'no_data';
  t?: number[] | null;
  v?: number[] | null;
};

type StockSymbolWithCandle = StockSymbol & Candle;

type ChartProps = {
  symbols: StockSymbol[];
  dateRange: DateRange<Date>;
};

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

  const { isIdle, isLoading, error, data, createRemoteDataEffect } = useRemoteData<
    StockSymbolWithCandle[]
  >();

  useErrorHandler(error);

  const [chartKey, incrementChartKey] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const [start, end] = dateRange;
    if (!(symbols.length > 0 && start && end && !isAfter(start, end))) {
      return;
    }

    return createRemoteDataEffect(
      () =>
        Promise.all(
          symbols.map(async (symbol) => {
            const response = await fetch(
              `https://finnhub.io/api/v1/stock/candle?symbol=${
                symbol.symbol
              }&resolution=D&from=${getUnixTime(start)}&to=${getUnixTime(
                endOfDay(end),
              )}&token=${FINNHUB_API_KEY}`,
            );

            if (!response.ok) {
              throw new Error(`Failed to fetch candlestick data for symbol '${symbol.symbol}'`);
            }

            const candle = (await response.json()) as Candle;
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

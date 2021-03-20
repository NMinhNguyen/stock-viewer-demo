/** @jsxImportSource @emotion/react */

import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import type { ComponentType, HTMLAttributes } from 'react';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { isAfter, fromUnixTime } from 'date-fns';
import CssBaseline from '@material-ui/core/CssBaseline';
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/core/Autocomplete';
import type { AutocompleteProps } from '@material-ui/core/Autocomplete';
import CircularProgress from '@material-ui/core/CircularProgress';
import ToggleButton from '@material-ui/core/ToggleButton';
import ToggleButtonGroup from '@material-ui/core/ToggleButtonGroup';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import DateFnsAdapter from '@material-ui/lab/AdapterDateFns';
import type { DateRange } from '@material-ui/lab/DateRangePicker';
import LocalizationProvider from '@material-ui/lab/LocalizationProvider';
// @ts-expect-error ts(2307) There's no typings for `react-charts`
import { Chart } from 'react-charts';
import { useErrorHandler } from 'react-error-boundary';
import { FixedSizeList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';

import { createFilterOptions } from './createFilterOptions';
import { DateRangePicker } from './DateRangePicker';
import { ErrorBoundary } from './ErrorBoundary';
import { useRemoteData } from './useRemoteData';
import { fetchCandle, fetchStockSymbols } from './api';
import type { Candle, StockSymbol } from './api';

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

    return createRemoteDataEffect(async () =>
      (await fetchStockSymbols()).sort((a, b) =>
        a.displaySymbol.localeCompare(b.displaySymbol, undefined, {
          sensitivity: 'base',
        }),
      ),
    );
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

function isValidDateRange(dateRange: DateRange<Date>): dateRange is [Date, Date] {
  const [start, end] = dateRange;
  return Boolean(start && end && !isAfter(start, end));
}

function StockChart({ symbols, dateRange }: ChartProps) {
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

function Main() {
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

export default function App() {
  return (
    <LocalizationProvider dateAdapter={DateFnsAdapter}>
      <CssBaseline />
      <ErrorBoundary>
        <Main />
      </ErrorBoundary>
    </LocalizationProvider>
  );
}

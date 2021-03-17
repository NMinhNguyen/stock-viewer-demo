/** @jsxImportSource @emotion/react */

import { useEffect, useReducer, useState } from 'react';
import { css } from '@emotion/react';
import TextField from '@material-ui/core/TextField';
import Autocomplete, {
  createFilterOptions,
} from '@material-ui/core/Autocomplete';
import CircularProgress from '@material-ui/core/CircularProgress';
import { useErrorHandler } from 'react-error-boundary';

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

const USE_SANDBOX = true;

const FINNHUB_API_TOKEN = USE_SANDBOX
  ? 'sandbox_c17489f48v6se55vleeg'
  : 'c17489f48v6se55vlee0';

function useRemoteDataReducer<T>() {
  const result = useReducer(
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

  return result;
}

type StockSymbol = {
  currency: string;
  description: string;
  displaySymbol: string;
  symbol: string;
};

const filterOptions = createFilterOptions<StockSymbol>({
  // TODO add virtualisation instead.
  limit: 100,
  stringify: (option) => {
    // Join using a non-breaking space (a character that wouldn't be present in either field)
    return `${option.displaySymbol}\u00a0${option.description}`;
  },
});

type StockSelectProps = {
  symbols: StockSymbol[];
  onChange: (values: StockSymbol[]) => void;
};

export function StockSelect({ symbols, onChange }: StockSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [{ error, data: options = [] }, dispatch] = useRemoteDataReducer<
    StockSymbol[]
  >();

  useErrorHandler(error);

  const isLoading = isOpen && options.length === 0;

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    let isCancelled = false;
    (async () => {
      dispatch([PENDING]);
      let data: StockSymbol[];
      try {
        const response = await fetch(
          `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${FINNHUB_API_TOKEN}`,
        );

        if (!response.ok) {
          throw new Error('Failed to fetch stock symbols');
        }

        data = await response.json();
        data.sort((a, b) =>
          a.description.localeCompare(b.description, undefined, {
            sensitivity: 'base',
          }),
        );
      } catch (error) {
        dispatch([REJECTED, error]);
        return;
      }

      if (!isCancelled) {
        dispatch([RESOLVED, data]);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isLoading, dispatch]);

  return (
    <Autocomplete
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
          label="Choose up to 3 stonks"
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

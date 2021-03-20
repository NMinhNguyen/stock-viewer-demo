/** @jsxImportSource @emotion/react */

import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ComponentType, HTMLAttributes } from 'react';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/core/Autocomplete';
import type { AutocompleteProps } from '@material-ui/core/Autocomplete';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { useErrorHandler } from 'react-error-boundary';
import { FixedSizeList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import { createFilterOptions } from './createFilterOptions';
import { useRemoteData } from './useRemoteData';
import { fetchStockSymbols } from './api';
import type { StockSymbol } from './api';

// Disable virtualisation due to
// 1. terrible UX when the list is 26k items long
// 2. Material-UI's Autocomplete component has some performance issues:
// https://github.com/mui-org/material-ui/issues/25417
// However, I've left the virtualisation code in to show that I've considered it as an option.
const USE_VIRTUALISATION = false;

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

export function StockSelect({ symbols, onChange }: StockSelectProps) {
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

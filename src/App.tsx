/** @jsxImportSource @emotion/react */

import { useState } from 'react';
import { css } from '@emotion/react';
import CssBaseline from '@material-ui/core/CssBaseline';
import DateFnsAdapter from '@material-ui/lab/AdapterDateFns';
import type { DateRange } from '@material-ui/lab/DateRangePicker';
import LocalizationProvider from '@material-ui/lab/LocalizationProvider';
import { DateRangePicker } from './DateRangePicker';
import { ErrorBoundary } from './ErrorBoundary';
import type { StockSymbol } from './api';
import { StockChart } from './StockChart';
import { StockSelect } from './StockSelect';

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

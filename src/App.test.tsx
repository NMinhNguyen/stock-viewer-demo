import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from './App';

/*
  - I can display the time series of prices of the selected stocks in the same chart
  ✅ I can’t select more than 3 stocks to display at the same time
  - I can toggle between the following price types in the interactive chart
      - Open Prices
      - High Prices
      - Low Prices
      - Close Prices
  ✅ I can change the date range in the interactive chart
*/

// https://kentcdodds.com/blog/write-fewer-longer-tests
test('lets a user select up to 3 stocks', async () => {
  render(<App />);

  const stockSelect = screen.getByLabelText(/choose up to 3 stocks/i);
  expect(stockSelect).toBeInTheDocument();

  {
    userEvent.type(stockSelect, 'G');

    const listbox = await screen.findByRole('listbox');
    expect(listbox).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('GME');
    expect(options[1]).toHaveTextContent('GOOGL');

    userEvent.click(options[0]);

    expect(screen.getByRole('button', { name: 'GME' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /GME/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /GOOGL/ })).toHaveAttribute('aria-selected', 'false');
  }

  {
    userEvent.type(stockSelect, 'AMC');

    const option = screen.getByRole('option');
    expect(option).toHaveTextContent('AMC');

    userEvent.click(option);

    expect(screen.getByRole('button', { name: 'AMC' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /AMC/ })).toHaveAttribute('aria-selected', 'true');
  }

  {
    userEvent.type(stockSelect, 'TSLA');

    const option = screen.getByRole('option');
    expect(option).toHaveTextContent('TESLA');

    userEvent.click(option);

    expect(screen.getByRole('button', { name: 'TSLA' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /TESLA/ })).toHaveAttribute('aria-selected', 'true');
  }

  {
    userEvent.type(stockSelect, 'FB');

    const option = screen.getByRole('option');
    expect(option).toHaveTextContent('FACEBOOK');

    userEvent.click(option);
    // We've reached our limit of 3 selected options
    expect(screen.queryByRole('button', { name: 'FB' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /FB/ })).toHaveAttribute('aria-selected', 'false');
  }

  const selectedOptions = screen.getAllByRole('option', {
    name: (_accessibleName, element) => element.getAttribute('aria-selected') === 'true',
  });
  expect(selectedOptions).toHaveLength(3);
  expect(selectedOptions[0]).toHaveTextContent('AMC');
  expect(selectedOptions[1]).toHaveTextContent('GME');
  expect(selectedOptions[2]).toHaveTextContent('TSLA');
});

test('lets a user select and change a date range', async () => {
  // Can't put this in `beforeAll` because it interferes with `fetch`:
  // - https://github.com/mswjs/msw/issues/448
  // - https://github.com/facebook/jest/issues/11103
  jest.useFakeTimers('modern');
  jest.setSystemTime(new Date('2021-03-20'));

  try {
    render(<App />);

    const start = screen.getByLabelText(/start/i);
    expect(start).toBeInTheDocument();
    const end = screen.getByLabelText(/end/i);
    expect(end).toBeInTheDocument();

    userEvent.click(start);
    userEvent.click(screen.getByRole('cell', { name: 'Mar 1, 2021' }));
    userEvent.click(screen.getByRole('cell', { name: 'Mar 5, 2021' }));
    // By default Material-UI pickers use en-US locale:
    // https://github.com/dmtrKovalenko/date-io/blob/08dfe9e/packages/date-fns/src/date-fns-utils.ts#L49
    expect(start).toHaveValue('03/01/2021');
    expect(end).toHaveValue('03/05/2021');

    userEvent.click(screen.getByRole('cell', { name: 'Mar 10, 2021' }));
    userEvent.click(screen.getByRole('cell', { name: 'Mar 20, 2021' }));
    expect(start).toHaveValue('03/10/2021');
    expect(end).toHaveValue('03/20/2021');
  } finally {
    jest.useRealTimers();
  }
});

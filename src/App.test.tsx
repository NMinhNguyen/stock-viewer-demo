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
  - I can change the date range in the interactive chart
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

import { render, screen } from '@testing-library/react';
import App from './App';

test('renders a stock select', () => {
  render(<App />);
  const stockSelect = screen.getByLabelText(/stocks/i);
  expect(stockSelect).toBeInTheDocument();

  screen.debug(stockSelect);
});

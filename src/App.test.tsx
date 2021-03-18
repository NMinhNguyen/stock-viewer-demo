import { render, screen } from '@testing-library/react';
import App from './App';

test('renders a stock select', () => {
  render(<App />);
  const autocomplete = screen.getByLabelText(/stocks/i);
  expect(autocomplete).toBeInTheDocument();
});

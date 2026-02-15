/**
 * Custom render utility with userEvent.
 *
 * Wraps @testing-library/react's render with userEvent.setup()
 * for realistic user interaction simulation.
 */

import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Optional wrapper component (e.g. ThemeProvider) */
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}

/**
 * Render a component with userEvent pre-configured.
 *
 * Returns everything from RTL's render() plus a `user` instance
 * for realistic interaction testing (typing, clicking, etc.).
 *
 * @example
 * const { user, getByRole } = renderWithProviders(<MyForm />);
 * await user.type(getByRole('textbox'), 'Hello');
 * await user.click(getByRole('button', { name: /submit/i }));
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {}
) {
  const user = userEvent.setup();
  const renderResult = render(ui, options);

  return {
    user,
    ...renderResult,
  };
}

// Re-export commonly used utilities for convenient single-import
export { screen, waitFor, within, act } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

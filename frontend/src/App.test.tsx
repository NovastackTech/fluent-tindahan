import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { useAuthStore } from './state/authStore';

describe('App', () => {
  beforeEach(() => {
    useAuthStore.setState({ consentAccepted: true });
  });

  it('renders application with header, navigation, and default dashboard view', async () => {
    render(<App />);

    expect(screen.getByText(/Fluent Tindahan/i)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Bottom Navigation/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Bagong Benta|New Sale/i)).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { OfflineSyncBanner } from './OfflineSyncBanner';
import { sariSariLightTheme } from '../theme/theme';
import { useSyncStore } from '../sync/syncEngine';

describe('OfflineSyncBanner', () => {
  beforeEach(() => {
    useSyncStore.setState({
      isOnline: true,
      pendingCount: 0,
      deadLetterCount: 0,
      lastErrorMessage: null
    });
  });

  const renderBanner = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <OfflineSyncBanner />
      </FluentProvider>
    );
  };

  it('renders nothing when fully online and queue is clear', () => {
    const { container } = renderBanner();
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('renders offline warning when isOnline is false', () => {
    useSyncStore.setState({ isOnline: false });
    renderBanner();

    expect(screen.getByText(/Naka-offline|Offline/i)).toBeInTheDocument();
  });

  it('renders pending queue counter when online and pendingCount > 0', () => {
    useSyncStore.setState({ isOnline: true, pendingCount: 3 });
    renderBanner();

    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Puwersahing mag-sync|Force Sync/i })).toBeInTheDocument();
  });

  it('renders dead letter queue alert when deadLetterCount > 0', () => {
    useSyncStore.setState({ isOnline: true, deadLetterCount: 2 });
    renderBanner();

    expect(screen.getByText(/Dead Letter Queue \(2\)/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { sariSariLightTheme } from '../theme/theme';
import { PwaInstallBanner } from './PwaInstallBanner';
import { usePwaStore, type BeforeInstallPromptEvent } from '../state/pwaStore';

describe('PwaInstallBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    usePwaStore.setState({
      isStandalone: false,
      isInstalled: false,
      isInstallable: false,
      isIos: false,
      isDismissed: false,
      deferredPrompt: null
    });
  });

  const renderBanner = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <PwaInstallBanner />
      </FluentProvider>
    );
  };

  it('renders nothing when not installable and not iOS', () => {
    const { container } = renderBanner();
    expect(container.firstChild).toBeEmptyDOMElement();
    expect(screen.queryByText(/I-install ang Fluent Tindahan App|Install Fluent Tindahan App/i)).not.toBeInTheDocument();
  });

  it('renders nothing when already in standalone mode', () => {
    usePwaStore.setState({ isStandalone: true, isInstallable: true });
    const { container } = renderBanner();
    expect(container.firstChild).toBeEmptyDOMElement();
    expect(screen.queryByText(/I-install ang Fluent Tindahan App|Install Fluent Tindahan App/i)).not.toBeInTheDocument();
  });

  it('renders nothing when already installed', () => {
    usePwaStore.setState({ isInstalled: true, isInstallable: true });
    const { container } = renderBanner();
    expect(container.firstChild).toBeEmptyDOMElement();
    expect(screen.queryByText(/I-install ang Fluent Tindahan App|Install Fluent Tindahan App/i)).not.toBeInTheDocument();
  });

  it('renders nothing when dismissed by user', () => {
    usePwaStore.setState({ isInstallable: true, isDismissed: true });
    const { container } = renderBanner();
    expect(container.firstChild).toBeEmptyDOMElement();
    expect(screen.queryByText(/I-install ang Fluent Tindahan App|Install Fluent Tindahan App/i)).not.toBeInTheDocument();
  });

  it('renders banner with install button when isInstallable is true', () => {
    const mockPrompt = {
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
      prompt: vi.fn().mockResolvedValue(undefined)
    } as unknown as BeforeInstallPromptEvent;

    usePwaStore.setState({ isInstallable: true, deferredPrompt: mockPrompt });
    renderBanner();

    expect(screen.getByText(/I-install ang Fluent Tindahan App|Install Fluent Tindahan App/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I-install ang App|Install App/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mamaya na|Maybe later/i })).toBeInTheDocument();
  });

  it('calls promptInstall when clicking Install button', async () => {
    const promptFn = vi.fn().mockResolvedValue(undefined);
    const mockPrompt = {
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
      prompt: promptFn
    } as unknown as BeforeInstallPromptEvent;

    usePwaStore.setState({ isInstallable: true, deferredPrompt: mockPrompt });
    renderBanner();

    const installBtn = screen.getByRole('button', { name: /I-install ang App|Install App/i });
    fireEvent.click(installBtn);

    expect(promptFn).toHaveBeenCalledTimes(1);
  });

  it('dismisses banner when clicking dismiss button', () => {
    usePwaStore.setState({ isInstallable: true });
    const { container } = renderBanner();

    const dismissBtn = screen.getByRole('button', { name: /Mamaya na|Maybe later/i });
    fireEvent.click(dismissBtn);

    expect(usePwaStore.getState().isDismissed).toBe(true);
    expect(container.firstChild).toBeEmptyDOMElement();
    expect(screen.queryByText(/I-install ang Fluent Tindahan App|Install Fluent Tindahan App/i)).not.toBeInTheDocument();
  });

  it('renders iOS instructions when on iOS browser', () => {
    usePwaStore.setState({ isIos: true, isInstallable: false, isStandalone: false });
    renderBanner();

    expect(screen.getByText(/Share|Add to Home Screen/i)).toBeInTheDocument();
  });
});

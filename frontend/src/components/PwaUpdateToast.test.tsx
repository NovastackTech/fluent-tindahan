import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { sariSariLightTheme } from '../theme/theme';
import { PwaUpdateToast } from './PwaUpdateToast';
import { usePwaStore } from '../state/pwaStore';
import * as pwaRegister from '../pwa/registerServiceWorker';

describe('PwaUpdateToast', () => {
  beforeEach(() => {
    usePwaStore.setState({
      needRefresh: false
    });
  });

  const renderToast = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <PwaUpdateToast />
      </FluentProvider>
    );
  };

  it('renders nothing when needRefresh is false', () => {
    const { container } = renderToast();
    expect(container.firstChild).toBeEmptyDOMElement();
    expect(screen.queryByText(/May Bagong Bersyon ng App!|New App Version Available!/i)).not.toBeInTheDocument();
  });

  it('renders update banner when needRefresh is true', () => {
    usePwaStore.setState({ needRefresh: true });
    renderToast();

    expect(screen.getByText(/May Bagong Bersyon ng App!|New App Version Available!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i })).toBeInTheDocument();
  });

  it('triggers update reload when clicking update button', () => {
    const reloadSpy = vi.spyOn(pwaRegister, 'reloadAppForUpdate').mockResolvedValue(undefined);
    usePwaStore.setState({ needRefresh: true });
    renderToast();

    const updateBtn = screen.getByRole('button', { name: /I-reload para Mag-update|Reload & Update/i });
    fireEvent.click(updateBtn);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    reloadSpy.mockRestore();
  });

  it('dismisses toast when clicking dismiss button', () => {
    usePwaStore.setState({ needRefresh: true });
    renderToast();

    const dismissBtn = screen.getByRole('button', { name: /Mamaya na|Maybe later/i });
    fireEvent.click(dismissBtn);

    expect(usePwaStore.getState().needRefresh).toBe(false);
  });
});

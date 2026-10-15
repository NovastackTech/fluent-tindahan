import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { PrivacyConsentDialog } from './PrivacyConsentDialog';
import { sariSariLightTheme } from '../theme/theme';
import { useAuthStore } from '../state/authStore';
import { useTermsStore } from '../state/termsStore';

describe('PrivacyConsentDialog', () => {
  beforeEach(() => {
    useAuthStore.setState({ consentAccepted: false });
  });

  const renderDialog = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <PrivacyConsentDialog />
      </FluentProvider>
    );
  };

  it('renders consent dialog when consentAccepted is false and requires terms agreement', () => {
    renderDialog();

    expect(screen.getByText(/Republic Act No. 10173/i)).toBeInTheDocument();
    const checkbox = screen.getByTestId('privacy-terms-checkbox');
    expect(checkbox).toBeInTheDocument();

    const acceptBtn = screen.getByTestId('privacy-accept-btn');
    expect(acceptBtn).toBeDisabled();
  });

  it('accepting consent updates authStore with terms version and hides dialog', () => {
    const { rerender } = renderDialog();

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const acceptBtn = screen.getByTestId('privacy-accept-btn');
    expect(acceptBtn).not.toBeDisabled();
    fireEvent.click(acceptBtn);

    expect(useAuthStore.getState().consentAccepted).toBe(true);
    expect(useAuthStore.getState().termsAcceptedVersion).toBe('2026-10-14');

    rerender(
      <FluentProvider theme={sariSariLightTheme}>
        <PrivacyConsentDialog />
      </FluentProvider>
    );

    expect(screen.queryByText(/Republic Act No. 10173/i)).not.toBeInTheDocument();
  });

  it('renders read-only dialog with Close button when isPrivacyNoticeOpen is true and consent already accepted', () => {
    useAuthStore.setState({
      consentAccepted: true,
      termsAcceptedVersion: '2026-10-14',
      isPrivacyNoticeOpen: true
    });
    renderDialog();

    expect(screen.getByText(/Republic Act No. 10173/i)).toBeInTheDocument();
    expect(screen.queryByTestId('privacy-accept-btn')).not.toBeInTheDocument();
    expect(screen.getByText(/2026-10-14/)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Isara|Close/i });
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);

    expect(useAuthStore.getState().consentAccepted).toBe(true);
    expect(useAuthStore.getState().isPrivacyNoticeOpen).toBe(false);
  });

  it('opens terms when clicking view terms link and keeps checkbox unchecked', () => {
    renderDialog();

    const checkbox = screen.getByRole('checkbox');
    const termsLink = screen.getByTestId('privacy-view-terms-link');
    const acceptBtn = screen.getByTestId('privacy-accept-btn');

    expect(checkbox).not.toBeChecked();
    expect(acceptBtn).toBeDisabled();

    fireEvent.click(termsLink);

    expect(useTermsStore.getState().isTermsOpen).toBe(true);
    expect(checkbox).not.toBeChecked();
    expect(acceptBtn).toBeDisabled();
  });
});

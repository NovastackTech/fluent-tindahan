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

  it('renders consent dialog when consentAccepted is false', () => {
    renderDialog();

    expect(screen.getByText(/Republic Act No. 10173/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sumasang-ayon|I Agree/i })).toBeInTheDocument();
  });

  it('accepting consent updates authStore and hides dialog', () => {
    const { rerender } = renderDialog();

    const acceptBtn = screen.getByRole('button', { name: /Sumasang-ayon|I Agree/i });
    fireEvent.click(acceptBtn);

    expect(useAuthStore.getState().consentAccepted).toBe(true);

    rerender(
      <FluentProvider theme={sariSariLightTheme}>
        <PrivacyConsentDialog />
      </FluentProvider>
    );

    expect(screen.queryByText(/Republic Act No. 10173/i)).not.toBeInTheDocument();
  });

  it('renders read-only dialog with Close button when isPrivacyNoticeOpen is true and consent already accepted', () => {
    useAuthStore.setState({ consentAccepted: true, isPrivacyNoticeOpen: true });
    renderDialog();

    expect(screen.getByText(/Republic Act No. 10173/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sumasang-ayon|I Agree/i })).not.toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Isara|Close/i });
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);

    expect(useAuthStore.getState().consentAccepted).toBe(true);
    expect(useAuthStore.getState().isPrivacyNoticeOpen).toBe(false);
  });

  it('opens terms when clicking view terms link', () => {
    renderDialog();

    const termsLink = screen.getByTestId('privacy-view-terms-link');
    expect(termsLink).toBeInTheDocument();

    fireEvent.click(termsLink);
    expect(useTermsStore.getState().isTermsOpen).toBe(true);
  });
});

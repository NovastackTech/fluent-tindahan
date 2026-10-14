import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { DisclaimerModal } from './DisclaimerModal';
import { sariSariLightTheme } from '../theme/theme';
import { useDisclaimerStore } from '../state/disclaimerStore';
import { useTermsStore } from '../state/termsStore';
import { useLanguageStore } from '../state/languageStore';

describe('DisclaimerModal', () => {
  beforeEach(() => {
    useDisclaimerStore.setState({ isDisclaimerOpen: false });
    useLanguageStore.setState({ language: 'en' });
  });

  const renderModal = () => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <DisclaimerModal />
      </FluentProvider>
    );
  };

  it('renders nothing when isDisclaimerOpen is false', () => {
    renderModal();
    expect(screen.queryByTestId('disclaimer-modal')).not.toBeInTheDocument();
  });

  it('renders all sections and disclaimers when open in English', () => {
    useDisclaimerStore.setState({ isDisclaimerOpen: true });
    useLanguageStore.setState({ language: 'en' });
    renderModal();

    expect(screen.getByText('Important Notice & Usage Terms')).toBeInTheDocument();
    expect(screen.getByText(/Record-Keeping Tool, Not a BIR-Certified Register\./i)).toBeInTheDocument();
    expect(screen.getByText(/Merchant Legal & Tax Obligations\./i)).toBeInTheDocument();
    expect(screen.getByText(/Self-Reported Records & Non-Payment Processor\./i)).toBeInTheDocument();
    expect(screen.getByText(/Independent Retail Operations & Liability Limit\./i)).toBeInTheDocument();
    expect(screen.getByTestId('disclaimer-open-full-terms-btn')).toBeInTheDocument();
    expect(screen.getByTestId('disclaimer-open-full-terms-btn')).toHaveTextContent('Read Full Terms of Use & Acceptable Usage Policy (AUP)');
    expect(screen.queryByTestId('disclaimer-terms-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terms-detail-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('disclaimer-modal-x-btn')).toHaveAttribute('aria-label', 'Close');
    expect(screen.getByTestId('disclaimer-modal-close-btn')).toHaveTextContent('Understood & Close');
  });

  it('renders correctly localized in Tagalog/Filipino', () => {
    useDisclaimerStore.setState({ isDisclaimerOpen: true });
    useLanguageStore.setState({ language: 'tl' });
    renderModal();

    expect(screen.getByText('Mahalagang Paunawa at Paggamit')).toBeInTheDocument();
    expect(screen.getByText(/Kagamitan sa Pagtala, Hindi BIR-Certified Cash Register\./i)).toBeInTheDocument();
    expect(screen.getByText(/Pananagutan sa Batas, Permit, at Buwis\./i)).toBeInTheDocument();
    expect(screen.getByText(/Sariling Talaan at Hindi Tagaproseso ng Pondo\./i)).toBeInTheDocument();
    expect(screen.getByText(/Independiyenteng Negosyo at Hangganan ng Pananagutan\./i)).toBeInTheDocument();
    expect(screen.getByTestId('disclaimer-open-full-terms-btn')).toHaveTextContent('Basahin ang Buong Tuntunin at Patakaran (Terms of Use & AUP)');
    expect(screen.queryByTestId('disclaimer-terms-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terms-detail-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('disclaimer-modal-x-btn')).toHaveAttribute('aria-label', 'Isara');
    expect(screen.getByTestId('disclaimer-modal-close-btn')).toHaveTextContent('Naiintindihan Ko');
  });

  it('closes the modal when clicking the close button', () => {
    useDisclaimerStore.setState({ isDisclaimerOpen: true });
    renderModal();

    const closeBtn = screen.getByTestId('disclaimer-modal-close-btn');
    fireEvent.click(closeBtn);

    expect(useDisclaimerStore.getState().isDisclaimerOpen).toBe(false);
  });

  it('closes the modal when clicking the X button', () => {
    useDisclaimerStore.setState({ isDisclaimerOpen: true });
    renderModal();

    const xBtn = screen.getByTestId('disclaimer-modal-x-btn');
    fireEvent.click(xBtn);

    expect(useDisclaimerStore.getState().isDisclaimerOpen).toBe(false);
  });

  it('opens full TermsModal when clicking Read Full Terms link', () => {
    useDisclaimerStore.setState({ isDisclaimerOpen: true });
    renderModal();

    const fullTermsBtn = screen.getByTestId('disclaimer-open-full-terms-btn');
    expect(fullTermsBtn).toBeInTheDocument();
    fireEvent.click(fullTermsBtn);

    expect(useTermsStore.getState().isTermsOpen).toBe(true);
  });
});

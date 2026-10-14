import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { FluentProvider } from '@fluentui/react-components';
import { sariSariLightTheme } from '../theme/theme';
import { TermsModal } from './TermsModal';
import { useTermsStore } from '../state/termsStore';
import { useLanguageStore } from '../state/languageStore';
import {
  termsEN,
  termsTL,
  CURRENT_TERMS_VERSION,
  TERMS_EFFECTIVE_DATE_EN,
  TERMS_EFFECTIVE_DATE_TL
} from '../legal/termsData';

const renderModal = () =>
  render(
    <FluentProvider theme={sariSariLightTheme}>
      <TermsModal />
    </FluentProvider>
  );

describe('TermsModal', () => {
  beforeEach(() => {
    useTermsStore.setState({ isTermsOpen: false });
    useLanguageStore.setState({ language: 'tl' });
  });

  it('does not render dialog content when closed', () => {
    renderModal();
    expect(screen.queryByTestId('terms-modal')).not.toBeInTheDocument();
  });

  it('renders modal with Tagalog content by default when language is tl', () => {
    useTermsStore.setState({ isTermsOpen: true });
    renderModal();

    expect(screen.getByTestId('terms-modal')).toBeInTheDocument();
    expect(
      screen.getAllByText(/Mga Tuntunin sa Paggamit at Patakaran sa Katanggap-tanggap na Paggamit/i)[0]
    ).toBeInTheDocument();
    expect(screen.getByText(/Mahalagang Paalala para sa mga May-ari ng Tindahan/i)).toBeInTheDocument();
    expect(
      screen.getByText(/ANG FLUENT TINDAHAN AY HINDI BIR-ACCREDITED NA POINT-OF-SALE/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Pagbabawal sa "Pamamahiya sa Utang"/i)).toBeInTheDocument();
  });

  it('renders English content when language is en', () => {
    useLanguageStore.setState({ language: 'en' });
    useTermsStore.setState({ isTermsOpen: true });
    renderModal();

    expect(
      screen.getAllByText(/Terms of Use & Acceptable Usage Policy/i)[0]
    ).toBeInTheDocument();
    expect(screen.getByText(/Quick Summary for Store Owners/i)).toBeInTheDocument();
    expect(
      screen.getByText(/FLUENT TINDAHAN IS NOT A BIR-ACCREDITED POINT-OF-SALE/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Prohibition on "Debt Shaming"/i)).toBeInTheDocument();
  });

  it('allows toggling between Tagalog and English within the modal', () => {
    useTermsStore.setState({ isTermsOpen: true });
    renderModal();

    // Starts in Tagalog
    expect(screen.getByText(/Mahalagang Paalala para sa mga May-ari ng Tindahan/i)).toBeInTheDocument();

    // Click language toggle button
    const toggleBtn = screen.getByTestId('terms-lang-toggle-btn');
    expect(toggleBtn).toHaveTextContent('English');
    fireEvent.click(toggleBtn);

    // Switches to English
    expect(screen.getByText(/Quick Summary for Store Owners/i)).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('Tagalog');

    // Click back to Tagalog
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Mahalagang Paalala para sa mga May-ari ng Tindahan/i)).toBeInTheDocument();
  });

  it('closes the modal when clicking the close button', () => {
    useTermsStore.setState({ isTermsOpen: true });
    renderModal();

    const closeBtn = screen.getByTestId('terms-close-btn');
    fireEvent.click(closeBtn);

    expect(useTermsStore.getState().isTermsOpen).toBe(false);
  });

  it('closes the modal when clicking the X button', () => {
    useTermsStore.setState({ isTermsOpen: true });
    renderModal();

    const xBtn = screen.getByTestId('terms-x-btn');
    fireEvent.click(xBtn);

    expect(useTermsStore.getState().isTermsOpen).toBe(false);
  });

  it('displays Section 11 In-App User Acknowledgment text', () => {
    useTermsStore.setState({ isTermsOpen: true });
    renderModal();

    expect(
      screen.getByText(/Nabasa at sinasang-ayunan ko ang Mga Tuntunin sa Paggamit/i)
    ).toBeInTheDocument();
  });

  it('exposes the single-source-of-truth version and effective dates', () => {
    expect(termsEN.version).toBe(CURRENT_TERMS_VERSION);
    expect(termsTL.version).toBe(CURRENT_TERMS_VERSION);
    expect(termsEN.effectiveDate).toBe(TERMS_EFFECTIVE_DATE_EN);
    expect(termsTL.effectiveDate).toBe(TERMS_EFFECTIVE_DATE_TL);
    expect(CURRENT_TERMS_VERSION).toBe('2026-10-14');
  });
});

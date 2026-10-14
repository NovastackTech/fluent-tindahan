import { describe, it, expect, beforeEach } from 'vitest';
import { useTermsStore } from './termsStore';

describe('useTermsStore', () => {
  beforeEach(() => {
    useTermsStore.setState({ isTermsOpen: false });
  });

  it('initializes with isTermsOpen as false', () => {
    expect(useTermsStore.getState().isTermsOpen).toBe(false);
  });

  it('opens terms when openTerms is called', () => {
    useTermsStore.getState().openTerms();
    expect(useTermsStore.getState().isTermsOpen).toBe(true);
  });

  it('closes terms when closeTerms is called', () => {
    useTermsStore.setState({ isTermsOpen: true });
    useTermsStore.getState().closeTerms();
    expect(useTermsStore.getState().isTermsOpen).toBe(false);
  });
});

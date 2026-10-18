import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { sariSariLightTheme } from '../theme/theme';
import { AuthErrorBanner } from './AuthErrorBanner';

describe('AuthErrorBanner', () => {
  const renderBanner = (props: React.ComponentProps<typeof AuthErrorBanner>) => {
    return render(
      <FluentProvider theme={sariSariLightTheme}>
        <AuthErrorBanner {...props} />
      </FluentProvider>
    );
  };

  it('renders nothing when authErrors is empty', () => {
    renderBanner({ authErrors: [] });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders single error message', () => {
    renderBanner({
      authErrors: ['Invalid email address']
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Invalid email address');
  });

  it('renders multiple bulleted error messages', () => {
    renderBanner({
      authErrors: ['First error', 'Second error']
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('• First error');
    expect(alert).toHaveTextContent('• Second error');
  });

  it('renders switch to password button and triggers callback when clicked', () => {
    const onSwitch = vi.fn();
    renderBanner({
      authErrors: ['PIN error'],
      showSwitchToPassword: true,
      onSwitchToPassword: onSwitch,
      switchToPasswordTestId: 'test-switch-btn'
    });

    const switchBtn = screen.getByTestId('test-switch-btn');
    expect(switchBtn).toBeInTheDocument();
    fireEvent.click(switchBtn);
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });
});

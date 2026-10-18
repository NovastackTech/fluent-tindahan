import React from 'react';
import { tokens, Text, Button } from '@fluentui/react-components';
import { LockClosedRegular } from '@fluentui/react-icons';
import { getLocalizedSyncErrorMessage } from '../utils/syncErrors';

export interface AuthErrorBannerProps {
  authErrors: string[];
  language?: 'tl' | 'en';
  errorSummaryRef?: React.RefObject<HTMLDivElement | null>;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  testId?: string;
  textClassName?: string;
  showSwitchToPassword?: boolean;
  onSwitchToPassword?: () => void;
  switchToPasswordText?: string;
  switchToPasswordTestId?: string;
}

export const AuthErrorBanner: React.FC<AuthErrorBannerProps> = ({
  authErrors,
  language = 'tl',
  errorSummaryRef,
  containerClassName,
  containerStyle,
  testId,
  textClassName,
  showSwitchToPassword,
  onSwitchToPassword,
  switchToPasswordText,
  switchToPasswordTestId = 'login-switch-to-password-btn'
}) => {
  if (authErrors.length === 0) return null;

  const defaultStyle: React.CSSProperties = {
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    marginBottom: tokens.spacingVerticalM,
    fontSize: tokens.fontSizeBase200
  };

  return (
    <div
      role="alert"
      tabIndex={-1}
      ref={errorSummaryRef}
      className={containerClassName}
      style={containerStyle || (containerClassName ? undefined : defaultStyle)}
      data-testid={testId}
    >
      {authErrors.length === 1 ? (
        <Text weight="semibold" className={textClassName} style={{ display: 'block' }}>
          {getLocalizedSyncErrorMessage(authErrors[0], language) || authErrors[0]}
        </Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {authErrors.map((err, idx) => (
            <Text key={idx} weight="semibold" className={textClassName} style={{ display: 'block' }}>
              • {getLocalizedSyncErrorMessage(err, language) || err}
            </Text>
          ))}
        </div>
      )}

      {showSwitchToPassword && onSwitchToPassword && (
        <div style={{ marginTop: '8px' }}>
          <Button
            appearance="subtle"
            size="small"
            icon={<LockClosedRegular />}
            onClick={onSwitchToPassword}
            data-testid={switchToPasswordTestId}
          >
            {switchToPasswordText || (language === 'tl' ? 'Mag-login gamit ang Password' : 'Log in using Password')}
          </Button>
        </div>
      )}
    </div>
  );
};


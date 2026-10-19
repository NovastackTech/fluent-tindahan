import React, { useState } from 'react';
import { Button, Spinner, makeStyles, tokens } from '@fluentui/react-components';
import { useGoogleLogin } from '@react-oauth/google';
import { useTranslation } from '../state/languageStore';

const useStyles = makeStyles({
  button: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalS,
    fontWeight: tokens.fontWeightSemibold,
  },
  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    flexShrink: 0,
  },
});

export const GoogleLogoSvg: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
    />
  </svg>
);

export interface GoogleAuthButtonProps {
  mode?: 'login' | 'register';
  onSuccess: (tokenResponse: { access_token: string }) => void | Promise<void>;
  onError?: (error: unknown) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  dataTestId?: string;
  size?: 'small' | 'medium' | 'large';
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  mode = 'login',
  onSuccess,
  onError,
  disabled = false,
  style,
  dataTestId = 'google-auth-button',
  size = 'large',
}) => {
  const styles = useStyles();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const labelText = mode === 'register' ? t.login.signUpWithGoogle : t.login.continueWithGoogle;

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        await onSuccess(tokenResponse);
      } catch (err) {
        onError?.(err);
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      setIsLoading(false);
      onError?.(error);
    },
  });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled || isLoading) return;
    try {
      triggerGoogleLogin();
    } catch (err) {
      onError?.(err);
    }
  };

  return (
    <Button
      type="button"
      appearance="outline"
      size={size}
      className={styles.button}
      style={style}
      disabled={disabled || isLoading}
      icon={
        isLoading ? (
          <Spinner size="extra-tiny" />
        ) : (
          <span className={styles.icon}>
            <GoogleLogoSvg size={18} />
          </span>
        )
      }
      onClick={handleClick}
      data-testid={dataTestId}
      aria-label={labelText}
    >
      {labelText}
    </Button>
  );
};

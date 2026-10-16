# Google Identity Integration Plan for `fluent-tindahan`

## 1. Project Context & Architecture Overview
Based on the project name (`fluent-tindahan`) and the presence of Keyborg in your test environment, this plan is architected for a **React + TypeScript** frontend utilizing **Fluent UI v9 (`@fluentui/react-components`)**. 

To maintain total control over your Fluent UI design system (and avoid clunky, un-styled third-party iframes), we will use `@react-oauth/google` with its **Custom Hook (`useGoogleLogin`)** tied directly to a Fluent UI `<Button>` component.

### Authentication Flow
1. **Frontend:** User clicks a Fluent UI "Continue with Google" button.
2. **Google OAuth:** A Google consent popup opens; the user selects their account.
3. **Token Retrieval:** Google returns an `access_token` or `authorization_code` (or ID Token JWT) to the React client.
4. **Backend Verification (Tindahan API):** The frontend sends this token to your backend API. The backend verifies the token with Google's servers, checks if the user exists in your database, creates a new store/customer account if they don't ("Sign Up"), and returns a session cookie or application JWT.
5. **State Update:** The frontend stores the session and updates the AuthContext.

---

## 2. Phase 1: Google Cloud Console Setup
Before writing code, you need to register `fluent-tindahan` with Google Cloud.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named **`fluent-tindahan`**.
3. Navigate to **APIs & Services > OAuth consent screen**:
   * Select **External** user type.
   * Fill in the App Name (*Fluent Tindahan*), user support email, and developer contact info.
   * Add Scopes: `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `openid`.
4. Navigate to **APIs & Services > Credentials**:
   * Click **Create Credentials > OAuth client ID**.
   * Application type: **Web application**.
   * **Authorized JavaScript origins:** Add your local dev server (e.g., `http://localhost:5173` for Vite or `http://localhost:3000` for CRA/Next) and your production URL.
   * **Authorized redirect URIs:** Add `http://localhost:5173` (and any backend callback URI if using the auth-code flow).
5. Copy the generated **Client ID** and add it to your project's `.env` file:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

---

## 3. Phase 2: Frontend Implementation (`D:\Projects\fluent-tindahan`)

### Step 1: Install Dependencies
Install the official Google Identity Services wrapper for React:
```bash
npm install @react-oauth/google
```

### Step 2: Configure the OAuth Provider
Wrap your application root (alongside your Fluent UI `<FluentProvider>`) in `src/main.tsx` or `src/App.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <FluentProvider theme={webLightTheme}>
        <App />
      </FluentProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
```

### Step 3: Build a Fluent UI Google Sign-Up/Sign-In Button
Create a reusable component at `src/features/auth/components/GoogleAuthButton.tsx` that matches the Fluent UI v9 design language:

```tsx
import React, { useState } from 'react';
import { Button, Spinner, makeStyles } from '@fluentui/react-components';
import { useGoogleLogin } from '@react-oauth/google';

const useStyles = makeStyles({
  googleButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
});

const GoogleLogoSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
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

export const GoogleAuthButton: React.FC = () => {
  const styles = useStyles();
  const [isLoading, setIsLoading] = useState(false);

  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        // Send the access_token to your backend for verification & user creation
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: tokenResponse.access_token }),
        });
        
        const data = await response.json();
        // TODO: Update your AuthContext or Redux store with `data.user` and `data.token`
      } catch (error) {
        console.error('Failed to authenticate with Tindahan backend:', error);
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google Login Failed:', error);
      setIsLoading(false);
    },
  });

  return (
    <Button
      appearance="outline"
      size="large"
      className={styles.googleButton}
      icon={isLoading ? <Spinner size="tiny" /> : <GoogleLogoSvg />}
      disabled={isLoading}
      onClick={() => loginWithGoogle()}
    >
      {isLoading ? 'Signing in...' : 'Continue with Google'}
    </Button>
  );
};
```

---

## 4. Phase 3: Backend & Database Strategy ("Sign Up" vs. "Sign In")
With OAuth, **Sign Up** and **Sign In** are handled by the exact same flow ("Upsert" logic).

### 1. Database Schema (`Users` Table/Collection)
Ensure your user model supports external identity providers:
* `id` (UUID / Primary Key)
* `email` (String, Unique, Indexed)
* `google_id` (String, Nullable, Unique) — *The `sub` field from Google's payload*
* `full_name` (String)
* `avatar_url` (String, Nullable)
* `password_hash` (String, **Nullable** — Google users won't have a local password initially)
* `role` (Enum: `CUSTOMER`, `MERCHANT`, `ADMIN`)
* `is_onboarded` (Boolean) — *Crucial for `fluent-tindahan` if new users need to set up their store profile or delivery address after signing up.*

### 2. Backend Endpoint Logic (`POST /api/auth/google`)
1. Receive `accessToken` (or `idToken`) from the React frontend.
2. Fetch user profile from `https://www.googleapis.com/oauth2/v3/userinfo` using the token (or verify the JWT using `google-auth-library` / `.NET Google.Apis.Auth`).
3. **Account Linking & Creation Check:**
   * **Case A (`google_id` exists in DB):** Existing user. Issue session/JWT and log them in.
   * **Case B (`email` exists in DB, but `google_id` is null):** The user previously signed up with email/password. Update their record with `google_id` and `avatar_url` (since Google verifies emails), then log them in.
   * **Case C (Neither exists):** **New Sign Up!** Create a new user record with `is_onboarded = false`, issue a session/JWT, and return an `isNewUser: true` flag to the frontend so you can redirect them to a "Complete Your Tindahan Profile" onboarding page.

---

## 5. Phase 4: Testing Strategy (Avoiding Keyborg Issues!)
Since you are writing automated unit/integration tests where Fluent UI's `Keyborg` is active:
1. **Mock `@react-oauth/google`:** Never load the real Google script inside Jest/Vitest, as it injects external `<script>` tags into JSDOM and causes async teardown issues.
2. Example Vitest/Jest mock in your test setup file (`src/setupTests.ts`):
   ```tsx
   vi.mock('@react-oauth/google', () => ({
     GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
     useGoogleLogin: vi.fn((options) => () => {
       // Simulate immediate successful Google login when button is clicked in tests
       options.onSuccess({ access_token: 'mock-google-access-token' });
     }),
   }));
   ```

---

## 6. Implementation Checklist
- [ ] Create Google Cloud Project & obtain OAuth Client ID.
- [ ] Add `VITE_GOOGLE_CLIENT_ID` to `.env.development` and `.env.production`.
- [ ] Install `@react-oauth/google` in `D:\Projects\fluent-tindahan`.
- [ ] Wrap root component with `<GoogleOAuthProvider>`.
- [ ] Build `<GoogleAuthButton />` using Fluent UI `<Button>` and `useGoogleLogin`.
- [ ] Implement `/api/auth/google` backend verification & user upsert logic.
- [ ] Add post-signup onboarding redirect for new Tindahan users (`isNewUser: true`).
- [ ] Add unit test mocks for `@react-oauth/google`.
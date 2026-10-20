# Email OTP Verification, Disposable Email Blocking, & Unverified Account Overwrite

## Summary of Changes

1. **6-Digit OTP Email Verification (Non-OAuth Signups)**
   - Users signing up via `POST /api/auth/register` are created with `EmailVerified = false` and receive a CSPRNG-generated 6-digit OTP (`RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6")`) hashed with SHA-256 (`{UserId}:{NormalizedEmail}:{Otp}`) and a 10-minute expiry (`EmailOtpExpiresAt`).
   - Added `POST /api/auth/verify-email-otp` (5-attempt cap per code) and `POST /api/auth/resend-email-otp` (60-second resend cooldown).
   - `POST /api/auth/login` and `POST /api/auth/login-pin` return `emailVerified` and `requiresEmailVerification` in `AuthResponseDto` (and re-issue an OTP if expired) so unverified non-OAuth accounts must complete the 6-digit OTP step in `LoginPage` / `OnboardingModal` before entering the POS.

2. **Re-Verification on Email Changes**
   - `PUT /api/auth/profile` sets `EmailVerified = false`, issues and dispatches a new 6-digit OTP to the updated email address, revokes other active device sessions, and returns `RequiresEmailVerification = true` whenever the user's normalized email changes.

3. **Disposable Email Provider Blocking (API & Client)**
   - `AuthEmailNormalizer.IsDisposableEmail` blocks disposable email domains and their subdomains (`mailinator.com`, `yopmail.com`, `10minutemail.com`, `guerrillamail.com`, `temp-mail.org`, `sharklasers.com`, `trashmail.com`, `maildrop.cc`, etc.) with `400 Bad Request` across `POST /api/auth/register`, `PUT /api/auth/profile`, and `POST /api/auth/google`.
   - Mirrored in `frontend/src/utils/registrationValidation.ts` (`isDisposableEmail`) for immediate form validation.

4. **Never Auto-Merge Unverified Accounts on Google OAuth**
   - In `POST /api/auth/google`, if an account already exists with `NormalizedEmail` where `EmailVerified == false` and a user authenticates via Google OAuth (`email_verified: true`):
     - Overwrites credentials on the unverified account (`PasswordHash = string.Empty`, `PinHash = null`, clears all OTP fields, resets lockouts).
     - Invalidates all prior sessions by setting `SessionsInvalidatedAt = now` (enforced in `JwtBearerEvents.OnTokenValidated` against token `iat`) and revoking all refresh tokens via `AuthRefreshTokenHelper.RevokeAllForUserAsync`.
     - Links `FirebaseUid = "google:{Subject}"` and marks `EmailVerified = true`.

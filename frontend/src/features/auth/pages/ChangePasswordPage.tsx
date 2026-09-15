/* ChangePasswordPage.tsx — FE-13 (closes the FE-03 gap)
 *
 * SRS §1: "Password should not be stored in the browser." Nothing here keeps a
 * password in state beyond the form, and nothing writes one to storage. The new
 * password is held only long enough to submit it.
 *
 * Two backend behaviours shape this screen:
 *
 * 1. A wrong current password is a **VALIDATION_ERROR** carrying a
 *    `currentPassword` field detail, not `UNAUTHENTICATED`. That distinction
 *    matters: `apiClient` reacts to `UNAUTHENTICATED` by clearing auth and
 *    bouncing to the login screen, so if the backend still returned it here a
 *    single typo would end the session. The error is therefore rendered on the
 *    field, and the session survives.
 * 2. `auth.changePassword` succeeds with `{ok: true}` and **no `data`**, so
 *    there is nothing to read back — the page reports success and navigates.
 *
 * The action also revokes the user's *other* sessions server-side
 * (AuthService.gs:565), so the confirmation says so rather than leaving the user
 * to discover it on another device.
 *
 * Password rules come from `AuthService.validatePassword`: a minimum length, and
 * the password may not equal the username or email. The server is authoritative;
 * the checks here only prevent an obviously-doomed round trip. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { FormField } from '@/components/ui/FormField';
import { toastStore } from '@/state/toastStore';
import { authStore } from '@/state/authStore';
import { getFirstPermittedRoute } from '@/lib/permission';
import * as authService from '@/services/authService';
import { ApiClientError } from '@/types/api';

/** Mirrors `AuthService.gs:18` so the hint is honest before a round trip.
 * The server validates independently and its message always wins. */
const MIN_PASSWORD_LENGTH = 4;

export default function ChangePasswordPage() {
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);

  const user = authStore.user;

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const sameAsUsername =
    newPassword.length > 0 &&
    (newPassword.toLowerCase() === (user?.username ?? '').toLowerCase() ||
      newPassword.toLowerCase() === (user?.email ?? '').toLowerCase());

  const incomplete =
    !currentPassword || !newPassword || !confirmPassword || mismatch || tooShort || sameAsUsername;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setCurrentPasswordError(null);

    try {
      await authService.changePassword(currentPassword, newPassword);

      /* The password is no longer needed anywhere — drop it before navigating. */
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      toastStore.add(
        'success',
        'Password changed. Your other sessions have been signed out.',
      );

      /* `mustChangePassword` was cleared server-side, so the profile in the store
       * is now stale in that one field. Refresh it before routing, otherwise a
       * guard that reads it would send the user straight back here. */
      try {
        const fresh = await authService.me();
        if (authStore.token) { authStore.setAuth(authStore.token, fresh); }
      } catch {
        /* A failed refresh must not block the redirect — the password did change. */
      }

      navigate(getFirstPermittedRoute(authStore.user?.permissions ?? []), { replace: true });
    } catch (err) {
      const fieldError =
        err instanceof ApiClientError
          ? err.details?.find((detail) => detail.field === 'currentPassword')?.message
          : undefined;

      if (fieldError) {
        setCurrentPasswordError(fieldError);
      } else {
        setError(err instanceof Error ? err.message : 'Could not change the password');
      }
      setCurrentPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Change password"
        subtitle={user?.username ? `Signed in as ${user.username}` : undefined}
      />

      {user?.mustChangePassword && (
        <div className="hs-mb-4">
          <Alert variant="warning">
            <span>Your account still uses a temporary password. Choose a new one to continue.</span>
          </Alert>
        </div>
      )}

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} noValidate style={{ maxWidth: '28rem' }}>
            {error && (
              <div className="hs-mb-4">
                <Alert variant="danger">
                  <span>{error}</span>
                </Alert>
              </div>
            )}

            <FormField
              label="Current password"
              required
              error={currentPasswordError ?? undefined}
            >
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                disabled={busy}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </FormField>

            <div className="hs-mt-4">
              <FormField
                label="New password"
                required
                hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                error={
                  tooShort
                    ? `Must be at least ${MIN_PASSWORD_LENGTH} characters.`
                    : sameAsUsername
                      ? 'Cannot be the same as your username or email.'
                      : undefined
                }
              >
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  disabled={busy}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </FormField>
            </div>

            <div className="hs-mt-4">
              <FormField
                label="Confirm new password"
                required
                error={mismatch ? 'The two passwords do not match.' : undefined}
              >
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  disabled={busy}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </FormField>
            </div>

            <p className="hs-field__hint hs-mt-4">
              Changing your password signs you out of all other devices.
            </p>

            <div className="hs-flex hs-justify-end hs-gap-2 hs-mt-5">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={busy} disabled={incomplete}>
                Change password
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

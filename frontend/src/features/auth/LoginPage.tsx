import { Eye, EyeOff, LockKeyhole, Store } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiError } from '../../lib/api/client';
import { login } from '../../lib/api/auth.api';

interface RedirectState {
  from?: {
    pathname?: string;
    search?: string;
  };
}

function getRedirectPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return '/';
  }
  const from = (state as RedirectState).from;
  if (!from?.pathname?.startsWith('/') || from.pathname.startsWith('//')) {
    return '/';
  }
  return `${from.pathname}${from.search ?? ''}`;
}

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    try {
      await login(email.trim(), password);
      navigate(getRedirectPath(location.state), { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setErrorMessage('The email or password is incorrect.');
      } else if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Sign in failed. Check your connection and try again.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm">
            <Store size={23} />
          </span>
          <p className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
            ShopEase POS
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Sign in to your workspace
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Use your POS account to access your products, categories, and sales.
          </p>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              {errorMessage}
            </div>
          )}

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Email address
            <Input
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-10"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Password
            <span className="relative block">
              <LockKeyhole
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="h-10 pl-9 pr-11"
              />
              <button
                type="button"
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                onClick={() => setPasswordVisible((visible) => !visible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          <Button type="submit" disabled={submitting} className="h-10 w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>

          <p className="text-center text-xs leading-5 text-slate-400">
            Your sign-in is verified by the POS server. Your access token is
            stored in this browser to authorize API requests.
          </p>
        </form>
      </section>
    </main>
  );
}

import { LoginForm } from '@/../components/LoginForm';

export default function LoginPage() {
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim());
  return <LoginForm googleEnabled={googleEnabled} />;
}

import { ResetPasswordForm } from './reset-password-form';

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = (await searchParams) ?? {};

  return (
    <main>
      <h1>Reset password</h1>
      <p>Set a new password for your Knokio Direct account.</p>
      <ResetPasswordForm token={params.token ?? ''} />
    </main>
  );
}

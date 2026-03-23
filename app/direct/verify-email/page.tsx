import React from 'react';
import { VerifyEmailForm } from './verify-email-form';

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = (await searchParams) ?? {};

  return (
    <main>
      <h1>Verify email</h1>
      <p>Confirm your email to activate password login for Knokio Direct.</p>
      <VerifyEmailForm token={params.token ?? ''} />
    </main>
  );
}

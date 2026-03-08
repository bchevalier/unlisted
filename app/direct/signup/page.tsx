import Link from 'next/link';
import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <main>
      <h1>Create Keeper account</h1>
      <p>Create your account and first Knokio Direct door.</p>
      <p>
        Paid doors are optimized for product placement and paid advisory access with unlimited paid reaches.
      </p>
      <SignupForm />
      <p>
        Already have an account? <Link href="/direct/login">Sign in</Link>
      </p>
    </main>
  );
}

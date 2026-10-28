import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata = {
  title: 'Support | Oasis Learning Centre',
  description:
    'Get help signing in, ask about your data, or request deletion of your Oasis account.',
} satisfies Metadata;

const SUPPORT_EMAIL = 'support@faithfulsoftware.dev';

export default function SupportPage() {
  return (
    <>
      <p className="legal__eyebrow">Support</p>
      <h1>We will help you get back in</h1>
      <p className="legal__lede">
        Email us and a person will reply. Tell us your name and the email address your invitation
        went to, so we can find your account.
      </p>
      <a className="legal__button" href={`mailto:${SUPPORT_EMAIL}?subject=Oasis%20support`}>
        Email {SUPPORT_EMAIL}
      </a>

      <h2>Signing in</h2>
      <p>
        Accounts are created by Oasis. You sign in with the email address your invitation was sent
        to. There is no public sign-up.
      </p>
      <ul>
        <li>Use the reset link on the sign-in screen if you have forgotten your password.</li>
        <li>If no invitation arrived, check your spam folder, then ask us to resend it.</li>
        <li>If the app says your access has been revoked, Oasis has deactivated the account.</li>
      </ul>

      <h2>Locking a child&rsquo;s account</h2>
      <p>
        Parents and carers can lock a child&rsquo;s portal at any time in the Oasis app, and unlock
        it again when they choose. The same screen sets daily usage limits and off-limit days.
      </p>

      <h2>Deleting your account</h2>
      <p>
        In the Oasis app, parents can request deletion of their own account from Profile, and of a
        child&rsquo;s account from Settings. Oasis reviews each request and confirms with you. You
        can cancel a request any time before it is approved. If you are staff or a student aged 18
        or over, email us from the address on the account and we will start the request for you.
      </p>
      <div className="legal__card">
        <p>
          Oasis must keep some records, such as attendance, safeguarding and audit history. When a
          request is approved the account can no longer sign in, and those records are kept. See the{' '}
          <Link href="/privacy#keeping">privacy policy</Link> for what is kept and why.
        </p>
      </div>

      <h2>Questions about your data</h2>
      <p>
        You can ask to see, correct or erase the information we hold, or object to how it is used.
        Email us with what you need. Details are in the{' '}
        <Link href="/privacy#rights">privacy policy</Link>.
      </p>
    </>
  );
}

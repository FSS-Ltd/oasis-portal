import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy policy | Oasis Learning Centre',
  description:
    'What the Oasis portal and mobile app collect, why, who sees it and how to exercise your rights.',
} satisfies Metadata;

export default function PrivacyPage() {
  return (
    <>
      <p className="legal__eyebrow">Privacy policy</p>
      <h1>How Oasis handles your family&rsquo;s information</h1>
      <p className="legal__lede">
        The Oasis portal and mobile app hold records about children. We collect only what Oasis
        needs to run, and we do not track you or show advertising.
      </p>
      <p className="legal__meta">Applies to the Oasis website and the Oasis mobile app.</p>

      <h2>Who is responsible</h2>
      <p>
        Oasis Learning Centre decides what is collected and why. FSS Ltd builds and runs the portal
        on behalf of Oasis. Contact us at{' '}
        <a href="mailto:support@faithfulsoftware.dev">support@faithfulsoftware.dev</a>.
      </p>

      <h2 id="collect">What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> name, email address and a user ID, for parents, staff
          and students invited by Oasis.
        </li>
        <li>
          <strong>Student records:</strong> attendance, behaviour, academic progress, fees and the
          Oasis calendar, shown to the linked parent or the staff member who needs them.
        </li>
        <li>
          <strong>Messages:</strong> messages between parents and staff sent through the app.
        </li>
      </ul>
      <p>
        We do not collect your location, contacts, health information or browsing history. The app
        has no advertising or analytics tracking and does not use identifiers to follow you across
        other apps.
      </p>

      <h2>Why we use it</h2>
      <p>
        Only to provide the portal: signing you in, showing the right records to the right person,
        and letting families and staff talk to each other. We do not sell it or share it for
        advertising.
      </p>

      <h2>Who sees it</h2>
      <p>
        Parents see their own children. Staff see the children they work with. Some staff roles can
        manage accounts, and those actions are written to an audit log. Sensitive personal fields
        are encrypted in the database and data is encrypted in transit.
      </p>
      <p>The service runs on a small number of suppliers that process data for us:</p>
      <ul>
        <li>Clerk, for sign-in.</li>
        <li>Supabase, for the database, hosted in the EU.</li>
        <li>Vercel, for hosting the website and API.</li>
        <li>Sentry, for error reports so we can fix faults.</li>
      </ul>

      <h2 id="keeping">How long we keep it</h2>
      <p>
        Records stay while a child attends Oasis and afterwards for as long as Oasis is required to
        keep them. Attendance, safeguarding and audit history are kept even when an account is
        deleted, because Oasis has legal duties to keep them. Deleting an account stops that person
        signing in; it does not erase those records.
      </p>

      <h2 id="rights">Your rights</h2>
      <p>
        Under UK GDPR you can ask to see the information we hold, have mistakes corrected, ask for
        it to be erased where the law allows, and object to how it is used. Email{' '}
        <a href="mailto:support@faithfulsoftware.dev">support@faithfulsoftware.dev</a> and we will
        reply. To delete your account, follow the steps on the{' '}
        <Link href="/support">support page</Link>.
      </p>
      <p>
        If you are not happy with our answer, you can complain to the Information
        Commissioner&rsquo;s Office at <a href="https://ico.org.uk">ico.org.uk</a>.
      </p>

      <h2>Children</h2>
      <p>
        A student&rsquo;s login is set up by Oasis staff or by the child&rsquo;s parent or carer.
        Students cannot sign themselves up. A parent or carer can lock the child&rsquo;s portal at
        any time, reset their password, set daily usage limits and choose off-limit days from the
        Oasis app. Parents can also ask Oasis about any record held on their child.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we will tell families through the app.</p>
    </>
  );
}

import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ContactHelpLineStatic } from '@/components/contact-phone'
import { getContactPhone } from '@/lib/contact-phone'

export const metadata: Metadata = {
  title: 'Privacy Policy | NMB Staffing Portal',
  description:
    'How National Mobile Billboards LLC (NMB Media) collects, uses, and protects information in the NMB Staffing Portal.',
}

const EFFECTIVE_DATE = 'May 7, 2026'

export default async function PrivacyPolicyPage() {
  const contactPhone = await getContactPhone()
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="inline-block">
            <Image
              src="/logo.jpg"
              alt="NMB Media"
              width={180}
              height={72}
              className="h-12 w-auto object-contain"
              priority
            />
          </Link>
          <nav className="text-sm space-x-4">
            <Link href="/" className="text-primary-400 hover:text-primary-500">
              Sign in
            </Link>
            <Link href="/terms" className="text-primary-400 hover:text-primary-500">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <article className="max-w-3xl mx-auto text-gray-800 leading-relaxed">
          <h1 className="text-3xl sm:text-4xl font-bold text-heading">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Effective {EFFECTIVE_DATE}</p>

          <p className="mt-6">
            This Privacy Policy explains how National Mobile Billboards LLC, doing business as
            NMB Media (&ldquo;NMB&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), collects, uses, shares, and protects
            personal information in connection with the NMB Brand Ambassador Staffing Portal at{' '}
            <a className="text-primary-500 underline" href="https://staffing.nmbmedia.com">
              staffing.nmbmedia.com
            </a>{' '}
            (the &ldquo;Service&rdquo;). By using the Service, you agree to this Policy.
          </p>

          <Section title="1. Who we are">
            <p>
              National Mobile Billboards LLC<br />
              5101 NW 21st Ave, Ste 340<br />
              Ft. Lauderdale, FL 33309-2722<br />
              Email:{' '}
              <a className="text-primary-500 underline" href="mailto:privacy@nmbmedia.com">
                privacy@nmbmedia.com
              </a>
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p>We collect the following categories of information:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Account information:</strong> name, email address, phone number, password
                hash, and role (Brand Ambassador or Administrator).
              </li>
              <li>
                <strong>Brand Ambassador profile:</strong> mailing address, date of birth,
                clothing/shoe sizes, profile photo, identification documents, work history, and
                onboarding answers.
              </li>
              <li>
                <strong>Tax and payment information:</strong> the data needed to issue payment and
                meet IRS reporting obligations &mdash; legal name, address, taxpayer
                identification number (SSN, EIN, or ITIN) collected on a Form W-9, and PayPal
                payout email or other payout details. Tax IDs are encrypted at rest.
              </li>
              <li>
                <strong>Job and timekeeping data:</strong> jobs you apply to or are assigned,
                check-in / check-out times, geolocation snapshots and selfies captured at
                check-in / check-out, mileage and travel logs, and job photos you upload.
              </li>
              <li>
                <strong>Device and log data:</strong> IP address, browser/device type, operating
                system, referring URL, and timestamps. We use this for security, fraud
                prevention, and debugging.
              </li>
              <li>
                <strong>Cookies and similar technologies:</strong> we set authentication cookies
                via Supabase Auth so you can stay signed in. We do not use third-party advertising
                cookies.
              </li>
            </ul>
          </Section>

          <Section title="3. How we use information">
            <ul className="list-disc pl-6 space-y-2">
              <li>To create and operate your account and the Service.</li>
              <li>To match Brand Ambassadors with jobs and to manage scheduling, check-in, and check-out.</li>
              <li>To calculate, issue, and report payments (including 1099-NEC reporting).</li>
              <li>To verify identity, prevent fraud, and protect the security of the Service.</li>
              <li>To communicate with you about jobs, payments, account issues, and service updates.</li>
              <li>To comply with legal obligations and enforce our Terms.</li>
            </ul>
          </Section>

          <Section title="4. QuickBooks Online integration">
            <p>
              Administrators can connect the Service to Intuit QuickBooks Online (&ldquo;QuickBooks&rdquo;)
              so that Brand Ambassador vendor records and payment expenses sync into the
              company&rsquo;s QuickBooks file. The integration uses Intuit&rsquo;s OAuth 2.0 flow; we never
              receive or store the QuickBooks user&rsquo;s Intuit password.
            </p>
            <p className="mt-3"><strong>Data sent to QuickBooks.</strong> When the integration is enabled, we transmit to
            Intuit the information needed to create vendors and record expenses, including:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Brand Ambassador legal name, mailing address, email, and phone number.</li>
              <li>Form W-9 data (taxpayer name, address, classification, taxpayer ID).</li>
              <li>Payment amount, payment date, job title, and a memo describing the work.</li>
              <li>The QuickBooks expense account and vendor IDs we created on your behalf.</li>
            </ul>
            <p className="mt-3"><strong>Data received from QuickBooks.</strong> We retrieve a refresh token, an access
            token, the QuickBooks company (realm) ID, the chart of accounts (so an administrator
            can pick an expense account), and the vendor / purchase IDs that QuickBooks assigns to
            records we create.</p>
            <p className="mt-3"><strong>Tokens and storage.</strong> OAuth refresh and access tokens issued by Intuit are
            stored encrypted in our database and are accessible only to the connected QuickBooks
            company.</p>
            <p className="mt-3"><strong>Use of QuickBooks data.</strong> We use QuickBooks data solely to provide the
            integration: syncing vendors, recording expenses, and showing connection status to
            administrators. We do not sell QuickBooks data, share it for advertising, or use it
            to train machine-learning models.</p>
            <p className="mt-3"><strong>Your control.</strong> An administrator can disconnect QuickBooks at any time from{' '}
            <Link href="/admin/integrations/quickbooks" className="text-primary-500 underline">
              /admin/integrations/quickbooks
            </Link>{' '}
            or by revoking access in Intuit at{' '}
            <a
              className="text-primary-500 underline"
              href="https://appcenter.intuit.com/app/connection"
              target="_blank"
              rel="noreferrer"
            >
              appcenter.intuit.com/app/connection
            </a>
            . Disconnecting deletes our copy of the QuickBooks tokens. Your use of QuickBooks
            itself is governed by Intuit&rsquo;s privacy policy at{' '}
            <a
              className="text-primary-500 underline"
              href="https://www.intuit.com/privacy/"
              target="_blank"
              rel="noreferrer"
            >
              intuit.com/privacy
            </a>
            .</p>
          </Section>

          <Section title="5. PayPal integration">
            <p>
              Brand Ambassadors can connect a PayPal account to receive payouts. We use the
              PayPal Log In with PayPal flow and store only the identifiers and tokens required
              to send a payout (a hashed PayPal payer ID, refresh token, and the email address on
              the PayPal account). Your PayPal credentials are never sent to or stored by us. Your
              use of PayPal is governed by{' '}
              <a
                className="text-primary-500 underline"
                href="https://www.paypal.com/us/legalhub/privacy-full"
                target="_blank"
                rel="noreferrer"
              >
                PayPal&rsquo;s privacy statement
              </a>
              .
            </p>
          </Section>

          <Section title="6. How we share information">
            <p>We do not sell personal information. We share information only as follows:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Service providers</strong> who host or operate the Service on our behalf
                under contractual confidentiality obligations: Supabase (database and auth),
                Railway (application hosting), Resend / SendGrid or similar email provider,
                Dropbox (document storage), Google Maps (address autocomplete), PayPal (payouts),
                and Intuit QuickBooks (accounting sync).
              </li>
              <li>
                <strong>Clients of NMB Media</strong> &mdash; only the limited details required
                for a client to verify staffing for their event (e.g., assigned BA name, photo,
                check-in confirmation).
              </li>
              <li>
                <strong>Tax authorities</strong> as required by law, including 1099-NEC filings.
              </li>
              <li>
                <strong>Legal compliance:</strong> when required to comply with law, valid legal
                process, or to protect rights, property, or safety.
              </li>
              <li>
                <strong>Successors:</strong> in connection with a merger, acquisition, or sale of
                assets, subject to this Policy.
              </li>
            </ul>
          </Section>

          <Section title="7. Data retention">
            <p>
              We retain personal information for as long as your account is active and for as
              long as needed to comply with our legal obligations (including IRS recordkeeping,
              which generally requires that we retain payment and tax records for at least seven
              years). Geolocation snapshots and check-in selfies are retained for the life of the
              associated job record. You may request deletion as described in Section 9.
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              We use TLS in transit, encryption at rest for sensitive fields (including taxpayer
              IDs and OAuth tokens), Supabase Row Level Security, and least-privilege access
              controls. No method of transmission or storage is 100% secure, but we work hard to
              protect your information and review our controls regularly.
            </p>
          </Section>

          <Section title="9. Your rights and choices">
            <p>
              You may review and update most of your profile information from inside the Service.
              You may also email{' '}
              <a className="text-primary-500 underline" href="mailto:privacy@nmbmedia.com">
                privacy@nmbmedia.com
              </a>{' '}
              to request access, correction, or deletion of your personal information, subject to
              our legal recordkeeping obligations. Residents of California, Colorado, Virginia,
              and other U.S. states with consumer-privacy laws have additional rights under those
              laws and may exercise them through the same email address.
            </p>
          </Section>

          <Section title="10. Children">
            <p>
              The Service is not intended for individuals under 18 years of age, and we do not
              knowingly collect personal information from children.
            </p>
          </Section>

          <Section title="11. International users">
            <p>
              The Service is operated from the United States. If you access it from outside the
              U.S., you acknowledge that your information will be processed in the U.S., which
              may not provide the same level of data-protection law as your country.
            </p>
          </Section>

          <Section title="12. Changes to this Policy">
            <p>
              We may update this Policy from time to time. If we make material changes, we will
              update the &ldquo;Effective&rdquo; date at the top and, where appropriate, give notice through
              the Service or by email. Your continued use of the Service after the change becomes
              effective means you accept the updated Policy.
            </p>
          </Section>

          <Section title="13. Contact us">
            <p>
              Questions about this Policy or our privacy practices? Contact us at{' '}
              <a className="text-primary-500 underline" href="mailto:privacy@nmbmedia.com">
                privacy@nmbmedia.com
              </a>{' '}
              or by mail at the address in Section 1.
            </p>
          </Section>

          <p className="mt-12 text-sm text-gray-500">
            See also our{' '}
            <Link href="/terms" className="text-primary-500 underline">
              Terms of Service
            </Link>
            .
          </p>
        </article>
      </main>

      <footer className="border-t border-gray-200 mt-12">
        <div className="container mx-auto px-4 py-6 text-xs text-gray-500 flex flex-wrap items-center gap-4">
          <span>© {new Date().getFullYear()} National Mobile Billboards LLC</span>
          <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-700">Terms</Link>
          <a href="mailto:privacy@nmbmedia.com" className="hover:text-gray-700">
            privacy@nmbmedia.com
          </a>
          <ContactHelpLineStatic variant="footer" phone={contactPhone} />
        </div>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold text-heading mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

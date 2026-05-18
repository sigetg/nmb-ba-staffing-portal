import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ContactHelpLineStatic } from '@/components/contact-phone'
import { getContactPhone } from '@/lib/contact-phone'

export const metadata: Metadata = {
  title: 'Terms of Service | NMB Staffing Portal',
  description:
    'Terms of Service and End-User License Agreement for the NMB Brand Ambassador Staffing Portal.',
}

const EFFECTIVE_DATE = 'May 7, 2026'

export default async function TermsOfServicePage() {
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
            <Link href="/privacy" className="text-primary-400 hover:text-primary-500">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <article className="max-w-3xl mx-auto text-gray-800 leading-relaxed">
          <h1 className="text-3xl sm:text-4xl font-bold text-heading">
            Terms of Service &amp; End-User License Agreement
          </h1>
          <p className="mt-2 text-sm text-gray-500">Effective {EFFECTIVE_DATE}</p>

          <p className="mt-6">
            These Terms of Service (&ldquo;Terms&rdquo;) form a binding agreement between you and National
            Mobile Billboards LLC, doing business as NMB Media (&ldquo;NMB&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;).
            They govern your access to and use of the NMB Brand Ambassador Staffing Portal at{' '}
            <a className="text-primary-500 underline" href="https://staffing.nmbmedia.com">
              staffing.nmbmedia.com
            </a>{' '}
            (the &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these
            Terms. If you do not agree, do not use the Service.
          </p>

          <Section title="1. Eligibility">
            <p>
              You must be at least 18 years old and able to form a legally binding contract to
              use the Service. By using the Service, you represent that you meet these
              requirements and that all information you provide is accurate.
            </p>
          </Section>

          <Section title="2. Accounts">
            <p>
              You are responsible for safeguarding your credentials and for any activity under
              your account. Notify us immediately at{' '}
              <a className="text-primary-500 underline" href="mailto:support@nmbmedia.com">
                support@nmbmedia.com
              </a>{' '}
              of any unauthorized use. We may suspend or terminate accounts that violate these
              Terms or that we reasonably believe are fraudulent or unsafe.
            </p>
          </Section>

          <Section title="3. License to use the Service">
            <p>
              Subject to these Terms, NMB grants you a limited, revocable, non-exclusive,
              non-transferable, non-sublicensable license to access and use the Service for its
              intended purpose &mdash; receiving and managing brand-ambassador staffing
              assignments (for Brand Ambassadors) or administering staffing operations (for
              Administrators). This license terminates automatically if you violate these Terms.
            </p>
          </Section>

          <Section title="4. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
              <li>Submit false identity, tax, or banking information.</li>
              <li>Attempt to access accounts, data, or systems you are not authorized to access.</li>
              <li>Reverse-engineer, copy, modify, or create derivative works of the Service except as permitted by law.</li>
              <li>Interfere with the Service&rsquo;s operation, security, or integrity, including by sending malware or excessive automated traffic.</li>
              <li>Scrape, crawl, or otherwise extract data from the Service without our written permission.</li>
              <li>Use the Service to harass, defame, or harm any person.</li>
            </ul>
          </Section>

          <Section title="5. Brand-Ambassador relationship">
            <p>
              The Service is a tool for coordinating staffing engagements. Use of the Service
              does not, by itself, create an employment relationship between you and NMB. The
              terms of any specific staffing engagement (including pay, classification as a 1099
              independent contractor or W-2 employee where applicable, and scope of work) are
              governed by the engagement documents you receive separately, not by these Terms.
            </p>
          </Section>

          <Section title="6. Payments">
            <p>
              When you complete a job, NMB will pay you the agreed amount through the payout
              method connected to your account (such as PayPal). You are solely responsible for
              any taxes owed on amounts you receive. NMB will issue IRS Form 1099-NEC to
              independent contractors as required by law. You agree to provide a current Form
              W-9 and to keep your taxpayer information accurate.
            </p>
          </Section>

          <Section title="7. QuickBooks Online integration">
            <p>
              Administrators may connect the Service to Intuit QuickBooks Online (&ldquo;QuickBooks&rdquo;)
              so that vendor records and payment expenses sync into the company&rsquo;s QuickBooks
              file. By connecting QuickBooks, the connecting administrator represents that they
              are authorized to grant the Service access to that QuickBooks company, and they
              authorize NMB to read the company&rsquo;s chart of accounts and to create vendor and
              expense records on the company&rsquo;s behalf.
            </p>
            <p className="mt-3">
              The QuickBooks connection can be revoked at any time from{' '}
              <Link href="/admin/integrations/quickbooks" className="text-primary-500 underline">
                /admin/integrations/quickbooks
              </Link>{' '}
              or by removing the app from{' '}
              <a
                className="text-primary-500 underline"
                href="https://appcenter.intuit.com/app/connection"
                target="_blank"
                rel="noreferrer"
              >
                appcenter.intuit.com/app/connection
              </a>
              . Your use of QuickBooks itself is governed by Intuit&rsquo;s terms and privacy policy
              (
              <a
                className="text-primary-500 underline"
                href="https://www.intuit.com/legal/terms/"
                target="_blank"
                rel="noreferrer"
              >
                intuit.com/legal/terms
              </a>{' '}and{' '}
              <a
                className="text-primary-500 underline"
                href="https://www.intuit.com/privacy/"
                target="_blank"
                rel="noreferrer"
              >
                intuit.com/privacy
              </a>
              ). NMB is not affiliated with Intuit, and Intuit makes no warranties about the
              Service.
            </p>
            <p className="mt-3">
              How we handle QuickBooks data is described in our{' '}
              <Link href="/privacy" className="text-primary-500 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="8. Your content">
            <p>
              You retain ownership of the content you submit to the Service (such as profile
              photos, check-in selfies, and uploaded documents). You grant NMB a worldwide,
              non-exclusive, royalty-free license to host, store, reproduce, and display that
              content solely as needed to operate the Service and to deliver staffing services
              to NMB&rsquo;s clients. You represent that you have all necessary rights to grant this
              license.
            </p>
          </Section>

          <Section title="9. Intellectual property">
            <p>
              The Service, including its software, design, text, graphics, and the NMB and NMB
              Media trademarks and logos, is owned by NMB or its licensors and is protected by
              copyright, trademark, and other laws. Except for the limited license granted in
              Section 3, no rights are granted to you in the Service.
            </p>
          </Section>

          <Section title="10. Third-party services">
            <p>
              The Service integrates with third-party services, including Supabase, Railway,
              Intuit QuickBooks Online, PayPal, Google Maps, and Dropbox. Your use of those
              services is governed by their respective terms and privacy policies. NMB is not
              responsible for the availability, content, or practices of third-party services.
            </p>
          </Section>

          <Section title="11. Disclaimers">
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
              WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. TO THE MAXIMUM EXTENT PERMITTED
              BY LAW, NMB DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY
              WARRANTY ARISING OUT OF COURSE OF DEALING OR USAGE OF TRADE. NMB DOES NOT WARRANT
              THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
            </p>
          </Section>

          <Section title="12. Limitation of liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, NMB AND ITS OFFICERS, EMPLOYEES, AND
              AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
              EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR
              GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. NMB&rsquo;S AGGREGATE
              LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE WILL NOT EXCEED
              THE GREATER OF (A) THE AMOUNTS NMB PAID YOU IN THE TWELVE MONTHS PRECEDING THE
              CLAIM OR (B) US$100. SOME JURISDICTIONS DO NOT ALLOW THESE LIMITATIONS, AND THEY
              MAY NOT APPLY TO YOU.
            </p>
          </Section>

          <Section title="13. Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless NMB and its officers, employees,
              and agents from any claims, damages, liabilities, costs, and expenses (including
              reasonable attorneys&rsquo; fees) arising out of (a) your use of the Service, (b) your
              violation of these Terms, (c) your violation of any law or third-party right, or
              (d) any content you submit to the Service.
            </p>
          </Section>

          <Section title="14. Termination">
            <p>
              You may stop using the Service at any time. We may suspend or terminate your
              access to the Service at any time and for any reason, with or without notice,
              including if we believe you have violated these Terms. Sections 6 (Payments), 8
              (Your content), 9 (Intellectual property), 11 (Disclaimers), 12 (Limitation of
              liability), 13 (Indemnification), 15 (Governing law), and 16 (General) survive
              termination.
            </p>
          </Section>

          <Section title="15. Governing law and dispute resolution">
            <p>
              These Terms are governed by the laws of the State of Florida, without regard to
              its conflict-of-laws principles. The exclusive venue for any dispute arising out
              of or related to these Terms or the Service is the state or federal courts located
              in Broward County, Florida, and you consent to the personal jurisdiction of those
              courts.
            </p>
          </Section>

          <Section title="16. General">
            <p>
              These Terms, together with our{' '}
              <Link href="/privacy" className="text-primary-500 underline">
                Privacy Policy
              </Link>
              , are the entire agreement between you and NMB regarding the Service. If any
              provision is held unenforceable, the remaining provisions remain in effect. NMB&rsquo;s
              failure to enforce a provision is not a waiver. You may not assign these Terms
              without our written consent; we may assign them to an affiliate or in connection
              with a merger, acquisition, or sale of assets. We may update these Terms from time
              to time; material changes will be communicated through the Service or by email,
              and your continued use after the change becomes effective means you accept the
              updated Terms.
            </p>
          </Section>

          <Section title="17. Contact">
            <p>
              National Mobile Billboards LLC<br />
              5101 NW 21st Ave, Ste 340<br />
              Ft. Lauderdale, FL 33309-2722<br />
              Email:{' '}
              <a className="text-primary-500 underline" href="mailto:support@nmbmedia.com">
                support@nmbmedia.com
              </a>
            </p>
          </Section>
        </article>
      </main>

      <footer className="border-t border-gray-200 mt-12">
        <div className="container mx-auto px-4 py-6 text-xs text-gray-500 flex flex-wrap items-center gap-4">
          <span>© {new Date().getFullYear()} National Mobile Billboards LLC</span>
          <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-700">Terms</Link>
          <a href="mailto:support@nmbmedia.com" className="hover:text-gray-700">
            support@nmbmedia.com
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

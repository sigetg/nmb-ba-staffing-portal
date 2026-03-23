import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-16">
        <div className="text-center">
          <Image
            src="/logo.jpg"
            alt="NMB Media - Promotions in Motion"
            width={400}
            height={160}
            className="h-32 w-auto object-contain mx-auto"
            priority
          />
          <h1 className="mt-6 text-4xl font-bold text-heading sm:text-5xl md:text-6xl">
            BA Staffing Portal
          </h1>
          <p className="mt-4 text-xl text-primary-400">
            Connect Brand Ambassadors with exciting opportunities
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-900">
              Brand Ambassadors
            </h2>
            <p className="mt-4 text-primary-400">
              Find jobs, manage your profile, track your hours, and get paid.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-primary-400">
              <li>• Browse available opportunities</li>
              <li>• Easy check-in/check-out</li>
              <li>• Upload job photos</li>
              <li>• Fast payments via Stripe</li>
            </ul>
            <div className="mt-6 flex gap-4">
              <Link
                href="/auth/login"
                className="rounded-lg bg-primary-400 px-6 py-3 text-white hover:bg-primary-500 transition"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50 transition"
              >
                Apply Now
              </Link>
            </div>
          </div>

          <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-900">
              Administrators
            </h2>
            <p className="mt-4 text-primary-400">
              Manage jobs, screen BAs, track attendance, and process payments.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-primary-400">
              <li>• Post and manage jobs</li>
              <li>• Screen BA applications</li>
              <li>• Real-time attendance tracking</li>
              <li>• Payment management</li>
            </ul>
            <div className="mt-6">
              <Link
                href="/admin/login"
                className="rounded-lg bg-gray-900 px-6 py-3 text-white hover:bg-gray-800 transition"
              >
                Admin Login
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center text-sm text-primary-400">
          <p>
            Backend API:{" "}
            <a
              href="http://localhost:8000/health"
              className="text-primary-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              http://localhost:8000
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
            NMB BA Staffing Portal
          </h1>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">
            Connect Brand Ambassadors with exciting opportunities
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {/* BA Portal Card */}
          <div className="rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Brand Ambassadors
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              Find jobs, manage your profile, track your hours, and get paid.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li>• Browse available opportunities</li>
              <li>• Easy check-in/check-out</li>
              <li>• Upload job photos</li>
              <li>• Fast payments via Stripe</li>
            </ul>
            <div className="mt-6 flex gap-4">
              <Link
                href="/auth/login"
                className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition"
              >
                Apply Now
              </Link>
            </div>
          </div>

          {/* Admin Portal Card */}
          <div className="rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Administrators
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              Manage jobs, screen BAs, track attendance, and process payments.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li>• Post and manage jobs</li>
              <li>• Screen BA applications</li>
              <li>• Real-time attendance tracking</li>
              <li>• Payment management</li>
            </ul>
            <div className="mt-6">
              <Link
                href="/admin/login"
                className="rounded-lg bg-gray-900 px-6 py-3 text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 transition"
              >
                Admin Login
              </Link>
            </div>
          </div>
        </div>

        {/* Health Check Status */}
        <div className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Backend API:{" "}
            <a
              href="http://localhost:8000/health"
              className="text-blue-600 hover:underline"
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

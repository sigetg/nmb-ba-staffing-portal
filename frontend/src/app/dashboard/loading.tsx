export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Welcome section skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-5 w-40 bg-gray-200 rounded mt-2" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-gray-200 rounded-lg" />
          <div className="h-10 w-28 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-7 h-7 bg-gray-200 rounded" />
              <div>
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-8 w-12 bg-gray-200 rounded mt-1" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Card skeletons */}
      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-16 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

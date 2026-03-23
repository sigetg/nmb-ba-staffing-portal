export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-5 w-72 bg-gray-200 rounded mt-2" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
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

      {/* Table skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((j) => (
            <div key={j} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

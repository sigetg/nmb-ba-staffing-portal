import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, Badge, Avatar } from '@/components/ui'
import { Clock, Users } from 'lucide-react'

async function getBAs(searchParams: { status?: string; zip_code?: string }) {
  const supabase = await createClient()

  let query = supabase.from('ba_profiles').select('*, ba_photos(url, photo_type), users(email)', { count: 'exact' })

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }
  if (searchParams.zip_code) {
    query = query.eq('zip_code', searchParams.zip_code)
  }

  const { data, count } = await query.order('created_at', { ascending: false })

  return { bas: data || [], total: count || 0 }
}

export default async function AdminBAsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; zip_code?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const params = await searchParams
  const { bas, total } = await getBAs(params)

  const statusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
      pending: 'warning',
      approved: 'success',
      rejected: 'error',
      suspended: 'error',
    }
    return variants[status] || 'default'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-heading">Brand Ambassadors</h1>
          <p className="text-primary-400">Manage all BAs ({total} total)</p>
        </div>
        <Link
          href="/admin/bas/pending"
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors inline-flex items-center gap-2"
        >
          <Clock className="w-5 h-5" />
          Pending Approvals
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <form className="flex flex-wrap gap-4">
            <select
              name="status"
              defaultValue={params.status || ''}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
            <input
              type="text"
              name="zip_code"
              placeholder="Filter by ZIP code..."
              defaultValue={params.zip_code || ''}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
            >
              Filter
            </button>
          </form>
        </CardContent>
      </Card>

      {/* BAs List */}
      <Card>
        <CardContent className="p-0">
          {bas.length === 0 ? (
            <div className="text-center py-12 text-primary-400">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No brand ambassadors found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">BA</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Phone</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">ZIP Code</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Joined</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-primary-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bas.map((ba: { id: string; name: string; phone: string; zip_code: string; status: string; created_at: string; ba_photos: { url: string; photo_type: string }[]; users: { email?: string } | null }) => {
                    const email = ba.users?.email
                    const profilePhoto = ba.ba_photos?.find(p => p.photo_type === 'profile')

                    return (
                      <tr key={ba.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={profilePhoto?.url}
                              name={ba.name}
                              size="sm"
                            />
                            <span className="font-medium text-gray-900">
                              {ba.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {ba.phone}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {email ? (
                            <a href={`mailto:${email}`} className="text-primary-400 hover:text-primary-500 underline">
                              {email}
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {ba.zip_code}
                        </td>
                        <td className="py-3 px-4 text-sm text-primary-400">
                          {new Date(ba.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={statusBadge(ba.status)}>{ba.status}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/admin/bas/${ba.id}`}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
                          >
                            {ba.status === 'pending' ? 'Review' : 'View'}
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'
import { BAsTable } from '@/components/admin/bas-table'

export default async function AdminBAsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data, count } = await supabase
    .from('ba_profiles')
    .select('*, ba_photos(url, photo_type), users(email)', { count: 'exact' })
    .order('created_at', { ascending: false })

  const bas = data || []
  const total = count || 0

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
          className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors inline-flex items-center gap-2"
        >
          <Clock className="w-5 h-5" />
          Pending Approvals
        </Link>
      </div>

      <BAsTable bas={bas} />
    </div>
  )
}

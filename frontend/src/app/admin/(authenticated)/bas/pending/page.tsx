import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, Badge, Avatar } from '@/components/ui'
import { ChevronLeft, CheckCircle2, Phone, MapPin, Calendar, Mail } from 'lucide-react'

async function getPendingBAs() {
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('ba_profiles')
    .select('*, ba_photos(url, photo_type), users(email)', { count: 'exact' })
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return { bas: data || [], total: count || 0 }
}

export default async function PendingBAsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { bas, total } = await getPendingBAs()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/bas"
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-heading">Pending Approvals</h1>
            <p className="text-primary-400">{total} BAs awaiting review</p>
          </div>
        </div>
      </div>

      {/* Pending BAs List */}
      {bas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p className="text-primary-400">All caught up! No pending approvals.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bas.map((ba: { id: string; name: string; phone: string; zip_code: string; created_at: string; availability: Record<string, { morning?: boolean; afternoon?: boolean; evening?: boolean }>; ba_photos: { url: string; photo_type: string }[]; users: { email?: string } | null }) => {
            const profilePhoto = ba.ba_photos?.find(p => p.photo_type === 'profile')

            // Count available days
            const availableDays = Object.entries(ba.availability || {}).filter(
              ([, periods]) => periods.morning || periods.afternoon || periods.evening
            ).length

            return (
              <Card key={ba.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar
                      src={profilePhoto?.url}
                      name={ba.name}
                      size="lg"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {ba.name}
                        </h3>
                        <Badge variant="warning">Pending</Badge>
                      </div>
                      <div className="space-y-1 text-sm text-primary-400">
                        <p className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {ba.phone}
                        </p>
                        {ba.users?.email && (
                          <p className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <a href={`mailto:${ba.users.email}`} className="text-primary-400 hover:text-primary-500 underline">
                              {ba.users.email}
                            </a>
                          </p>
                        )}
                        <p className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          ZIP: {ba.zip_code}
                        </p>
                        <p className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {availableDays} days available
                        </p>
                      </div>
                      <p className="text-xs text-primary-400 mt-2">
                        Applied {new Date(ba.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/admin/bas/${ba.id}`}
                      className="flex-1 px-4 py-2 text-center bg-primary-400 text-white rounded-lg hover:bg-primary-500 text-sm"
                    >
                      Review
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

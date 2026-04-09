'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, Badge, Avatar } from '@/components/ui'
import type { BadgeVariant } from '@/components/ui'
import { Users, ChevronUp, ChevronDown, ArrowUpDown, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { startImpersonation } from '@/lib/actions/impersonation'

interface BA {
  id: string
  name: string
  phone: string
  zip_code: string
  status: string
  created_at: string
  ba_photos: { url: string; photo_type: string }[]
  users: { email?: string } | null
}

type SortColumn = 'name' | 'joined' | 'status'
type SortDirection = 'asc' | 'desc'

interface BAsTableProps {
  bas: BA[]
}

const BA_STATUS_ORDER: Record<string, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
  suspended: 3,
}

function baStatusBadgeVariant(status: string): BadgeVariant {
  const variants: Record<string, BadgeVariant> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
    suspended: 'error',
  }
  return variants[status] || 'default'
}

function formatBAStatus(status: string): string {
  return status.replace(/\b\w/g, c => c.toUpperCase())
}

function compareBAs(a: BA, b: BA, column: SortColumn, direction: SortDirection): number {
  let cmp = 0
  switch (column) {
    case 'name':
      cmp = a.name.localeCompare(b.name)
      break
    case 'joined':
      cmp = a.created_at.localeCompare(b.created_at)
      break
    case 'status':
      cmp = (BA_STATUS_ORDER[a.status] ?? 99) - (BA_STATUS_ORDER[b.status] ?? 99)
      break
  }
  return direction === 'asc' ? cmp : -cmp
}

function SortIcon({ column, activeColumn, direction }: { column: SortColumn; activeColumn: SortColumn | null; direction: SortDirection }) {
  if (activeColumn !== column) {
    return <ArrowUpDown className="w-3.5 h-3.5 ml-1 inline opacity-40" />
  }
  return direction === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 ml-1 inline" />
    : <ChevronDown className="w-3.5 h-3.5 ml-1 inline" />
}

export function BAsTable({ bas }: BAsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortColumn(null)
        setSortDirection('asc')
      }
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const filteredBAs = useMemo(() => {
    let result = bas

    if (statusFilter) {
      result = result.filter(ba => ba.status === statusFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(ba =>
        ba.name.toLowerCase().includes(q) ||
        (ba.users?.email || '').toLowerCase().includes(q) ||
        (ba.zip_code || '').includes(q)
      )
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => compareBAs(a, b, sortColumn, sortDirection))
    }

    return result
  }, [bas, statusFilter, search, sortColumn, sortDirection])

  const headerClass = 'text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap cursor-pointer select-none hover:text-primary-100 transition-colors'
  const headerStatic = 'text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap'

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <input
              type="text"
              placeholder="Search name, email, or ZIP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm flex-1 min-w-[200px]"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* BAs Table */}
      <Card>
        <CardContent className="p-0">
          {filteredBAs.length === 0 ? (
            <div className="text-center py-12 text-primary-400">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              {bas.length === 0 ? (
                <p>No brand ambassadors found</p>
              ) : (
                <p>No BAs match your filters</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primary-500 [&>th:first-child]:rounded-tl-lg [&>th:last-child]:rounded-tr-lg">
                    <th className={headerClass} onClick={() => handleSort('name')}>
                      BA <SortIcon column="name" activeColumn={sortColumn} direction={sortDirection} />
                    </th>
                    <th className={headerStatic}>Phone</th>
                    <th className={headerStatic}>Email</th>
                    <th className={headerStatic}>ZIP Code</th>
                    <th className={headerClass} onClick={() => handleSort('joined')}>
                      Joined <SortIcon column="joined" activeColumn={sortColumn} direction={sortDirection} />
                    </th>
                    <th className={headerClass} onClick={() => handleSort('status')}>
                      Status <SortIcon column="status" activeColumn={sortColumn} direction={sortDirection} />
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBAs.map((ba) => {
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
                            <span className="text-gray-400">&mdash;</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {ba.zip_code}
                        </td>
                        <td className="py-3 px-4 text-sm text-primary-400">
                          {new Date(ba.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={baStatusBadgeVariant(ba.status)}>{formatBAStatus(ba.status)}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {ba.status !== 'pending' && (
                              <button
                                onClick={async () => {
                                  await startImpersonation(ba.id)
                                  router.push('/dashboard')
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
                                title={`Login as ${ba.name}`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Login As
                              </button>
                            )}
                            <Link
                              href={`/admin/bas/${ba.id}`}
                              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
                            >
                              {ba.status === 'pending' ? 'Review' : 'View'}
                            </Link>
                          </div>
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
    </>
  )
}

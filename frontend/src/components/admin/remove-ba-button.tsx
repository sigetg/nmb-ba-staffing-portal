'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Alert } from '@/components/ui'
import { UserMinus } from 'lucide-react'

interface RemoveBAButtonProps {
  jobId: string
  baId: string
  baName?: string | null
  jobTitle?: string | null
  variant?: 'icon' | 'button'
  onSuccess?: () => void
}

export function RemoveBAButton({
  jobId,
  baId,
  baName,
  jobTitle,
  variant = 'icon',
  onSuccess,
}: RemoveBAButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const openModal = () => {
    setError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    if (isRemoving) return
    setShowModal(false)
    setError(null)
  }

  const handleRemove = async () => {
    setIsRemoving(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('You must be signed in.')
      setIsRemoving(false)
      return
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const res = await fetch(`${apiUrl}/api/admin/jobs/${jobId}/assign/${baId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    if (!res.ok) {
      let detail = `Failed to remove BA (${res.status})`
      try {
        const body = await res.json()
        if (body?.detail) detail = body.detail
      } catch {}
      setError(detail)
      setIsRemoving(false)
      return
    }

    setShowModal(false)
    setIsRemoving(false)
    if (onSuccess) {
      onSuccess()
    } else {
      router.refresh()
    }
  }

  const displayName = baName || 'this BA'
  const subject = jobTitle ? (
    <>
      Remove <strong>{displayName}</strong> from <strong>&ldquo;{jobTitle}&rdquo;</strong>?
    </>
  ) : (
    <>
      Remove <strong>{displayName}</strong> from this job?
    </>
  )

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={openModal}
          className="p-2 text-gray-400 hover:text-red-600"
          title="Remove from job"
          aria-label={`Remove ${displayName} from job`}
        >
          <UserMinus className="w-4 h-4" />
        </button>
      ) : (
        <Button variant="destructive" size="sm" onClick={openModal}>
          <UserMinus className="w-4 h-4" />
          Remove
        </Button>
      )}

      <Modal isOpen={showModal} onClose={closeModal} size="sm">
        <ModalHeader>
          <ModalTitle>Remove BA from Job</ModalTitle>
        </ModalHeader>
        <ModalContent>
          {error && <Alert variant="error" className="mb-3">{error}</Alert>}
          <p className="text-sm text-gray-600">
            {subject} They will be emailed and the slot will reopen.
          </p>
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={closeModal} disabled={isRemoving}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleRemove} isLoading={isRemoving}>
            Remove
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}

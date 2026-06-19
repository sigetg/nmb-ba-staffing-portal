'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Alert } from '@/components/ui'
import { Trash2, Archive, ArchiveRestore } from 'lucide-react'
import type { DisplayJobStatus, JobStatus } from '@/types'

interface JobActionsProps {
  jobId: string
  jobStatus: JobStatus
  displayStatus: DisplayJobStatus
  jobTitle: string
  variant: 'icon' | 'button'
  /** Called after a successful action when on the list page (instead of redirect) */
  onSuccess?: () => void
}

export function JobActions({ jobId, jobStatus, displayStatus, jobTitle, variant, onSuccess }: JobActionsProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isUnarchiving, setIsUnarchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const canDelete = jobStatus === 'draft'
  const canArchive = displayStatus === 'completed'
  const canUnarchive = jobStatus === 'archived'

  if (!canDelete && !canArchive && !canUnarchive) return null

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)
    const { error: deleteError } = await supabase.from('jobs').delete().eq('id', jobId)
    if (deleteError) {
      setError(deleteError.message)
      setIsDeleting(false)
      return
    }
    setShowDeleteModal(false)
    if (onSuccess) {
      onSuccess()
    } else {
      router.push('/admin/jobs')
    }
  }

  const handleArchive = async () => {
    setIsArchiving(true)
    setError(null)
    const { error: archiveError } = await supabase
      .from('jobs')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', jobId)
    if (archiveError) {
      setError(archiveError.message)
      setIsArchiving(false)
      return
    }
    setShowArchiveModal(false)
    if (onSuccess) {
      onSuccess()
    } else {
      router.push('/admin/jobs')
    }
  }

  const handleUnarchive = async () => {
    setIsUnarchiving(true)
    setError(null)
    const { error: unarchiveError } = await supabase
      .from('jobs')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', jobId)
    if (unarchiveError) {
      setError(unarchiveError.message)
      setIsUnarchiving(false)
      return
    }
    setShowUnarchiveModal(false)
    if (onSuccess) {
      onSuccess()
    } else {
      router.push('/admin/jobs')
    }
  }

  if (variant === 'icon') {
    return (
      <>
        {canDelete && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 text-gray-400 hover:text-red-600"
            title="Delete draft"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        {canArchive && (
          <button
            onClick={() => setShowArchiveModal(true)}
            className="p-2 text-gray-400 hover:text-gray-700"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
        )}
        {canUnarchive && (
          <button
            onClick={() => setShowUnarchiveModal(true)}
            className="p-2 text-gray-400 hover:text-primary-500"
            title="Unarchive"
          >
            <ArchiveRestore className="w-4 h-4" />
          </button>
        )}

        <DeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          jobTitle={jobTitle}
          error={error}
        />
        <ArchiveModal
          isOpen={showArchiveModal}
          onClose={() => setShowArchiveModal(false)}
          onConfirm={handleArchive}
          isLoading={isArchiving}
          jobTitle={jobTitle}
          error={error}
        />
        <UnarchiveModal
          isOpen={showUnarchiveModal}
          onClose={() => setShowUnarchiveModal(false)}
          onConfirm={handleUnarchive}
          isLoading={isUnarchiving}
          jobTitle={jobTitle}
          error={error}
        />
      </>
    )
  }

  return (
    <>
      {canDelete && (
        <Button variant="destructive" size="sm" onClick={() => setShowDeleteModal(true)}>
          <Trash2 className="w-4 h-4" />
          Delete
        </Button>
      )}
      {canArchive && (
        <Button variant="outline" size="sm" onClick={() => setShowArchiveModal(true)}>
          <Archive className="w-4 h-4" />
          Archive
        </Button>
      )}
      {canUnarchive && (
        <Button variant="outline" size="sm" onClick={() => setShowUnarchiveModal(true)}>
          <ArchiveRestore className="w-4 h-4" />
          Unarchive
        </Button>
      )}

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        jobTitle={jobTitle}
        error={error}
      />
      <ArchiveModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        onConfirm={handleArchive}
        isLoading={isArchiving}
        jobTitle={jobTitle}
        error={error}
      />
      <UnarchiveModal
        isOpen={showUnarchiveModal}
        onClose={() => setShowUnarchiveModal(false)}
        onConfirm={handleUnarchive}
        isLoading={isUnarchiving}
        jobTitle={jobTitle}
        error={error}
      />
    </>
  )
}

function DeleteModal({ isOpen, onClose, onConfirm, isLoading, jobTitle, error }: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  jobTitle: string
  error: string | null
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader>
        <ModalTitle>Delete Draft Job</ModalTitle>
      </ModalHeader>
      <ModalContent>
        {error && <Alert variant="error" className="mb-3">{error}</Alert>}
        <p className="text-sm text-gray-600">
          Permanently delete <strong>&ldquo;{jobTitle}&rdquo;</strong>? This cannot be undone.
        </p>
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button variant="destructive" size="sm" onClick={onConfirm} isLoading={isLoading}>Delete</Button>
      </ModalFooter>
    </Modal>
  )
}

function ArchiveModal({ isOpen, onClose, onConfirm, isLoading, jobTitle, error }: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  jobTitle: string
  error: string | null
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader>
        <ModalTitle>Archive Job</ModalTitle>
      </ModalHeader>
      <ModalContent>
        {error && <Alert variant="error" className="mb-3">{error}</Alert>}
        <p className="text-sm text-gray-600">
          Archive <strong>&ldquo;{jobTitle}&rdquo;</strong>? It will be moved to the Archived tab and hidden from default views.
        </p>
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button variant="secondary" size="sm" onClick={onConfirm} isLoading={isLoading}>Archive</Button>
      </ModalFooter>
    </Modal>
  )
}

function UnarchiveModal({ isOpen, onClose, onConfirm, isLoading, jobTitle, error }: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  jobTitle: string
  error: string | null
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader>
        <ModalTitle>Unarchive Job</ModalTitle>
      </ModalHeader>
      <ModalContent>
        {error && <Alert variant="error" className="mb-3">{error}</Alert>}
        <p className="text-sm text-gray-600">
          Restore <strong>&ldquo;{jobTitle}&rdquo;</strong> to the Active tab? Its status will revert to published, and the display status (upcoming/completed/etc.) will follow from the job dates.
        </p>
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={onConfirm} isLoading={isLoading}>Unarchive</Button>
      </ModalFooter>
    </Modal>
  )
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { JobTypeManagerModal } from './job-type-manager/job-type-manager-modal'

export function JobsPageClient() {
  const [showTypeManager, setShowTypeManager] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowTypeManager(true)}
        leftIcon={<Settings className="w-4 h-4" />}
      >
        Manage Types
      </Button>
      <JobTypeManagerModal
        isOpen={showTypeManager}
        onClose={() => setShowTypeManager(false)}
      />
    </>
  )
}

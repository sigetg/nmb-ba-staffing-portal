'use client'

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

interface MultiSelectSearchProps {
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  label?: string
  error?: string
  placeholder?: string
  allowOther?: boolean
}

export function MultiSelectSearch({
  options,
  value,
  onChange,
  label,
  error,
  placeholder = 'Search...',
  allowOther = false,
}: MultiSelectSearchProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [otherValue, setOtherValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = options.filter(
    (opt) =>
      opt.toLowerCase().includes(search.toLowerCase()) &&
      !value.includes(opt)
  )

  const handleSelect = (opt: string) => {
    onChange([...value, opt])
    setSearch('')
  }

  const handleRemove = (opt: string) => {
    onChange(value.filter((v) => v !== opt))
  }

  const handleAddOther = () => {
    const trimmed = otherValue.trim()
    if (trimmed && !value.includes(`Other: ${trimmed}`)) {
      onChange([...value, `Other: ${trimmed}`])
      setOtherValue('')
    }
  }

  const showOther = allowOther && search.toLowerCase().includes('other')

  return (
    <div ref={containerRef} className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {/* Selected pills */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 text-sm rounded-full border border-primary-200"
            >
              {v}
              <button
                type="button"
                onClick={() => handleRemove(v)}
                className="hover:text-primary-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`
            block w-full rounded-lg border px-3 py-2 text-sm
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-0
            ${error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-primary-400 focus:ring-primary-200'
            }
          `}
        />

        {/* Dropdown */}
        {isOpen && (filtered.length > 0 || showOther) && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelect(opt)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
              >
                {opt}
              </button>
            ))}
            {allowOther && (
              <div className="border-t border-gray-100 p-2">
                <p className="text-xs text-gray-500 mb-1">Add other:</p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={otherValue}
                    onChange={(e) => setOtherValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddOther()
                      }
                    }}
                    placeholder="Type and press Enter"
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-200"
                  />
                  <button
                    type="button"
                    onClick={handleAddOther}
                    className="px-2 py-1 text-sm bg-primary-400 text-white rounded hover:bg-primary-500"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

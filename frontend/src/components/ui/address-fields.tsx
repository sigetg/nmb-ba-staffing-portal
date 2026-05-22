'use client'

import { Input, Select } from '@/components/ui'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { US_STATES } from '@/lib/us-states'

export interface AddressFieldsValue {
  street_address1: string
  street_address2: string
  city: string
  state: string
  zip_code: string
}

interface AddressFieldsProps {
  value: AddressFieldsValue
  onChange: (next: AddressFieldsValue) => void
  showAutocomplete?: boolean
  zipMaxLength?: number
}

const stateOptions = US_STATES.map((s) => ({ value: s, label: s }))

export function AddressFields({
  value,
  onChange,
  showAutocomplete = true,
  zipMaxLength = 10,
}: AddressFieldsProps) {
  return (
    <div className="space-y-3">
      {showAutocomplete && (
        <AddressAutocomplete
          label="Search address"
          value=""
          onChange={() => {}}
          onPlaceSelect={(place) => {
            onChange({
              street_address1: place.street_address1 ?? value.street_address1,
              street_address2: value.street_address2,
              city: place.city ?? value.city,
              state: place.state ?? value.state,
              zip_code: place.zip_code ?? value.zip_code,
            })
          }}
          placeholder="Start typing your address..."
          helperText="Pick from suggestions to auto-fill the fields below"
        />
      )}
      <Input
        label="Street Address"
        value={value.street_address1}
        onChange={(e) => onChange({ ...value, street_address1: e.target.value })}
        placeholder="123 Main St"
      />
      <Input
        label="Apt, Suite, etc. (optional)"
        value={value.street_address2}
        onChange={(e) => onChange({ ...value, street_address2: e.target.value })}
        placeholder="Apt 4B"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="City"
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          placeholder="Austin"
        />
        <Select
          label="State"
          options={stateOptions}
          value={value.state}
          onChange={(e) => onChange({ ...value, state: e.target.value.toUpperCase() })}
          placeholder="State"
        />
      </div>
      <Input
        label="ZIP Code"
        value={value.zip_code}
        onChange={(e) =>
          onChange({
            ...value,
            zip_code: e.target.value.replace(/[^\d-]/g, '').slice(0, zipMaxLength),
          })
        }
        placeholder="12345"
        maxLength={zipMaxLength}
      />
    </div>
  )
}

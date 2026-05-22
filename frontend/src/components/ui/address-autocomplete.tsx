'use client'

import { useRef, useEffect, useCallback } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

interface PlaceResult {
  address: string
  latitude: number
  longitude: number
  street_address1?: string
  city?: string
  state?: string
  zip_code?: string
}

function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined
): { street_address1?: string; city?: string; state?: string; zip_code?: string } {
  if (!components) return {}
  let streetNumber = ''
  let route = ''
  let city: string | undefined
  let state: string | undefined
  let zip: string | undefined
  for (const c of components) {
    const types = c.types || []
    if (types.includes('street_number')) streetNumber = c.long_name
    else if (types.includes('route')) route = c.long_name
    else if (types.includes('locality')) city = c.long_name
    else if (!city && (types.includes('postal_town') || types.includes('sublocality') || types.includes('neighborhood'))) {
      city = c.long_name
    }
    else if (types.includes('administrative_area_level_1')) state = c.short_name
    else if (types.includes('postal_code')) zip = c.long_name
  }
  const street = [streetNumber, route].filter(Boolean).join(' ').trim()
  return {
    street_address1: street || undefined,
    city,
    state,
    zip_code: zip,
  }
}

interface AddressAutocompleteProps {
  label?: string
  value: string
  onChange: (value: string) => void
  onPlaceSelect: (place: PlaceResult) => void
  placeholder?: string
  helperText?: string
  error?: string
}

let configured = false

function ensureConfigured() {
  if (!configured) {
    setOptions({
      key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    })
    configured = true
  }
}

export function AddressAutocomplete({
  label,
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Start typing an address...',
  helperText,
  error,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  // Keep refs to latest callbacks to avoid re-creating Autocomplete on prop changes
  const onPlaceSelectRef = useRef(onPlaceSelect)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onPlaceSelectRef.current = onPlaceSelect }, [onPlaceSelect])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace()
    if (place?.geometry?.location && place.formatted_address) {
      const parsed = parseAddressComponents(place.address_components)
      onPlaceSelectRef.current({
        address: place.formatted_address,
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng(),
        ...parsed,
      })
    }
  }, [])

  // Mount-only: create one Autocomplete instance per component lifecycle
  useEffect(() => {
    if (!inputRef.current) return

    ensureConfigured()
    importLibrary('places').then(() => {
      if (!inputRef.current) return

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        fields: ['formatted_address', 'geometry', 'address_components'],
      })

      autocompleteRef.current = autocomplete
      autocomplete.addListener('place_changed', handlePlaceChanged)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChangeRef.current(e.target.value)}
        placeholder={placeholder}
        className={`
          block w-full rounded-lg border
          px-3 py-2 text-sm
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-offset-0
          ${
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-primary-400 focus:ring-primary-200'
          }
        `}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-primary-400">{helperText}</p>
      )}
    </div>
  )
}

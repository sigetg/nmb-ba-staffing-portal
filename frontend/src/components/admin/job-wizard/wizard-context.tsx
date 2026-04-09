'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface LocationData {
  id: string
  location: string
  latitude: number | null
  longitude: number | null
  start_time: string
  end_time: string
  sort_order: number
}

export interface DayData {
  id: string
  date: string
  sort_order: number
  locations: LocationData[]
}

export interface WizardState {
  // Step 1: Basic Info
  title: string
  brand: string
  description: string
  payRate: string
  slots: string
  worksheetFile: File | null
  jobTypeId: string
  // Step 2: Days
  days: DayData[]
  // Current step
  currentStep: number
}

interface WizardContextType {
  state: WizardState
  setField: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void
  setCurrentStep: (step: number) => void
  addDay: (date: string) => void
  removeDay: (dayId: string) => void
  addLocation: (dayId: string) => void
  removeLocation: (dayId: string, locationId: string) => void
  updateLocation: (dayId: string, locationId: string, updates: Partial<LocationData>) => void
  reorderLocation: (dayId: string, locationId: string, direction: 'up' | 'down') => void
  copyLocationsToAllDays: (sourceDayId: string) => void
  copyLocationsToSpecificDays: (sourceDayId: string, targetDayIds: string[]) => void
  canGoNext: () => boolean
}

const WizardContext = createContext<WizardContextType | null>(null)

let nextId = 0
function genId() {
  return `temp-${++nextId}-${Date.now()}`
}

const initialState: WizardState = {
  title: '',
  brand: '',
  description: '',
  payRate: '',
  slots: '',
  worksheetFile: null,
  jobTypeId: '',
  days: [],
  currentStep: 0,
}

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(initialState)

  const setField = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  const setCurrentStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, currentStep: step }))
  }, [])

  const addDay = useCallback((date: string) => {
    setState(prev => {
      if (prev.days.some(d => d.date === date)) return prev
      return {
        ...prev,
        days: [...prev.days, {
          id: genId(),
          date,
          sort_order: prev.days.length,
          locations: [],
        }].sort((a, b) => a.date.localeCompare(b.date)),
      }
    })
  }, [])

  const removeDay = useCallback((dayId: string) => {
    setState(prev => ({
      ...prev,
      days: prev.days.filter(d => d.id !== dayId).map((d, i) => ({ ...d, sort_order: i })),
    }))
  }, [])

  const addLocation = useCallback((dayId: string) => {
    setState(prev => ({
      ...prev,
      days: prev.days.map(d => d.id !== dayId ? d : {
        ...d,
        locations: [...d.locations, {
          id: genId(),
          location: '',
          latitude: null,
          longitude: null,
          start_time: '',
          end_time: '',
          sort_order: d.locations.length,
        }],
      }),
    }))
  }, [])

  const removeLocation = useCallback((dayId: string, locationId: string) => {
    setState(prev => ({
      ...prev,
      days: prev.days.map(d => d.id !== dayId ? d : {
        ...d,
        locations: d.locations.filter(l => l.id !== locationId).map((l, i) => ({ ...l, sort_order: i })),
      }),
    }))
  }, [])

  const updateLocation = useCallback((dayId: string, locationId: string, updates: Partial<LocationData>) => {
    setState(prev => ({
      ...prev,
      days: prev.days.map(d => d.id !== dayId ? d : {
        ...d,
        locations: d.locations.map(l => l.id !== locationId ? l : { ...l, ...updates }),
      }),
    }))
  }, [])

  const reorderLocation = useCallback((dayId: string, locationId: string, direction: 'up' | 'down') => {
    setState(prev => ({
      ...prev,
      days: prev.days.map(d => {
        if (d.id !== dayId) return d
        const idx = d.locations.findIndex(l => l.id === locationId)
        if (idx < 0) return d
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1
        if (swapIdx < 0 || swapIdx >= d.locations.length) return d
        const newLocs = [...d.locations]
        ;[newLocs[idx], newLocs[swapIdx]] = [newLocs[swapIdx], newLocs[idx]]
        return { ...d, locations: newLocs.map((l, i) => ({ ...l, sort_order: i })) }
      }),
    }))
  }, [])

  const copyLocationsToAllDays = useCallback((sourceDayId: string) => {
    setState(prev => {
      const sourceDay = prev.days.find(d => d.id === sourceDayId)
      if (!sourceDay) return prev
      return {
        ...prev,
        days: prev.days.map(d => {
          if (d.id === sourceDayId) return d
          return {
            ...d,
            locations: sourceDay.locations.map(l => ({
              ...l,
              id: genId(),
            })),
          }
        }),
      }
    })
  }, [])

  const copyLocationsToSpecificDays = useCallback((sourceDayId: string, targetDayIds: string[]) => {
    setState(prev => {
      const sourceDay = prev.days.find(d => d.id === sourceDayId)
      if (!sourceDay) return prev
      return {
        ...prev,
        days: prev.days.map(d => {
          if (!targetDayIds.includes(d.id)) return d
          return {
            ...d,
            locations: sourceDay.locations.map(l => ({
              ...l,
              id: genId(),
            })),
          }
        }),
      }
    })
  }, [])

  const canGoNext = useCallback(() => {
    switch (state.currentStep) {
      case 0: // Basic Info
        return !!(state.title.trim() && state.brand.trim() && state.payRate && parseFloat(state.payRate) > 0 && state.slots && parseInt(state.slots) > 0 && state.jobTypeId)
      case 1: // Days
        return state.days.length > 0
      case 2: // Locations
        return state.days.every(d => d.locations.length > 0 && d.locations.every(l => l.location.trim() && l.start_time && l.end_time))
      case 3: // Review
        return true
      default:
        return false
    }
  }, [state])

  return (
    <WizardContext.Provider value={{
      state,
      setField,
      setCurrentStep,
      addDay,
      removeDay,
      addLocation,
      removeLocation,
      updateLocation,
      reorderLocation,
      copyLocationsToAllDays,
      copyLocationsToSpecificDays,
      canGoNext,
    }}>
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard() {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error('useWizard must be used within WizardProvider')
  return ctx
}

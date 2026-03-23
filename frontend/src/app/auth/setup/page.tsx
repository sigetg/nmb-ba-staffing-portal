'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Alert, Select, MultiSelectSearch, Textarea } from '@/components/ui'

type Step = 'basic' | 'photos' | 'resume' | 'details' | 'availability'

const steps: Step[] = ['basic', 'photos', 'resume', 'details', 'availability']
const stepLabels: Record<Step, string> = {
  basic: 'Basic Info',
  photos: 'Photos',
  resume: 'Resume',
  details: 'Details',
  availability: 'Availability',
}

const daysOfWeek = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]

const languageOptions = [
  'English', 'Spanish', 'Mandarin Chinese', 'Cantonese', 'Tagalog', 'Vietnamese',
  'Arabic', 'French', 'Korean', 'Russian', 'Portuguese', 'Hindi', 'Japanese',
  'German', 'Haitian Creole', 'Italian', 'Polish', 'Urdu', 'Gujarati', 'Persian',
]

const shirtSizeOptions = [
  { value: 'XS', label: 'XS' },
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' },
  { value: '2XL', label: '2XL' },
  { value: '3XL', label: '3XL' },
]

export default function SetupPage() {
  const [step, setStep] = useState<Step>('basic')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Step 1 - Basic Info
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [zipCode, setZipCode] = useState('')

  // Step 2 - Photos
  const [headshotFile, setHeadshotFile] = useState<File | null>(null)
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(null)
  const [fullLengthFile, setFullLengthFile] = useState<File | null>(null)
  const [fullLengthPreview, setFullLengthPreview] = useState<string | null>(null)

  // Step 3 - Resume
  const [resumeFile, setResumeFile] = useState<File | null>(null)

  // Step 4 - Details
  const [languages, setLanguages] = useState<string[]>([])
  const [shirtSize, setShirtSize] = useState('')

  // Step 5 - Availability & Additional Info
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [availability, setAvailability] = useState<Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>>({
    Monday: { morning: false, afternoon: false, evening: false },
    Tuesday: { morning: false, afternoon: false, evening: false },
    Wednesday: { morning: false, afternoon: false, evening: false },
    Thursday: { morning: false, afternoon: false, evening: false },
    Friday: { morning: false, afternoon: false, evening: false },
    Saturday: { morning: false, afternoon: false, evening: false },
    Sunday: { morning: false, afternoon: false, evening: false },
  })

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/auth/login')
        return
      }
      setUserId(session.user.id)

      const { data: profile } = await supabase
        .from('ba_profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

      if (profile) {
        router.push('/dashboard')
      }
    }
    checkUser()
  }, [supabase, router])

  const handlePhotoChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (s: string | null) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB')
      return
    }

    setFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
    setError(null)
  }

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Resume must be under 10MB')
      return
    }

    setResumeFile(file)
    setError(null)
  }

  const toggleAvailability = (day: string, period: 'morning' | 'afternoon' | 'evening') => {
    setAvailability((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [period]: !prev[day][period],
      },
    }))
  }

  const currentStepIndex = steps.indexOf(step)

  const goNext = () => {
    setError(null)

    if (step === 'basic') {
      if (!name.trim()) { setError('Name is required'); return }
      if (!phone.trim()) { setError('Phone number is required'); return }
      if (!zipCode.trim() || zipCode.length !== 5) { setError('Please enter a valid 5-digit zip code'); return }
      setStep('photos')
    } else if (step === 'photos') {
      if (!headshotFile) { setError('Headshot photo is required'); return }
      if (!fullLengthFile) { setError('Full-length photo is required'); return }
      setStep('resume')
    } else if (step === 'resume') {
      if (!resumeFile) { setError('Resume is required'); return }
      setStep('details')
    } else if (step === 'details') {
      if (languages.length === 0) { setError('Please select at least one language'); return }
      if (!shirtSize) { setError('Please select a shirt size'); return }
      setStep('availability')
    }
  }

  const goBack = () => {
    setError(null)
    const idx = currentStepIndex
    if (idx > 0) setStep(steps[idx - 1])
  }

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (!userId) { setError('Not authenticated'); return }

      // 1. Upload headshot
      const headshotExt = headshotFile!.name.split('.').pop()
      const headshotPath = `${userId}/headshot.${headshotExt}`
      const { error: headshotErr } = await supabase.storage
        .from('ba-photos')
        .upload(headshotPath, headshotFile!, { upsert: true })
      if (headshotErr) { setError('Failed to upload headshot'); return }

      const { data: { publicUrl: headshotUrl } } = supabase.storage
        .from('ba-photos')
        .getPublicUrl(headshotPath)

      // 2. Upload full-length photo
      const fullLengthExt = fullLengthFile!.name.split('.').pop()
      const fullLengthPath = `${userId}/full-length.${fullLengthExt}`
      const { error: fullLengthErr } = await supabase.storage
        .from('ba-photos')
        .upload(fullLengthPath, fullLengthFile!, { upsert: true })
      if (fullLengthErr) { setError('Failed to upload full-length photo'); return }

      const { data: { publicUrl: fullLengthUrl } } = supabase.storage
        .from('ba-photos')
        .getPublicUrl(fullLengthPath)

      // 3. Upload resume
      const resumePath = `${userId}/resume.pdf`
      const { error: resumeErr } = await supabase.storage
        .from('ba-resumes')
        .upload(resumePath, resumeFile!, { upsert: true })
      if (resumeErr) { setError('Failed to upload resume'); return }

      const { data: { publicUrl: resumeUrl } } = supabase.storage
        .from('ba-resumes')
        .getPublicUrl(resumePath)

      // 4. Create ba_profiles row
      const { error: profileError, data: profileData } = await supabase
        .from('ba_profiles')
        .insert({
          user_id: userId,
          name: name.trim(),
          phone: phone.trim(),
          zip_code: zipCode.trim(),
          status: 'pending',
          availability,
          languages,
          shirt_size: shirtSize,
          additional_info: additionalInfo.trim() || null,
          resume_url: resumeUrl,
        })
        .select('id')
        .single()

      if (profileError || !profileData) {
        setError(profileError?.message || 'Failed to create profile')
        return
      }

      // 5. Insert photo records
      await supabase.from('ba_photos').insert([
        { ba_id: profileData.id, photo_type: 'headshot', url: headshotUrl },
        { ba_id: profileData.id, photo_type: 'full_length', url: fullLengthUrl },
      ])

      router.push('/dashboard')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const stepIndicator = (
    <div className="flex items-center justify-center mb-8">
      {steps.map((s, idx) => (
        <div key={s} className="flex items-center">
          <div
            className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${step === s ? 'bg-primary-400 text-white' :
                currentStepIndex > idx ? 'bg-green-500 text-white' : 'bg-gray-200 text-primary-400'}
            `}
          >
            {idx + 1}
          </div>
          {idx < steps.length - 1 && (
            <div
              className={`w-8 h-1 mx-0.5 ${
                currentStepIndex > idx ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-heading">
            Complete Your Profile
          </h1>
          <p className="mt-2 text-primary-400">
            {stepLabels[step]}
          </p>
        </div>

        {stepIndicator}

        <Card>
          <CardHeader>
            <CardTitle>{stepLabels[step]}</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="error" onClose={() => setError(null)} className="mb-4">
                {error}
              </Alert>
            )}

            {/* Step 1: Basic Info */}
            {step === 'basic' && (
              <form onSubmit={(e) => { e.preventDefault(); goNext() }} className="space-y-4">
                <Input
                  label="Full Name"
                  type="text"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
                <Input
                  label="Zip Code"
                  type="text"
                  name="zipCode"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="12345"
                  maxLength={5}
                />
                <Button type="submit" className="w-full">Continue</Button>
              </form>
            )}

            {/* Step 2: Photos */}
            {step === 'photos' && (
              <div className="space-y-6">
                <p className="text-sm text-primary-400">
                  Upload a recent campaign photo. If you have not worked as a Brand Ambassador, upload a professional photo relevant to your experience.
                </p>

                {/* Headshot */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Headshot <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-col items-center">
                    <div className="w-32 h-32 rounded-full bg-gray-200 overflow-hidden mb-3">
                      {headshotPreview ? (
                        <img src={headshotPreview} alt="Headshot preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary-400">
                          <User className="w-12 h-12" />
                        </div>
                      )}
                    </div>
                    <label className="cursor-pointer">
                      <span className="text-sm font-medium text-primary-400 hover:text-primary-500">
                        {headshotPreview ? 'Change headshot' : 'Upload headshot'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoChange(e, setHeadshotFile, setHeadshotPreview)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Full-Length */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full-Length Photo <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-col items-center">
                    <div className="w-32 h-48 rounded-lg bg-gray-200 overflow-hidden mb-3">
                      {fullLengthPreview ? (
                        <img src={fullLengthPreview} alt="Full-length preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary-400">
                          <User className="w-12 h-12" />
                        </div>
                      )}
                    </div>
                    <label className="cursor-pointer">
                      <span className="text-sm font-medium text-primary-400 hover:text-primary-500">
                        {fullLengthPreview ? 'Change photo' : 'Upload full-length photo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoChange(e, setFullLengthFile, setFullLengthPreview)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={goBack} className="flex-1">Back</Button>
                  <Button type="button" onClick={goNext} className="flex-1">Continue</Button>
                </div>
              </div>
            )}

            {/* Step 3: Resume */}
            {step === 'resume' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  {resumeFile ? (
                    <div className="space-y-2">
                      <FileText className="w-12 h-12 mx-auto text-primary-400" />
                      <p className="font-medium text-gray-900">{resumeFile.name}</p>
                      <p className="text-sm text-primary-400">
                        {(resumeFile.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                      <label className="cursor-pointer">
                        <span className="text-sm font-medium text-primary-400 hover:text-primary-500">
                          Change
                        </span>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handleResumeChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FileText className="w-12 h-12 mx-auto text-gray-300" />
                      <p className="text-primary-400">Upload your resume (PDF)</p>
                      <label className="cursor-pointer">
                        <span className="inline-block px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 text-sm font-medium">
                          Choose File
                        </span>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handleResumeChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-primary-400">PDF, up to 10MB</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={goBack} className="flex-1">Back</Button>
                  <Button type="button" onClick={goNext} className="flex-1">Continue</Button>
                </div>
              </div>
            )}

            {/* Step 4: Details */}
            {step === 'details' && (
              <div className="space-y-4">
                <MultiSelectSearch
                  label="Languages"
                  options={languageOptions}
                  value={languages}
                  onChange={setLanguages}
                  placeholder="Search languages..."
                  allowOther
                  error={undefined}
                />

                <Select
                  label="Shirt Size"
                  options={shirtSizeOptions}
                  value={shirtSize}
                  onChange={(e) => setShirtSize(e.target.value)}
                  placeholder="Select shirt size"
                />

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={goBack} className="flex-1">Back</Button>
                  <Button type="button" onClick={goNext} className="flex-1">Continue</Button>
                </div>
              </div>
            )}

            {/* Step 5: Availability */}
            {step === 'availability' && (
              <form onSubmit={handleFinalSubmit} className="space-y-4">
                <p className="text-sm text-primary-400 mb-4">
                  Select when you&apos;re available to work:
                </p>

                <div className="space-y-3">
                  {daysOfWeek.map((day) => (
                    <div key={day} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 w-24">{day}</span>
                      <div className="flex gap-2">
                        {(['morning', 'afternoon', 'evening'] as const).map((period) => (
                          <button
                            key={period}
                            type="button"
                            onClick={() => toggleAvailability(day, period)}
                            className={`
                              px-3 py-1 text-xs rounded-full transition-colors
                              ${availability[day][period]
                                ? 'bg-primary-400 text-white'
                                : 'bg-gray-100 text-primary-400'
                              }
                            `}
                          >
                            {period.charAt(0).toUpperCase() + period.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <Textarea
                    label="Additional Information (Optional)"
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    placeholder="Tell us anything else relevant to your experience, skills, or availability..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" isLoading={isLoading}>
                    Complete Setup
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

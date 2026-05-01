-- ============================================
-- W-9 + payout fields for contractor payment system
-- ============================================
-- Adds:
--   1. W-9 tax info columns on ba_profiles (TIN encrypted via pgcrypto)
--   2. Payout-method columns on ba_profiles (ACH or PayPal)
--   3. Extended payments table for batch ACH and PayPal Payouts
--   4. RLS policies for new fields
-- ============================================

-- Enable pgcrypto for TIN/ACH encryption (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- ba_profiles: W-9 columns
-- ============================================
ALTER TABLE public.ba_profiles
  ADD COLUMN IF NOT EXISTS w9_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS w9_legal_name TEXT,
  ADD COLUMN IF NOT EXISTS w9_business_name TEXT,
  ADD COLUMN IF NOT EXISTS w9_entity_type TEXT
    CHECK (w9_entity_type IS NULL OR w9_entity_type IN (
      'individual', 'sole_proprietor', 'llc_single', 'llc_partnership',
      'llc_corp', 'c_corp', 's_corp', 'partnership', 'other'
    )),
  ADD COLUMN IF NOT EXISTS w9_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS w9_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS w9_city TEXT,
  ADD COLUMN IF NOT EXISTS w9_state TEXT,
  ADD COLUMN IF NOT EXISTS w9_zip TEXT,
  ADD COLUMN IF NOT EXISTS w9_tin_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS w9_tin_type TEXT
    CHECK (w9_tin_type IS NULL OR w9_tin_type IN ('ssn', 'ein')),
  ADD COLUMN IF NOT EXISTS w9_tin_last4 TEXT,
  ADD COLUMN IF NOT EXISTS w9_signature_name TEXT,
  ADD COLUMN IF NOT EXISTS w9_signature_date DATE,
  ADD COLUMN IF NOT EXISTS w9_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS w9_electronic_consent BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- ba_profiles: Payout columns
-- ============================================
ALTER TABLE public.ba_profiles
  ADD COLUMN IF NOT EXISTS payout_method TEXT
    CHECK (payout_method IS NULL OR payout_method IN ('ach', 'paypal')),
  ADD COLUMN IF NOT EXISTS payout_ach_routing_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS payout_ach_account_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS payout_ach_account_last4 TEXT,
  ADD COLUMN IF NOT EXISTS payout_ach_account_type TEXT
    CHECK (payout_ach_account_type IS NULL OR payout_ach_account_type IN ('checking', 'savings')),
  ADD COLUMN IF NOT EXISTS payout_paypal_email TEXT,
  ADD COLUMN IF NOT EXISTS payout_info_submitted_at TIMESTAMPTZ;

-- ============================================
-- payments: extended columns for ACH batch + PayPal Payouts
-- ============================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('ach_batch', 'paypal')),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS bonus_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reimbursement_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hours_worked DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS paypal_item_id TEXT,
  ADD COLUMN IF NOT EXISTS tax_year INTEGER;

-- Replace status CHECK constraint to add 'queued' and 'cancelled'
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('queued', 'pending', 'processing', 'completed', 'failed', 'cancelled'));

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payments_status
  ON public.payments (status);

CREATE INDEX IF NOT EXISTS idx_payments_tax_year_ba
  ON public.payments (tax_year, ba_id)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_payments_batch
  ON public.payments (batch_id)
  WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_paypal_item
  ON public.payments (paypal_item_id)
  WHERE paypal_item_id IS NOT NULL;

-- ============================================
-- RLS: BAs can view their own payments (already defined in initial schema)
-- Add explicit policy if missing
-- ============================================
DROP POLICY IF EXISTS "BAs can view own payments" ON public.payments;
CREATE POLICY "BAs can view own payments" ON public.payments
  FOR SELECT USING (
    ba_id IN (SELECT id FROM public.ba_profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- Notes:
--   - Encrypted columns (*_encrypted TEXT) are written + read only by the
--     backend using settings.w9_encryption_key with pgcrypto's pgp_sym_encrypt.
--     Frontend never receives ciphertext or plaintext — backend exposes only
--     masked views (last4, presence flags).
--   - "Onboarding complete" is derived: w9_submitted_at IS NOT NULL
--     AND payout_info_submitted_at IS NOT NULL.
-- ============================================

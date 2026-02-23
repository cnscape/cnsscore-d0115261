import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface LeadContactInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;

export function validateLeadContact(value: string): { valid: boolean; type: 'email' | 'phone' | 'unknown'; error?: string } {
  if (!value.trim()) {
    return { valid: false, type: 'unknown', error: 'Lead contact is required' };
  }

  const trimmed = value.trim();

  if (EMAIL_REGEX.test(trimmed)) {
    return { valid: true, type: 'email' };
  }

  // Strip non-digit chars for phone check
  const digitsOnly = trimmed.replace(/[\s\-()]/g, '');
  if (PHONE_REGEX.test(trimmed) && digitsOnly.replace('+', '').length >= 7) {
    return { valid: true, type: 'phone' };
  }

  // If it contains @ it's probably a bad email
  if (trimmed.includes('@')) {
    return { valid: false, type: 'email', error: 'Invalid email format' };
  }

  // If it has mostly digits, it's probably a bad phone
  if (/\d/.test(trimmed)) {
    return { valid: false, type: 'phone', error: 'Invalid phone number (min 7 digits, optional country code)' };
  }

  return { valid: false, type: 'unknown', error: 'Enter a valid email or phone number' };
}

export function LeadContactInput({ value, onChange, error, className }: LeadContactInputProps) {
  const [touched, setTouched] = useState(false);

  const validation = value ? validateLeadContact(value) : null;
  const showError = touched && (error || (validation && !validation.valid));
  const displayError = error || validation?.error;

  // Determine input type for mobile keyboard
  const inputMode = validation?.type === 'phone' ? 'tel' as const : 'email' as const;

  return (
    <div className="space-y-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="Email or phone number"
        inputMode={inputMode}
        className={cn(
          showError && 'border-destructive focus-visible:ring-destructive',
          className
        )}
      />
      {showError && displayError && (
        <p className="text-xs text-destructive">{displayError}</p>
      )}
      {touched && validation?.valid && (
        <p className="text-xs text-[hsl(var(--status-green))]">
          ✓ {validation.type === 'email' ? 'Email' : 'Phone'} detected
        </p>
      )}
    </div>
  );
}

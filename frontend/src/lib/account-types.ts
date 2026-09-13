import {
  Banknote,
  ChartLine,
  CreditCard,
  Gift,
  type LucideIcon
} from 'lucide-react'

import { type AccountType } from '@/lib/client'

// The API spells the enum in UPPER_SNAKE_CASE, so the display label lives
// here and nowhere else. Ordered as the create-account tabs render them.
export const ACCOUNT_TYPES: {
  value: AccountType
  label: string
  icon: LucideIcon
}[] = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
  { value: 'INVESTMENT', label: 'Investment', icon: ChartLine },
  { value: 'REWARD', label: 'Reward', icon: Gift }
]

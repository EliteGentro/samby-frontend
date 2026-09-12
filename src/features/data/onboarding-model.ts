import { questions } from '../../domain/workspace'

export type DataSection =
  | 'sales'
  | 'inventory'
  | 'finance'
  | 'suppliers'
  | 'profile'
export type IntakeBlock = Exclude<DataSection, 'profile'>
export type OnboardingStage = 'business' | 'information' | 'review' | 'result'

export const onboardingStages: readonly {
  id: OnboardingStage
  label: string
}[] = [
  { id: 'business', label: 'Your business' },
  { id: 'information', label: 'Add information' },
  { id: 'review', label: 'Review' },
  { id: 'result', label: 'Your next step' },
]

export const firstQuestions = [
  {
    value: '',
    label: 'Choose later',
    blocks: ['sales', 'inventory', 'finance', 'suppliers'],
    guidance:
      'Start with one recorded sale, a stock position or a receivable. Every information block can wait.',
  },
  {
    value: 'sales',
    label: 'Understand my sales',
    blocks: ['sales', 'inventory', 'finance', 'suppliers'],
    guidance:
      'Start with dated sales. Add product quantities for demand, costs for margin, and collections for cash when you have them.',
  },
  {
    value: 'Q-NEW-ORDER',
    label: questions.find((question) => question.key === 'Q-NEW-ORDER')!.label,
    blocks: ['inventory', 'sales', 'suppliers', 'finance'],
    guidance:
      'Recorded stock helps assess fulfillment. A future order belongs in a scenario, where you can enter its products, quantities and dates.',
  },
  {
    value: 'Q-REPLENISH',
    label: questions.find((question) => question.key === 'Q-REPLENISH')!.label,
    blocks: ['inventory', 'sales', 'suppliers', 'finance'],
    guidance:
      'Start with recorded stock, then dated product sales and supplier lead times. Add purchasing limits or cash when available.',
  },
  {
    value: 'Q-CRITICAL-COLLECTION',
    label: questions.find(
      (question) => question.key === 'Q-CRITICAL-COLLECTION',
    )!.label,
    blocks: ['finance', 'sales', 'inventory', 'suppliers'],
    guidance:
      'Start with the receivable and its expected collection date. Add available cash and dated payments to assess the impact of a delay.',
  },
] satisfies {
  value: string
  label: string
  blocks: IntakeBlock[]
  guidance: string
}[]

export const questionGuidance = (value: string) =>
  firstQuestions.find((question) => question.value === value) ??
  firstQuestions[0]

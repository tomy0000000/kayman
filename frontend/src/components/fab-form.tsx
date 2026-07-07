import { useHotkeys } from 'react-hotkeys-hook'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { SheetFooter } from '@/components/ui/sheet'

interface FabFormProps {
  onSubmit: () => void
  isPending: boolean
  disabled?: boolean
  isEditing?: boolean
  children: React.ReactNode
}

export function FabForm({
  onSubmit,
  isPending,
  disabled = false,
  isEditing = false,
  children
}: FabFormProps) {
  const submit = () => {
    if (isPending || disabled) return
    onSubmit()
  }

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  useHotkeys('mod+enter', submit, {
    enableOnFormTags: true,
    preventDefault: true
  })

  const { label, pendingLabel } = isEditing
    ? { label: 'Save', pendingLabel: 'Saving...' }
    : { label: 'Create', pendingLabel: 'Creating...' }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      <FieldGroup className="flex-1 overflow-y-auto px-4">
        {children}
      </FieldGroup>

      <SheetFooter>
        <Button type="submit" disabled={isPending || disabled}>
          {isPending ? (
            pendingLabel
          ) : (
            <>
              {label}{' '}
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
              </KbdGroup>
            </>
          )}
        </Button>
      </SheetFooter>
    </form>
  )
}

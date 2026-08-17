import { Fab } from '@/components/fab'
import { ResponsiveSheet } from '@/components/responsive-sheet'

interface FabSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hotkey: string
  label: string
  title: string
  className?: string
  children: React.ReactNode
}

export function FabSheet({
  open,
  onOpenChange,
  hotkey,
  label,
  title,
  className,
  children
}: FabSheetProps) {
  return (
    <>
      <Fab hotkey={hotkey} label={label} onOpen={() => onOpenChange(true)} />
      <ResponsiveSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        className={className}
      >
        {children}
      </ResponsiveSheet>
    </>
  )
}

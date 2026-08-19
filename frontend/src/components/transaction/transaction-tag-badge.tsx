import { Badge } from '@/components/ui/badge'
import { type TransactionTagRead } from '@/lib/client'

interface TransactionTagBadgeProps extends React.ComponentProps<typeof Badge> {
  tag: TransactionTagRead
}

function TransactionTagBadge({ tag, ...props }: TransactionTagBadgeProps) {
  return (
    <Badge
      variant="outline"
      // The color is free-form hex from the backend, so it cannot be a Tailwind
      // class. Tint the background and border with it and leave the text at the
      // theme foreground, which stays readable against any hue in both themes.
      {...props}
      style={
        tag.color
          ? {
              backgroundColor: `color-mix(in oklab, ${tag.color} 18%, transparent)`,
              borderColor: `color-mix(in oklab, ${tag.color} 45%, transparent)`
            }
          : props.style
      }
    >
      {tag.name}
    </Badge>
  )
}

export { TransactionTagBadge }

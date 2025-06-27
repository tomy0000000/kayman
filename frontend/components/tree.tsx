/* Modifed from https://github.com/shadcn-ui/ui/issues/355#issuecomment-2405553102 */
"use client"
import { TreeItem } from "@/lib/types"
import { TreeView } from "@primer/react"
import { useEffect, useState } from "react"

interface TreeNodeProps {
  item: TreeItem
  currentId: string | null
  setCurrentId: (currentId: string | null) => void
}

function TreeNode({ item, currentId, setCurrentId }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = item.children && item.children.length > 0

  useEffect(() => {
    if (!!(currentId && currentId.startsWith(item.id))) {
      setExpanded(true)
    }
  }, [currentId, item])

  return (
    <TreeView.Item
      id={item.id}
      expanded={expanded}
      current={currentId === item.id}
      onExpandedChange={setExpanded}
      onSelect={() => {
        setCurrentId(item.id)
      }}
    >
      {item.label}
      {hasChildren && (
        <TreeView.SubTree>
          {item.children!.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              currentId={currentId}
              setCurrentId={setCurrentId}
            />
          ))}
        </TreeView.SubTree>
      )}
    </TreeView.Item>
  )
}

interface TreeProps {
  treeData: TreeItem[]
}

export default function Tree({ treeData }: TreeProps) {
  const [currentId, setCurrentId] = useState<string | null>(null)
  return (
    <TreeView aria-label="Files changed">
      {treeData.map((item) => (
        <TreeNode
          key={item.id}
          item={item}
          currentId={currentId}
          setCurrentId={setCurrentId}
        />
      ))}
    </TreeView>
  )
}

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import InventoryCard, { type InventoryItem } from './InventoryCard'

interface Props {
  item: InventoryItem | null
  open: boolean
  onClose: () => void
  onEditThreshold: (item: InventoryItem) => void
}

export default function InventoryDetailModal({ item, open, onClose, onEditThreshold }: Props) {
  if (!item) return null
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-sm focus:outline-none">
          <Dialog.Title className="sr-only">{item.product_name} detail</Dialog.Title>
          <div className="relative">
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 z-10 bg-white rounded-full p-1 shadow border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
            <InventoryCard item={item} onEditThreshold={onEditThreshold} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

import { UserCog } from 'lucide-react'
import PanelLayout from './PanelLayout'

export default function AdminLayout() {
  return <PanelLayout portalLabel="Admin Portal" PortalIcon={UserCog} />
}

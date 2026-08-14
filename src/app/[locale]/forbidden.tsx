import {NotAutorized} from '@/components/not-autorized'

export default function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <NotAutorized />
    </div>
  )
}

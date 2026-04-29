import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/server'
import { getRestaurants } from '@/lib/supabase/restaurants'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

export default async function HomePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const restaurants = await getRestaurants(supabase)

  async function signOut() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="h-screen relative overflow-hidden" style={{ backgroundColor: '#F7F3EE' }}>
      {/* Frosted glass header — floats over the full-bleed map */}
      <header
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 backdrop-blur-md"
        style={{
          height: 52,
          backgroundColor: 'rgba(247, 243, 238, 0.88)',
          borderBottom: '1px solid rgba(237, 232, 227, 0.8)',
        }}
      >
        <span className="font-semibold text-base" style={{ color: '#C2410C' }}>
          PDX Deliciousness Finder
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: '#6B6560' }}>{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm transition-colors hover:opacity-70"
              style={{ color: '#6B6560' }}
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      {/* Map fills the full viewport — renders behind the header */}
      <main className="absolute inset-0">
        <MapView restaurants={restaurants} />
      </main>
    </div>
  )
}

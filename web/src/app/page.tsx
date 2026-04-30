import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/server'
import { getRestaurants } from '@/lib/supabase/restaurants'

const HomeView = dynamic(() => import('@/components/HomeView'), { ssr: false })

export default async function HomePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const restaurants = await getRestaurants(supabase)

  return <HomeView restaurants={restaurants} userEmail={user.email ?? ''} />
}

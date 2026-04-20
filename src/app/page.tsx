// src/app/page.tsx
// Root redirect — handled by middleware but this is the fallback
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/login')
}

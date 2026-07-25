import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mjtqxmhmhbgvtcvaksod.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qdHF4bWhtaGJndnRjdmFrc29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjYxOTIsImV4cCI6MjA5MjIwMjE5Mn0.1RefnjGHXz_gq742ES99GpNj64eabcrw7CE4z-ydsc0'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.rpc('generate_radicado')
  console.log('rpc result:', data, error)
}

test()

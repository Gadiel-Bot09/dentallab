import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function seed() {
  console.log("Creando usuario admin en Supabase Auth...")
  const email = "admin@clinica.com"
  const password = "Password123!"
  
  // Create user in auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true
  })

  if (authError) {
    if (authError.message.includes("already exists")) {
      console.log("El usuario admin ya estaba registrado en Auth. Omitiendo creación.")
    } else {
      console.error("Error Auth:", authError.message)
    }
  }

  // Get user to ensure we have the ID to insert in public.usuarios
  console.log("Recuperando el ID de usuario...")
  const { data: usersData } = await supabase.auth.admin.listUsers()
  const user = usersData.users.find(u => u.email === email)

  if (!user) {
    console.error("No se pudo encontrar el usuario admin.")
    process.exit(1)
  }

  const { error: dbError } = await supabase.from('usuarios').upsert({
    id: user.id,
    email: email,
    nombre: "Administrador",
    apellido: "Sistema",
    rol: "admin",
    activo: true
  })

  if (dbError) {
    console.error("Error al insertar perfil en tabla usuarios:", dbError.message)
  } else {
    console.log(`\n✅ Credenciales de acceso creadas con éxito:`)
    console.log(`Correo: ${email}`)
    console.log(`Contraseña: ${password}\n`)
  }
}

seed()

// src/lib/rbac.ts
// Catálogo centralizado de Roles y Permisos Granulares (RBAC)
// Compartido entre Server Components, Server Actions, Proxy y UI Cliente.
import type { UserRol } from '@/types/database'

export type ModuloCodigo =
  | 'general'
  | 'insumos'
  | 'protesis'
  | 'farmacia'
  | 'clinica'
  | 'administracion'

export type PermisoCodigo =
  // General
  | 'dashboard.ver'
  // Proceso: Solicitud de Insumos y Devoluciones
  | 'solicitudes.ver'
  | 'solicitudes.crear'
  | 'solicitudes.aprobar'
  | 'solicitudes.despachar'
  | 'solicitudes.recibir'
  | 'solicitudes.anular'
  | 'devoluciones.ver'
  | 'devoluciones.crear'
  | 'devoluciones.confirmar'
  // Proceso: Solicitud de Prótesis (Órdenes Lab)
  | 'ordenes.ver'
  | 'ordenes.crear'
  | 'ordenes.cambiar_estado'
  | 'ordenes.ver_financiero'
  | 'ordenes.documentos'
  // Farmacia, Stock Normativo y Reportes
  | 'farmacia.stock_ver'
  | 'farmacia.recepcion_registrar'
  | 'farmacia.ajustar_stock'
  | 'farmacia.lotes_gestionar'
  | 'farmacia.kardex_ver'
  | 'farmacia.reportes_ver'
  // Clínica, Pacientes e Inventario Lab
  | 'pacientes.ver'
  | 'pacientes.gestionar'
  | 'inventario.ver'
  | 'inventario.gestionar'
  | 'clinica.directorio'
  | 'reportes.lab_ver'
  // Administración y Seguridad
  | 'usuarios.ver'
  | 'usuarios.gestionar'
  | 'roles.gestionar'
  | 'areas.gestionar'
  | 'farmacias.gestionar'
  | 'catalogos.gestionar'

export type RolColor =
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'indigo'
  | 'violet'
  | 'rose'
  | 'teal'
  | 'orange'
  | 'slate'

export interface PermisoDefinicion {
  codigo: PermisoCodigo
  modulo: ModuloCodigo
  nombre: string
  descripcion: string
}

export interface ModuloDefinicion {
  codigo: ModuloCodigo
  titulo: string
  subtitulo: string
  icono: string
  badgeClass: string
}

export interface RolConPermisos {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  color: RolColor
  es_sistema: boolean
  rol_base: UserRol
  home_path: string
  activo: boolean
  permisos: PermisoCodigo[]
  usuarios_count?: number
}

export interface UsuarioPermisoOverride {
  permiso_codigo: PermisoCodigo
  concedido: boolean
}

export const MODULOS_RBAC: ModuloDefinicion[] = [
  {
    codigo: 'insumos',
    titulo: 'Proceso: Solicitud de Insumos y Devoluciones',
    subtitulo: 'Control de todo el ciclo de pedidos de áreas hacia farmacia, despachos y retornos',
    icono: '📝',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  {
    codigo: 'protesis',
    titulo: 'Proceso: Solicitud de Prótesis (Órdenes Lab)',
    subtitulo: 'Creación de órdenes protésicas, odontograma interactivo, estados, documentos y rentabilidad',
    icono: '🦷',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  {
    codigo: 'farmacia',
    titulo: 'Farmacia, Stock Normativo, Lotes y Reportes',
    subtitulo: 'Recepción técnica INVIMA, lotes FEFO, cuarentena, ajustes, traslados, kardex e indicadores',
    icono: '💊',
    badgeClass: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  },
  {
    codigo: 'clinica',
    titulo: 'Clínica, Pacientes e Inventario Laboratorio',
    subtitulo: 'Gestión de pacientes, catálogo de insumos, clínicas/odontólogos y reportes de laboratorio',
    icono: '🧑‍⚕️',
    badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  },
  {
    codigo: 'general',
    titulo: 'Panel General',
    subtitulo: 'Acceso al resumen operativo principal del sistema',
    icono: '📊',
    badgeClass: 'bg-slate-700/60 text-slate-300 border-slate-600',
  },
  {
    codigo: 'administracion',
    titulo: 'Administración, Seguridad y Configuración',
    subtitulo: 'Usuarios, roles personalizados, áreas, farmacias y catálogos maestros',
    icono: '🛡️',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
]

export const PERMISOS_CATALOGO: PermisoDefinicion[] = [
  // General
  { codigo: 'dashboard.ver', modulo: 'general', nombre: 'Ver Dashboard principal', descripcion: 'Acceso al panel principal de indicadores generales' },

  // Proceso: Solicitud de Insumos y Devoluciones
  { codigo: 'solicitudes.ver', modulo: 'insumos', nombre: 'Ver solicitudes de insumos', descripcion: 'Consultar listado y detalle de solicitudes de insumos a farmacia' },
  { codigo: 'solicitudes.crear', modulo: 'insumos', nombre: 'Crear y enviar solicitudes', descripcion: 'Generar nuevas solicitudes puntuales, semanales o mensuales de insumos' },
  { codigo: 'solicitudes.aprobar', modulo: 'insumos', nombre: 'Aprobar o rechazar solicitudes', descripcion: 'Revisar, ajustar cantidades aprobadas o rechazar pedidos en farmacia' },
  { codigo: 'solicitudes.despachar', modulo: 'insumos', nombre: 'Despachar insumos (Farmacia)', descripcion: 'Confirmar despachos totales o parciales descontando stock FEFO' },
  { codigo: 'solicitudes.recibir', modulo: 'insumos', nombre: 'Confirmar recepción en área', descripcion: 'Confirmar recibo de insumos despachados y reportar novedades' },
  { codigo: 'solicitudes.anular', modulo: 'insumos', nombre: 'Anular solicitudes', descripcion: 'Anular solicitudes en borrador, enviadas o aprobadas sin despacho' },
  { codigo: 'devoluciones.ver', modulo: 'insumos', nombre: 'Ver devoluciones', descripcion: 'Consultar listado y detalle de devoluciones hacia farmacia' },
  { codigo: 'devoluciones.crear', modulo: 'insumos', nombre: 'Registrar devoluciones de área', descripcion: 'Solicitar devolución de insumos sobrantes, vencidos o defectuosos' },
  { codigo: 'devoluciones.confirmar', modulo: 'insumos', nombre: 'Confirmar devoluciones (Farmacia)', descripcion: 'Aceptar o rechazar devoluciones reingresando al inventario de farmacia' },

  // Proceso: Solicitud de Prótesis (Órdenes Lab)
  { codigo: 'ordenes.ver', modulo: 'protesis', nombre: 'Ver órdenes de prótesis', descripcion: 'Consultar órdenes de servicio protésico y odontogramas' },
  { codigo: 'ordenes.crear', modulo: 'protesis', nombre: 'Crear solicitud de prótesis', descripcion: 'Registrar nuevas órdenes protésicas con odontograma y materiales' },
  { codigo: 'ordenes.cambiar_estado', modulo: 'protesis', nombre: 'Cambiar estado de órdenes', descripcion: 'Avanzar estados del flujo protésico (envío lab, recibido, entregado)' },
  { codigo: 'ordenes.ver_financiero', modulo: 'protesis', nombre: 'Ver costos y rentabilidad protésica', descripcion: 'Visualizar costos de materiales, precio de venta y margen bruto' },
  { codigo: 'ordenes.documentos', modulo: 'protesis', nombre: 'Gestionar documentos y fotos', descripcion: 'Subir y descargar especificaciones, radiografías y fotos de órdenes' },

  // Farmacia, Stock Normativo y Reportes
  { codigo: 'farmacia.stock_ver', modulo: 'farmacia', nombre: 'Ver stock y lotes de farmacia', descripcion: 'Consultar existencias, vencimientos FEFO y actas de recepción' },
  { codigo: 'farmacia.recepcion_registrar', modulo: 'farmacia', nombre: 'Registrar entradas / compras', descripcion: 'Ejecutar recepción técnica normativa (lotes, INVIMA, código barras, acta PDF)' },
  { codigo: 'farmacia.ajustar_stock', modulo: 'farmacia', nombre: 'Ajustar y configurar stock', descripcion: 'Realizar ajustes físicos, traslados entre farmacias y umbrales mín/máx' },
  { codigo: 'farmacia.lotes_gestionar', modulo: 'farmacia', nombre: 'Gestionar cuarentena y lotes', descripcion: 'Liberar lotes de cuarentena, poner en cuarentena o retirar vencidos' },
  { codigo: 'farmacia.kardex_ver', modulo: 'farmacia', nombre: 'Ver Kardex inmutable', descripcion: 'Auditar historial completo de entradas, salidas, lotes y usuarios' },
  { codigo: 'farmacia.reportes_ver', modulo: 'farmacia', nombre: 'Ver indicadores y exportar reportes', descripcion: 'Consultar consumo por área y exportar reportes a Excel y PDF' },

  // Clínica, Pacientes e Inventario Lab
  { codigo: 'pacientes.ver', modulo: 'clinica', nombre: 'Ver pacientes', descripcion: 'Consultar historias clínicas básicas y listado de pacientes' },
  { codigo: 'pacientes.gestionar', modulo: 'clinica', nombre: 'Crear y editar pacientes', descripcion: 'Registrar nuevos pacientes y actualizar datos demográficos' },
  { codigo: 'inventario.ver', modulo: 'clinica', nombre: 'Ver catálogo / inventario lab', descripcion: 'Consultar catálogo maestro de insumos y stock del laboratorio' },
  { codigo: 'inventario.gestionar', modulo: 'clinica', nombre: 'Crear y editar insumos en catálogo', descripcion: 'Registrar nuevos insumos, códigos de barras, INVIMA y precios' },
  { codigo: 'clinica.directorio', modulo: 'clinica', nombre: 'Ver clínicas, labs y odontólogos', descripcion: 'Acceder a directorios de laboratorios aliados y odontólogos' },
  { codigo: 'reportes.lab_ver', modulo: 'clinica', nombre: 'Ver reportes de laboratorio', descripcion: 'Consultar indicadores de producción y rentabilidad de prótesis' },

  // Administración y Seguridad
  { codigo: 'usuarios.ver', modulo: 'administracion', nombre: 'Ver usuarios del sistema', descripcion: 'Consultar listado de cuentas de usuario y su estado' },
  { codigo: 'usuarios.gestionar', modulo: 'administracion', nombre: 'Crear y editar usuarios', descripcion: 'Crear cuentas, asignar roles/áreas/farmacias y restablecer contraseñas' },
  { codigo: 'roles.gestionar', modulo: 'administracion', nombre: 'Gestionar roles y permisos', descripcion: 'Crear roles personalizados y modificar la matriz de permisos del sistema' },
  { codigo: 'areas.gestionar', modulo: 'administracion', nombre: 'Gestionar áreas institucionales', descripcion: 'Crear, editar áreas y asignar centros de costo y responsables' },
  { codigo: 'farmacias.gestionar', modulo: 'administracion', nombre: 'Gestionar farmacias / bodegas', descripcion: 'Crear y configurar sedes o bodegas de farmacia' },
  { codigo: 'catalogos.gestionar', modulo: 'administracion', nombre: 'Gestionar catálogos maestros', descripcion: 'Configurar especialidades, servicios protésicos, categorías y unidades' },
]

export const ALL_PERMISOS: PermisoCodigo[] = PERMISOS_CATALOGO.map((p) => p.codigo)

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRol, PermisoCodigo[]> = {
  admin: ALL_PERMISOS,
  farmacia: [
    'dashboard.ver',
    'solicitudes.ver', 'solicitudes.aprobar', 'solicitudes.despachar', 'solicitudes.anular',
    'devoluciones.ver', 'devoluciones.confirmar',
    'farmacia.stock_ver', 'farmacia.recepcion_registrar', 'farmacia.ajustar_stock',
    'farmacia.lotes_gestionar', 'farmacia.kardex_ver', 'farmacia.reportes_ver',
    'inventario.ver', 'inventario.gestionar',
  ],
  jefe_area: [
    'dashboard.ver',
    'solicitudes.ver', 'solicitudes.crear', 'solicitudes.recibir', 'solicitudes.anular',
    'devoluciones.ver', 'devoluciones.crear',
    'farmacia.reportes_ver',
  ],
  odontologo: [
    'dashboard.ver',
    'solicitudes.ver', 'solicitudes.crear', 'solicitudes.recibir',
    'ordenes.ver', 'ordenes.crear', 'ordenes.cambiar_estado', 'ordenes.ver_financiero', 'ordenes.documentos',
    'pacientes.ver', 'pacientes.gestionar',
    'clinica.directorio', 'reportes.lab_ver',
  ],
  auxiliar: [
    'dashboard.ver',
    'solicitudes.ver', 'solicitudes.crear', 'solicitudes.recibir',
    'devoluciones.ver', 'devoluciones.crear',
    'ordenes.ver', 'ordenes.crear', 'ordenes.cambiar_estado', 'ordenes.documentos',
    'pacientes.ver', 'pacientes.gestionar',
    'inventario.ver', 'clinica.directorio',
  ],
  recepcionista: [
    'dashboard.ver',
    'solicitudes.ver',
    'ordenes.ver', 'ordenes.crear', 'ordenes.cambiar_estado', 'ordenes.documentos',
    'pacientes.ver', 'pacientes.gestionar',
    'clinica.directorio',
  ],
  laboratorio: [
    'ordenes.ver', 'ordenes.cambiar_estado', 'ordenes.documentos',
  ],
}

export const ROL_COLOR_STYLES: Record<RolColor, { label: string; badge: string; dot: string }> = {
  sky:     { label: 'Azul Celeste', badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30', dot: 'bg-sky-400' },
  emerald: { label: 'Esmeralda',    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  amber:   { label: 'Ámbar',        badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  indigo:  { label: 'Índigo',       badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', dot: 'bg-indigo-400' },
  violet:  { label: 'Violeta',      badge: 'bg-violet-500/15 text-violet-400 border-violet-500/30', dot: 'bg-violet-400' },
  rose:    { label: 'Rosa',         badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30', dot: 'bg-rose-400' },
  teal:    { label: 'Turquesa',     badge: 'bg-teal-500/15 text-teal-400 border-teal-500/30', dot: 'bg-teal-400' },
  orange:  { label: 'Naranja',      badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' },
  slate:   { label: 'Gris Pizarra', badge: 'bg-slate-700/60 text-slate-300 border-slate-600', dot: 'bg-slate-400' },
}

export const HOME_PATH_OPTIONS = [
  { value: '/dashboard', label: 'Dashboard Principal (/dashboard)' },
  { value: '/solicitudes', label: 'Solicitudes de Insumos (/solicitudes)' },
  { value: '/ordenes', label: 'Órdenes de Prótesis (/ordenes)' },
  { value: '/farmacia/stock', label: 'Stock de Farmacia (/farmacia/stock)' },
  { value: '/pacientes', label: 'Pacientes (/pacientes)' },
  { value: '/externo/ordenes', label: 'Portal Externo Laboratorio (/externo/ordenes)' },
]

export const ROL_BASE_OPTIONS: { value: UserRol; label: string; desc: string }[] = [
  { value: 'auxiliar',      label: 'Interno General (Auxiliar)',     desc: 'Acceso interno estándar a módulos clínicos y solicitudes' },
  { value: 'farmacia',      label: 'Operación Farmacia / Bodega',    desc: 'Habilitado para operar stock, lotes y kardex de farmacia' },
  { value: 'jefe_area',     label: 'Solicitante / Área Institucional', desc: 'Enfocado en consumo, solicitudes y devoluciones por área' },
  { value: 'odontologo',    label: 'Clínico / Odontólogo',           desc: 'Enfocado en órdenes protésicas, odontograma y pacientes' },
  { value: 'recepcionista', label: 'Recepción / Admisiones',         desc: 'Gestión de pacientes y seguimiento básico' },
  { value: 'laboratorio',   label: 'Portal Externo (Laboratorio)',   desc: 'Solo accede al portal móvil/externo de laboratorio' },
  { value: 'admin',         label: 'Administrador Total',            desc: 'Privilegios totales de superadministrador' },
]

/** Calcula el conjunto efectivo de permisos de un usuario combinando su rol + overrides individuales */
export function computeEffectivePermissions(
  rolePermissions: PermisoCodigo[],
  overrides: UsuarioPermisoOverride[],
  isAdmin: boolean
): PermisoCodigo[] {
  if (isAdmin) return [...ALL_PERMISOS]
  const set = new Set<PermisoCodigo>(rolePermissions)
  for (const ov of overrides) {
    if (ov.concedido) set.add(ov.permiso_codigo)
    else set.delete(ov.permiso_codigo)
  }
  return Array.from(set)
}

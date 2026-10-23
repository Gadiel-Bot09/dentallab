'use client'
// src/app/(interno)/farmacias/_components/FarmaciaList.tsx
import { useState, useTransition } from 'react'
import type { Farmacia, Usuario } from '@/types/database'
import {
  crearFarmaciaAction,
  editarFarmaciaAction,
  toggleFarmaciaAction,
  asignarUsuariosFarmaciaAction,
} from '../actions'

interface FarmaciaListProps {
  initialFarmacias: Farmacia[]
  usuarios: Usuario[]
}

export default function FarmaciaList({ initialFarmacias, usuarios }: FarmaciaListProps) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFarmacia, setEditingFarmacia] = useState<Farmacia | null>(null)
  const [assignModalFarmacia, setAssignModalFarmacia] = useState<Farmacia | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filteredFarmacias = initialFarmacias.filter(
    (f) =>
      f.nombre.toLowerCase().includes(search.toLowerCase()) ||
      f.codigo.toLowerCase().includes(search.toLowerCase()) ||
      (f.ubicacion && f.ubicacion.toLowerCase().includes(search.toLowerCase()))
  )

  function openCreateModal() {
    setEditingFarmacia(null)
    setError(null)
    setModalOpen(true)
  }

  function openEditModal(farmacia: Farmacia) {
    setEditingFarmacia(farmacia)
    setError(null)
    setModalOpen(true)
  }

  function openAssignModal(farmacia: Farmacia) {
    setAssignModalFarmacia(farmacia)
    const currentIds = (farmacia.usuarios_asignados || []).map((u) => u.usuario_id)
    setSelectedUserIds(currentIds)
    setModalOpen(false)
  }

  async function handleSubmitFarmacia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = editingFarmacia
        ? await editarFarmaciaAction(editingFarmacia.id, fd)
        : await crearFarmaciaAction(fd)

      if (!res.success) {
        setError(res.error || 'Ocurrió un error')
      } else {
        setModalOpen(false)
      }
    })
  }

  async function handleToggle(farmacia: Farmacia) {
    startTransition(async () => {
      const res = await toggleFarmaciaAction(farmacia.id, !farmacia.activa)
      if (!res.success) alert(res.error)
    })
  }

  async function handleSaveAssignments() {
    if (!assignModalFarmacia) return
    startTransition(async () => {
      const res = await asignarUsuariosFarmaciaAction(assignModalFarmacia.id, selectedUserIds)
      if (!res.success) {
        alert(res.error)
      } else {
        setAssignModalFarmacia(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nombre o ubicación..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
        >
          <span>➕</span>
          <span>Nueva Farmacia / Bodega</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFarmacias.map((farmacia) => {
          const userCount = (farmacia.usuarios_asignados || []).length
          return (
            <div
              key={farmacia.id}
              className={`p-5 rounded-2xl border transition-all ${
                farmacia.activa
                  ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {farmacia.codigo}
                    </span>
                    {!farmacia.activa && (
                      <span className="px-2 py-0.5 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        Inactiva
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1.5">{farmacia.nombre}</h3>
                </div>
                <button
                  onClick={() => handleToggle(farmacia)}
                  disabled={isPending}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                    farmacia.activa
                      ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                      : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                  title="Cambiar estado activa/inactiva"
                >
                  {farmacia.activa ? 'Activa' : 'Desactivada'}
                </button>
              </div>

              {farmacia.ubicacion && (
                <p className="text-xs text-slate-400 mt-2">
                  <span className="text-slate-500">📍 Ubicación:</span> {farmacia.ubicacion}
                </p>
              )}

              {farmacia.descripcion && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{farmacia.descripcion}</p>
              )}

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div>
                  <span className="text-slate-500">Regente / Responsable: </span>
                  <span className="text-slate-300 font-medium">
                    {farmacia.responsable
                      ? `${farmacia.responsable.nombre} ${farmacia.responsable.apellido}`
                      : 'Sin asignar'}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/40">
                <button
                  onClick={() => openAssignModal(farmacia)}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <span>💊</span>
                  <span>{userCount} personal de farmacia</span>
                </button>
                <button
                  onClick={() => openEditModal(farmacia)}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  ✏️ Editar
                </button>
              </div>
            </div>
          )
        })}

        {filteredFarmacias.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
            <p className="text-3xl mb-2">🏥</p>
            <p className="text-base font-medium text-slate-400">No hay farmacias registradas</p>
            <p className="text-xs mt-1">Crea al menos una farmacia o bodega central para comenzar a despachar insumos.</p>
          </div>
        )}
      </div>

      {/* Modal Crear/Editar Farmacia */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                {editingFarmacia ? 'Editar Farmacia' : 'Nueva Farmacia / Bodega Central'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-500 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitFarmacia} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Código Único <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="codigo"
                    defaultValue={editingFarmacia?.codigo || ''}
                    placeholder="Ej: FARM-CENTRAL, BODEGA-1"
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white uppercase placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Ubicación Física
                  </label>
                  <input
                    name="ubicacion"
                    defaultValue={editingFarmacia?.ubicacion || ''}
                    placeholder="Ej: Piso 1, Sótano Torre B"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nombre de la Farmacia <span className="text-red-400">*</span>
                </label>
                <input
                  name="nombre"
                  defaultValue={editingFarmacia?.nombre || ''}
                  placeholder="Ej: Farmacia Central, Farmacia de Consulta Externa"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Responsable / Regente
                </label>
                <select
                  name="responsable_id"
                  defaultValue={editingFarmacia?.responsable_id || ''}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="">-- Sin asignar --</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} {u.apellido} ({u.rol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Descripción / Horarios
                </label>
                <textarea
                  name="descripcion"
                  defaultValue={editingFarmacia?.descripcion || ''}
                  rows={3}
                  placeholder="Horarios de atención para despachos, teléfonos internos..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                >
                  {isPending ? 'Guardando...' : editingFarmacia ? 'Guardar Cambios' : 'Crear Farmacia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Personal a Farmacia */}
      {assignModalFarmacia && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Asignar Personal a Farmacia</h3>
                <p className="text-xs text-emerald-400 font-mono mt-0.5">
                  {assignModalFarmacia.codigo} — {assignModalFarmacia.nombre}
                </p>
              </div>
              <button
                onClick={() => setAssignModalFarmacia(null)}
                className="text-slate-500 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Los usuarios seleccionados podrán aprobar, despachar insumos, gestionar stock y confirmar devoluciones en esta farmacia.
            </p>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {usuarios.map((u) => {
                const checked = selectedUserIds.includes(u.id)
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-sm cursor-pointer transition-all ${
                      checked
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUserIds([...selectedUserIds, u.id])
                        } else {
                          setSelectedUserIds(selectedUserIds.filter((id) => id !== u.id))
                        }
                      }}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium leading-tight">
                        {u.nombre} {u.apellido}
                      </p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {u.rol}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                {selectedUserIds.length} usuario(s) seleccionado(s)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalFarmacia(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={isPending}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                >
                  {isPending ? 'Guardando...' : 'Guardar Asignaciones'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

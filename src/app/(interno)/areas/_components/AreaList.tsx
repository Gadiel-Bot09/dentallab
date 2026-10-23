'use client'
// src/app/(interno)/areas/_components/AreaList.tsx
import { useState, useTransition } from 'react'
import type { Area, Usuario } from '@/types/database'
import {
  crearAreaAction,
  editarAreaAction,
  toggleAreaAction,
  asignarUsuariosAreaAction,
} from '../actions'

interface AreaListProps {
  initialAreas: Area[]
  usuarios: Usuario[]
}

export default function AreaList({ initialAreas, usuarios }: AreaListProps) {
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | null>(null)
  const [assignModalArea, setAssignModalArea] = useState<Area | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filteredAreas = initialAreas.filter(
    (a) =>
      a.nombre.toLowerCase().includes(search.toLowerCase()) ||
      a.codigo.toLowerCase().includes(search.toLowerCase()) ||
      (a.centro_costo && a.centro_costo.toLowerCase().includes(search.toLowerCase()))
  )

  function openCreateModal() {
    setEditingArea(null)
    setError(null)
    setModalOpen(true)
  }

  function openEditModal(area: Area) {
    setEditingArea(area)
    setError(null)
    setModalOpen(true)
  }

  function openAssignModal(area: Area) {
    setAssignModalArea(area)
    const currentIds = (area.usuarios_asignados || []).map((u) => u.usuario_id)
    setSelectedUserIds(currentIds)
    setModalOpen(false)
  }

  async function handleSubmitArea(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = editingArea
        ? await editarAreaAction(editingArea.id, fd)
        : await crearAreaAction(fd)

      if (!res.success) {
        setError(res.error || 'Ocurrió un error')
      } else {
        setModalOpen(false)
      }
    })
  }

  async function handleToggle(area: Area) {
    startTransition(async () => {
      const res = await toggleAreaAction(area.id, !area.activa)
      if (!res.success) alert(res.error)
    })
  }

  async function handleSaveAssignments() {
    if (!assignModalArea) return
    startTransition(async () => {
      const res = await asignarUsuariosAreaAction(assignModalArea.id, selectedUserIds)
      if (!res.success) {
        alert(res.error)
      } else {
        setAssignModalArea(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nombre o centro de costo..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-sky-500/20 transition-all"
        >
          <span>➕</span>
          <span>Nueva Área</span>
        </button>
      </div>

      {/* Grid of Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAreas.map((area) => {
          const userCount = (area.usuarios_asignados || []).length
          return (
            <div
              key={area.id}
              className={`p-5 rounded-2xl border transition-all ${
                area.activa
                  ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {area.codigo}
                    </span>
                    {!area.activa && (
                      <span className="px-2 py-0.5 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        Inactiva
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1.5">{area.nombre}</h3>
                </div>
                <button
                  onClick={() => handleToggle(area)}
                  disabled={isPending}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                    area.activa
                      ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                      : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                  title="Cambiar estado activa/inactiva"
                >
                  {area.activa ? 'Activa' : 'Desactivada'}
                </button>
              </div>

              {area.centro_costo && (
                <p className="text-xs text-slate-400 mt-2">
                  <span className="text-slate-500">C. Costo:</span> {area.centro_costo}
                </p>
              )}

              {area.descripcion && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{area.descripcion}</p>
              )}

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div>
                  <span className="text-slate-500">Responsable: </span>
                  <span className="text-slate-300 font-medium">
                    {area.responsable
                      ? `${area.responsable.nombre} ${area.responsable.apellido}`
                      : 'Sin asignar'}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/40">
                <button
                  onClick={() => openAssignModal(area)}
                  className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <span>👥</span>
                  <span>{userCount} {userCount === 1 ? 'usuario' : 'usuarios'}</span>
                </button>
                <button
                  onClick={() => openEditModal(area)}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  ✏️ Editar
                </button>
              </div>
            </div>
          )
        })}

        {filteredAreas.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
            <p className="text-3xl mb-2">🏢</p>
            <p className="text-base font-medium text-slate-400">No se encontraron áreas</p>
            <p className="text-xs mt-1">Crea tu primera área para que los jefes de área puedan solicitar insumos.</p>
          </div>
        )}
      </div>

      {/* Modal Crear/Editar Área */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                {editingArea ? 'Editar Área' : 'Nueva Área de la Institución'}
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

            <form onSubmit={handleSubmitArea} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Código Único <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="codigo"
                    defaultValue={editingArea?.codigo || ''}
                    placeholder="Ej: CIRUGIA, ODONT-1"
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white uppercase placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Centro de Costo
                  </label>
                  <input
                    name="centro_costo"
                    defaultValue={editingArea?.centro_costo || ''}
                    placeholder="Ej: CC-1020"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nombre del Área <span className="text-red-400">*</span>
                </label>
                <input
                  name="nombre"
                  defaultValue={editingArea?.nombre || ''}
                  placeholder="Ej: Odontopediatría, Cirugía Oral, Urgencias"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Responsable / Jefe de Área
                </label>
                <select
                  name="responsable_id"
                  defaultValue={editingArea?.responsable_id || ''}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
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
                  Descripción / Observaciones
                </label>
                <textarea
                  name="descripcion"
                  defaultValue={editingArea?.descripcion || ''}
                  rows={3}
                  placeholder="Ubicación física, piso, o detalles del área..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none"
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
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg shadow-sky-500/20 transition-all"
                >
                  {isPending ? 'Guardando...' : editingArea ? 'Guardar Cambios' : 'Crear Área'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Usuarios al Área */}
      {assignModalArea && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Asignar Usuarios a Área</h3>
                <p className="text-xs text-sky-400 font-mono mt-0.5">
                  {assignModalArea.codigo} — {assignModalArea.nombre}
                </p>
              </div>
              <button
                onClick={() => setAssignModalArea(null)}
                className="text-slate-500 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Los usuarios seleccionados podrán generar y recibir pedidos de insumos a nombre de esta área.
            </p>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {usuarios.map((u) => {
                const checked = selectedUserIds.includes(u.id)
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-sm cursor-pointer transition-all ${
                      checked
                        ? 'bg-sky-500/10 border-sky-500/30 text-white'
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
                      className="rounded border-slate-700 text-sky-500 focus:ring-sky-500"
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
                  onClick={() => setAssignModalArea(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={isPending}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg shadow-sky-500/20 transition-all"
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

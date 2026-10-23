'use client'
// src/app/(interno)/_components/InsumoSearchSelect.tsx
import { useState, useRef, useEffect, useMemo } from 'react'

export interface MaterialSearchOption {
  id: string
  codigo: string
  nombre: string
  categoria?: { nombre: string } | null
  unidad_medida?: { nombre: string; abreviatura: string | null } | null
  precio_unitario?: number
}

interface InsumoSearchSelectProps {
  materials: MaterialSearchOption[]
  value: string
  onChange: (materialId: string, material?: MaterialSearchOption) => void
  stockMap?: Record<string, number> // material_id -> stock disponible
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function InsumoSearchSelect({
  materials,
  value,
  onChange,
  stockMap,
  placeholder = 'Buscar por código o nombre...',
  className = '',
  disabled = false,
}: InsumoSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === value),
    [materials, value]
  )

  // Filtrado en tiempo real por nombre, código o categoría
  const filteredMaterials = useMemo(() => {
    if (!searchTerm.trim()) return materials
    const term = searchTerm.toLowerCase().trim()
    return materials.filter(
      (m) =>
        m.nombre.toLowerCase().includes(term) ||
        m.codigo.toLowerCase().includes(term) ||
        (m.categoria?.nombre && m.categoria.nombre.toLowerCase().includes(term))
    )
  }, [materials, searchTerm])

  // Reset active index when search term changes
  useEffect(() => {
    setActiveIndex(0)
  }, [searchTerm])

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setSearchTerm('')
    }
  }, [isOpen])

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  function handleSelect(mat: MaterialSearchOption) {
    onChange(mat.id, mat)
    setIsOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('', undefined)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) =>
        prev < filteredMaterials.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : filteredMaterials.length - 1
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredMaterials[activeIndex]) {
        handleSelect(filteredMaterials[activeIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Botón Disparador / Vista Seleccionada */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-lg text-xs transition-all border ${
          disabled
            ? 'bg-slate-950/50 border-slate-900 text-slate-600 cursor-not-allowed'
            : isOpen
            ? 'bg-slate-950 border-sky-500 ring-2 ring-sky-500/30 text-white'
            : selectedMaterial
            ? 'bg-slate-950 border-slate-700 hover:border-slate-600 text-white'
            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-500'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-slate-500 shrink-0">🔍</span>
          {selectedMaterial ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                {selectedMaterial.codigo}
              </span>
              <span className="font-medium text-white truncate text-xs">
                {selectedMaterial.nombre}
              </span>
              <span className="text-[11px] text-slate-400 shrink-0">
                ({selectedMaterial.unidad_medida?.abreviatura || selectedMaterial.unidad_medida?.nombre || 'Und'})
              </span>
            </div>
          ) : (
            <span className="truncate text-slate-500">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedMaterial && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
              title="Borrar selección"
            >
              ✕
            </span>
          )}
          <span className="text-slate-500 text-[10px]">
            {isOpen ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Popover / Menú desplegable flotante con buscador integrado */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[340px] max-w-lg bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Input de Búsqueda Rápida */}
          <div className="p-2.5 bg-slate-950/90 border-b border-slate-800">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                🔍
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Escribe código (ej: MAT-0001) o nombre..."
                className="w-full pl-8 pr-7 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-1">
              <span>
                {filteredMaterials.length} insumo(s) encontrado(s)
              </span>
              <span className="text-slate-500">
                Usa ↑ ↓ y Enter para elegir
              </span>
            </div>
          </div>

          {/* Lista de Resultados */}
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-slate-800/50 p-1"
          >
            {filteredMaterials.map((mat, idx) => {
              const isSelected = mat.id === value
              const isActive = idx === activeIndex
              const stock = stockMap ? stockMap[mat.id] ?? 0 : null

              return (
                <li
                  key={mat.id}
                  onClick={() => handleSelect(mat)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`p-2.5 rounded-lg text-xs cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-sky-500/15 text-white'
                      : isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        {mat.codigo}
                      </span>
                      <p className="font-semibold text-white truncate">
                        {mat.nombre}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                      {mat.categoria?.nombre && (
                        <span>{mat.categoria.nombre}</span>
                      )}
                      <span>·</span>
                      <span>
                        Unidad: {mat.unidad_medida?.abreviatura || mat.unidad_medida?.nombre || 'Und'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {stock !== null && (
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                          stock > 0
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}
                      >
                        {stock > 0 ? `Stock: ${stock}` : 'Sin Stock'}
                      </span>
                    )}
                    {isSelected && (
                      <span className="block text-sky-400 font-bold text-xs mt-0.5">
                        ✓
                      </span>
                    )}
                  </div>
                </li>
              )
            })}

            {filteredMaterials.length === 0 && (
              <li className="py-8 px-4 text-center text-slate-500 text-xs">
                <p className="text-xl mb-1">🔍</p>
                <p className="text-slate-400 font-medium">
                  No se encontró ningún insumo con &ldquo;{searchTerm}&rdquo;
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Verifica que el código o nombre esté bien escrito.
                </p>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

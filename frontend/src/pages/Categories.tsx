import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryPreference,
  updateCategoryColor,
} from "../api/categories";
import { CategoryFormModal } from "../components/transactions/CategoryFormModal";
import type { Category, CategoryType } from "../types";

const typeLabels: Record<CategoryType, string> = {
  income: "Ingreso",
  expense: "Egreso",
  both: "Ambos",
};

const DEFAULT_SWATCH = "#0f766e"; // --color-accent

interface CategoryTableProps {
  title: string;
  categories: Category[];
  open: boolean;
  onToggle: () => void;
  editable: boolean;
  onColorChange: (c: Category, color: string) => void;
  onToggleHidden: (c: Category) => void;
  onEdit?: (c: Category) => void;
  onDelete?: (c: Category) => void;
}

function CategoryTable({
  title,
  categories,
  open,
  onToggle,
  editable,
  onColorChange,
  onToggleHidden,
  onEdit,
  onDelete,
}: CategoryTableProps) {
  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark overflow-hidden mb-6">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-4 py-3 text-left text-sm font-medium text-ink-light dark:text-ink-dark hover:bg-line-light/40 dark:hover:bg-line-dark/40"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {title}
        <span className="text-ink-muted-light dark:text-ink-muted-dark font-normal">
          ({categories.length})
        </span>
      </button>

      {open && (
        <table className="w-full text-sm border-t border-line-light dark:border-line-dark">
          <thead>
            <tr className="border-b border-line-light dark:border-line-dark text-left text-ink-muted-light dark:text-ink-muted-dark">
              <th className="px-4 py-3 font-medium w-10">Color</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted-light dark:text-ink-muted-dark">
                  No hay categorías.
                </td>
              </tr>
            ) : (
              categories.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b border-line-light dark:border-line-dark last:border-0 ${
                    c.is_hidden ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <label
                      className="relative inline-flex items-center cursor-pointer"
                      title="Cambiar color"
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-line-light dark:border-line-dark"
                        style={{ backgroundColor: c.color ?? "transparent" }}
                      />
                      <input
                        type="color"
                        value={c.color ?? DEFAULT_SWATCH}
                        onChange={(e) => onColorChange(c, e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>
                  </td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark">
                    {typeLabels[c.type]}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {editable && (
                        <>
                          <button
                            onClick={() => onEdit?.(c)}
                            className="text-ink-muted-light dark:text-ink-muted-dark hover:text-accent"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => onDelete?.(c)}
                            className="text-ink-muted-light dark:text-ink-muted-dark hover:text-negative"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onToggleHidden(c)}
                        className="text-ink-muted-light dark:text-ink-muted-dark hover:text-accent"
                        title={c.is_hidden ? "Mostrar" : "Ocultar"}
                      >
                        {c.is_hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [showGlobal, setShowGlobal] = useState(true);
  const [showPersonal, setShowPersonal] = useState(true);

  // Debounce por categoría para no spamear el PATCH mientras se arrastra el picker.
  const colorTimers = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listCategories(showHidden);
      setCategories(data);
    } finally {
      setIsLoading(false);
    }
  }, [showHidden]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setModalOpen(true);
  }

  async function handleSubmit(name: string, type: CategoryType) {
    if (editing) {
      await updateCategory(editing.id, { name, type });
    } else {
      await createCategory(name, type);
    }
    await load();
  }

  async function handleToggleHidden(c: Category) {
    await updateCategoryPreference(c.id, { is_hidden: !c.is_hidden });
    await load();
  }

  function handleColorChange(c: Category, color: string) {
    // Actualización optimista para que el swatch responda de inmediato.
    setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, color } : x)));
    window.clearTimeout(colorTimers.current[c.id]);
    colorTimers.current[c.id] = window.setTimeout(() => {
      updateCategoryColor(c.id, color).catch(() => load());
    }, 400);
  }

  async function handleDelete(c: Category) {
    if (!confirm(`¿Eliminar "${c.name}"? Esta acción no se puede deshacer.`)) return;
    await deleteCategory(c.id);
    await load();
  }

  const globalCategories = categories.filter((c) => c.user_id === null);
  const personalCategories = categories.filter((c) => c.user_id !== null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">Categorías</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90"
        >
          <Plus size={18} />
          Nueva
        </button>
      </div>

      <label className="flex items-center gap-2 mb-4 text-sm text-ink-muted-light dark:text-ink-muted-dark">
        <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
        Mostrar ocultas
      </label>

      {isLoading ? (
        <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando...</p>
      ) : (
        <>
          <CategoryTable
            title="Categorías propias"
            categories={personalCategories}
            open={showPersonal}
            onToggle={() => setShowPersonal((v) => !v)}
            editable
            onColorChange={handleColorChange}
            onToggleHidden={handleToggleHidden}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
          <CategoryTable
            title="Categorías globales"
            categories={globalCategories}
            open={showGlobal}
            onToggle={() => setShowGlobal((v) => !v)}
            editable={false}
            onColorChange={handleColorChange}
            onToggleHidden={handleToggleHidden}
          />
        </>
      )}

      {modalOpen && (
        <CategoryFormModal category={editing} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryPreference,
} from "../api/categories";
import { CategoryFormModal } from "../components/categories/CategoryFormModal";
import type { Category, CategoryType } from "../types";

const typeLabels: Record<CategoryType, string> = {
  income: "Ingreso",
  expense: "Egreso",
  both: "Ambos",
};

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

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

  async function handleDelete(c: Category) {
    if (!confirm(`¿Eliminar "${c.name}"? Esta acción no se puede deshacer.`)) return;
    await deleteCategory(c.id);
    await load();
  }

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
        <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-light dark:border-line-dark text-left text-ink-muted-light dark:text-ink-muted-dark">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const isGlobal = c.user_id === null;
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-line-light dark:border-line-dark last:border-0 ${
                      c.is_hidden ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark">{typeLabels[c.type]}</td>
                    <td className="px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark">
                      {isGlobal ? "Global" : "Propia"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {!isGlobal && (
                          <>
                            <button
                              onClick={() => openEdit(c)}
                              className="text-ink-muted-light dark:text-ink-muted-dark hover:text-accent"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(c)}
                              className="text-ink-muted-light dark:text-ink-muted-dark hover:text-negative"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleToggleHidden(c)}
                          className="text-ink-muted-light dark:text-ink-muted-dark hover:text-accent"
                        >
                          {c.is_hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <CategoryFormModal category={editing} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}

import { useState, useRef } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react";
import { useCategories } from "../hooks/useCategories";
import { useCategoriesStore } from "../store/categoriesStore";
import { CategoryFormModal } from "../components/transactions/CategoryFormModal";
import { ColorPickerButton } from "../components/common/ColorPickerButton";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { categoryColor } from "../utils/categoryColor";
import type { Category, CategoryType } from "../types";

const typeLabels: Record<CategoryType, string> = {
  income: "Ingreso",
  expense: "Egreso",
  both: "Ambos",
};

const typeStyles: Record<CategoryType, string> = {
  income: "bg-positive/15 text-positive",
  expense: "bg-negative/15 text-negative",
  both: "bg-accent-soft text-accent dark:bg-accent/20 dark:text-accent-dark",
};

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
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark overflow-x-auto mb-6">
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
                    <ColorPickerButton
                      value={categoryColor(c.id, c.color)}
                      onChange={(color) => onColorChange(c, color)}
                      size={16}
                    />
                  </td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeStyles[c.type]}`}>
                      {typeLabels[c.type]}
                    </span>
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
  const { toast } = useToast();
  const confirm = useConfirm();
  const [showHidden, setShowHidden] = useState(false);
  // Cache siempre trae el superset (incluye ocultas); el checkbox solo filtra
  // en cliente, no vuelve a pedir nada al backend.
  const { categories: allCategories, isLoading } = useCategories(true);
  const categories = showHidden ? allCategories : allCategories.filter((c) => !c.is_hidden);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [showGlobal, setShowGlobal] = useState(true);
  const [showPersonal, setShowPersonal] = useState(true);

  // Debounce por categoría para no spamear el PATCH mientras se arrastra el picker.
  const colorTimers = useRef<Record<string, number>>({});

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setModalOpen(true);
  }

  async function handleSubmit(name: string, type: CategoryType, color: string) {
    const store = useCategoriesStore.getState();
    if (editing) {
      await store.update(editing.id, { name, type });
      if (color !== categoryColor(editing.id, editing.color)) {
        await store.setPreference(editing.id, { color });
      }
    } else {
      const created = await store.create(name, type);
      await store.setPreference(created.id, { color });
    }
    toast.success(editing ? "Categoría actualizada." : "Categoría creada.");
  }

  async function handleToggleHidden(c: Category) {
    await useCategoriesStore.getState().setPreference(c.id, { is_hidden: !c.is_hidden });
  }

  function handleColorChange(c: Category, color: string) {
    // Actualización optimista para que el swatch responda de inmediato.
    useCategoriesStore.setState((s) => ({
      items: s.items.map((x) => (x.id === c.id ? { ...x, color } : x)),
    }));
    window.clearTimeout(colorTimers.current[c.id]);
    colorTimers.current[c.id] = window.setTimeout(() => {
      useCategoriesStore
        .getState()
        .setPreference(c.id, { color })
        .catch(() => useCategoriesStore.getState().refresh());
    }, 400);
  }

  async function handleDelete(c: Category) {
    if (!(await confirm({ message: `¿Eliminar "${c.name}"? Esta acción no se puede deshacer.`, tone: "danger" }))) return;
    try {
      await useCategoriesStore.getState().remove(c.id);
      toast.success("Categoría eliminada.");
    } catch {
      toast.error("No se pudo eliminar la categoría.");
    }
  }

  const globalCategories = categories.filter((c) => c.user_id === null);
  const personalCategories = categories.filter((c) => c.user_id !== null);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-ink-light dark:text-ink-dark">Categorías</h1>
        <div className="flex items-center gap-2 shrink-0">
          {/* En móvil ya está la campana de MobileHeader; esta es solo para desktop. */}
          <div className="hidden md:block">
            <NotificationBell align="right" />
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90"
          >
            <Plus size={18} className="shrink-0" />
            Nueva
          </button>
        </div>
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

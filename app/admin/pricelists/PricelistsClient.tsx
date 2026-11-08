"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import BulkPasteModal from "./BulkPasteModal";
import EventCategoryPanel, { type EventInfo } from "./EventCategoryPanel";

type Item = {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  status: "available" | "sold_out";
  notes: string | null;
  sortOrder: number;
};

type Category = {
  id: string;
  name: string;
  group: "main" | "others";
  sortOrder: number;
  items: Item[];
  events?: EventInfo[];
};

type Game = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  categories: Category[];
};

type ItemDraft = {
  name: string;
  price: string;
  originalPrice: string;
  status: "available" | "sold_out";
  notes: string;
};

const EMPTY_ITEM_DRAFT: ItemDraft = {
  name: "",
  price: "",
  originalPrice: "",
  status: "available",
  notes: "",
};

export default function PricelistsClient({
  initialGames,
}: {
  initialGames: Game[];
}) {
  const [games, setGames] = useState(initialGames);
  const [selectedGameId, setSelectedGameId] = useState(
    initialGames[0]?.id ?? "",
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialGames[0]?.categories[0]?.id ?? "",
  );

  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryNameDraft, setCategoryNameDraft] = useState("");
  const [categoryGroupDraft, setCategoryGroupDraft] = useState<
    "main" | "others"
  >("main");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [categoryEditDraft, setCategoryEditDraft] = useState<{
    name: string;
    group: "main" | "others";
  }>({ name: "", group: "main" });

  const [addingItem, setAddingItem] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(EMPTY_ITEM_DRAFT);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemEditDraft, setItemEditDraft] =
    useState<ItemDraft>(EMPTY_ITEM_DRAFT);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const selectedGame = games.find((g) => g.id === selectedGameId);
  const categories = selectedGame?.categories ?? [];
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const soldOutCount = selectedCategory?.items.filter((it) => it.status === "sold_out").length ?? 0;
  // Event categories (e.g. Event Skin Gifting) show their events from the Events page instead of items
  const isEventCategory =
    !!selectedCategory &&
    selectedCategory.items.length === 0 &&
    ((selectedCategory.events?.length ?? 0) > 0 || /event skin gifting/i.test(selectedCategory.name));
  const q = itemQuery.trim().toLowerCase();
  const visibleItems = (selectedCategory?.items ?? []).filter(
    (it) => !q || it.name.toLowerCase().includes(q) || (it.notes ?? "").toLowerCase().includes(q),
  );

  function selectGame(id: string) {
    setSelectedGameId(id);
    setItemQuery("");
    const g = games.find((x) => x.id === id);
    setSelectedCategoryId(g?.categories[0]?.id ?? "");
    setAddingCategory(false);
    setEditingCategoryId(null);
    setAddingItem(false);
    setEditingItemId(null);
    setError(null);
  }

  function selectCategory(id: string) {
    setSelectedCategoryId(id);
    setItemQuery("");
    setAddingItem(false);
    setEditingItemId(null);
    setError(null);
  }

  // --- Category CRUD (no reordering) ---

  async function submitAddCategory() {
    if (!categoryNameDraft.trim() || !selectedGameId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: selectedGameId,
          name: categoryNameDraft.trim(),
          group: categoryGroupDraft,
        }),
      });
      if (!res.ok) throw new Error();
      const newCat = await res.json();
      setGames((prev) =>
        prev.map((g) =>
          g.id === selectedGameId
            ? { ...g, categories: [...g.categories, { ...newCat, items: [] }] }
            : g,
        ),
      );
      setSelectedCategoryId(newCat.id);
      setCategoryNameDraft("");
      setCategoryGroupDraft("main");
      setAddingCategory(false);
    } catch {
      setError("Failed to add category. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function startEditCategory(cat: Category) {
    setEditingCategoryId(cat.id);
    setCategoryEditDraft({ name: cat.name, group: cat.group });
  }

  async function submitEditCategory(id: string) {
    if (!categoryEditDraft.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryEditDraft.name.trim(),
          group: categoryEditDraft.group,
        }),
      });
      if (!res.ok) throw new Error();
      setGames((prev) =>
        prev.map((g) => ({
          ...g,
          categories: g.categories.map((c) =>
            c.id === id
              ? {
                  ...c,
                  name: categoryEditDraft.name.trim(),
                  group: categoryEditDraft.group,
                }
              : c,
          ),
        })),
      );
      setEditingCategoryId(null);
    } catch {
      setError("Failed to update category. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function deleteCategory(id: string) {
    setConfirmModal({
      message:
        "Delete this category and all its pricelist items? This cannot be undone.",
      onConfirm: () => performDeleteCategory(id),
    });
  }

  async function performDeleteCategory(id: string) {
    setConfirmModal(null);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete category.");
      setGames((prev) =>
        prev.map((g) => ({
          ...g,
          categories: g.categories.filter((c) => c.id !== id),
        })),
      );
      if (selectedCategoryId === id) {
        const remaining = categories.filter((c) => c.id !== id);
        setSelectedCategoryId(remaining[0]?.id ?? "");
      }
    } catch (e: any) {
      setError(e.message || "Failed to delete category.");
    } finally {
      setBusy(false);
    }
  }

  // --- Item CRUD ---

  function parsePrice(v: string): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  async function submitAddItem() {
    if (!itemDraft.name.trim() || !selectedCategoryId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          name: itemDraft.name.trim(),
          price: parsePrice(itemDraft.price),
          originalPrice: itemDraft.originalPrice
            ? parsePrice(itemDraft.originalPrice)
            : null,
          status: itemDraft.status,
          notes: itemDraft.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const newItem = await res.json();
      setGames((prev) =>
        prev.map((g) => ({
          ...g,
          categories: g.categories.map((c) =>
            c.id === selectedCategoryId
              ? {
                  ...c,
                  items: [
                    ...c.items,
                    {
                      ...newItem,
                      price: Number(newItem.price),
                      originalPrice:
                        newItem.originalPrice != null
                          ? Number(newItem.originalPrice)
                          : null,
                    },
                  ],
                }
              : c,
          ),
        })),
      );
      setItemDraft(EMPTY_ITEM_DRAFT);
      setAddingItem(false);
    } catch {
      setError("Failed to add item. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function startEditItem(item: Item) {
    setEditingItemId(item.id);
    setItemEditDraft({
      name: item.name,
      price: String(item.price),
      originalPrice:
        item.originalPrice != null ? String(item.originalPrice) : "",
      status: item.status,
      notes: item.notes ?? "",
    });
  }

  async function submitEditItem(id: string) {
    if (!itemEditDraft.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: itemEditDraft.name.trim(),
        price: parsePrice(itemEditDraft.price),
        originalPrice: itemEditDraft.originalPrice
          ? parsePrice(itemEditDraft.originalPrice)
          : null,
        status: itemEditDraft.status,
        notes: itemEditDraft.notes.trim() || null,
      };
      const res = await fetch(`/api/admin/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setGames((prev) =>
        prev.map((g) => ({
          ...g,
          categories: g.categories.map((c) => ({
            ...c,
            items: c.items.map((it) =>
              it.id === id ? { ...it, ...payload } : it,
            ),
          })),
        })),
      );
      setEditingItemId(null);
    } catch {
      setError("Failed to update item. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function deleteItem(id: string) {
    setConfirmModal({
      message: "Delete this pricelist item? This cannot be undone.",
      onConfirm: () => performDeleteItem(id),
    });
  }

  async function performDeleteItem(id: string) {
    setConfirmModal(null);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/items/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete item.");
      setGames((prev) =>
        prev.map((g) => ({
          ...g,
          categories: g.categories.map((c) => ({
            ...c,
            items: c.items.filter((it) => it.id !== id),
          })),
        })),
      );
    } catch (e: any) {
      setError(e.message || "Failed to delete item.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSoldOut(item: Item) {
    const nextStatus = item.status === "available" ? "sold_out" : "available";
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      setGames((prev) =>
        prev.map((g) => ({
          ...g,
          categories: g.categories.map((c) => ({
            ...c,
            items: c.items.map((it) =>
              it.id === item.id ? { ...it, status: nextStatus } : it,
            ),
          })),
        })),
      );
    } catch {
      setError("Failed to update status.");
    } finally {
      setBusy(false);
    }
  }

  // --- Drag-and-drop reordering for games ---

  async function handleGameDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sortedGames = [...games].sort((a, b) => a.sortOrder - b.sortOrder);
    const oldIndex = sortedGames.findIndex((g) => g.id === active.id);
    const newIndex = sortedGames.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedGames, oldIndex, newIndex).map(
      (g, i) => ({ ...g, sortOrder: i }),
    );

    setGames(reordered);

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/games/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((g) => g.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError(
        "Failed to save new game order. Refresh to see the saved order.",
      );
    } finally {
      setBusy(false);
    }
  }

  // --- Drag-and-drop reordering for categories (within the same group) ---

  async function handleCategoryDragEnd(
    group: "main" | "others",
    event: DragEndEvent,
  ) {
    if (!selectedGame) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const groupCats = selectedGame.categories
      .filter((c) => c.group === group)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const oldIndex = groupCats.findIndex((c) => c.id === active.id);
    const newIndex = groupCats.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedGroup = arrayMove(groupCats, oldIndex, newIndex);
    const otherGroupCats = selectedGame.categories.filter(
      (c) => c.group !== group,
    );

    // Optimistic UI update — only re-number the dragged group; other group untouched
    setGames((prev) =>
      prev.map((g) => ({
        ...g,
        categories: g.categories.map((c) => {
          const idx = reorderedGroup.findIndex((rc) => rc.id === c.id);
          return idx === -1 ? c : { ...c, sortOrder: idx };
        }),
      })),
    );

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reorderedGroup.map((c) => c.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError(
        "Failed to save new category order. Refresh to see the saved order.",
      );
    } finally {
      setBusy(false);
    }
  }

  // --- Drag-and-drop reordering for items ---

  async function handleItemDragEnd(event: DragEndEvent) {
    if (!selectedCategory) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const items = selectedCategory.items;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);

    // Optimistic UI update
    setGames((prev) =>
      prev.map((g) => ({
        ...g,
        categories: g.categories.map((c) =>
          c.id === selectedCategoryId
            ? {
                ...c,
                items: reordered.map((it, i) => ({ ...it, sortOrder: i })),
              }
            : c,
        ),
      })),
    );

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/items/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((it) => it.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError("Failed to save new order. Refresh to see the saved order.");
    } finally {
      setBusy(false);
    }
  }

  const mainCats = categories
    .filter((c) => c.group === "main")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const otherCats = categories
    .filter((c) => c.group === "others")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedGames = [...games].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <h1 className="admin-page-title">Pricelists</h1>
      <p className="field-hint">
        Manage categories and pricelist items per game.
      </p>

      {error && (
        <div className="error-msg" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="bulk-notice" onClick={() => setNotice(null)}>
          ✓ {notice}
        </div>
      )}

      <div className="panel">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleGameDragEnd}
        >
          <SortableContext
            items={sortedGames.map((g) => g.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              {sortedGames.map((g) => (
                <SortableGameButton
                  key={g.id}
                  game={g}
                  active={g.id === selectedGameId}
                  onSelect={() => selectGame(g.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div
          style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}
        >
          {/* Category list — no reordering */}
          <div>
            <div
              className="panel-head"
              style={{ justifyContent: "space-between" }}
            >
              <h2>Categories</h2>
              <button
                className="qty-btn icon-btn"
                title="Add category"
                onClick={() => setAddingCategory(true)}
              >
                +
              </button>
            </div>

            {addingCategory && (
              <div
                style={{
                  marginBottom: 12,
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  paddingBottom: 12,
                }}
              >
                <input
                  className="field-input"
                  placeholder="Category name"
                  value={categoryNameDraft}
                  onChange={(e) => setCategoryNameDraft(e.target.value)}
                />
                <select
                  className="others-sel"
                  style={{ marginTop: 8, width: "100%" }}
                  value={categoryGroupDraft}
                  onChange={(e) =>
                    setCategoryGroupDraft(e.target.value as "main" | "others")
                  }
                >
                  <option value="main">Main Category</option>
                  <option value="others">Others</option>
                </select>
                <div className="item-actions" style={{ marginTop: 8 }}>
                  <button
                    className="qty-btn icon-btn icon-btn-confirm"
                    title="Save"
                    disabled={busy}
                    onClick={submitAddCategory}
                  >
                    ✓
                  </button>
                  <button
                    className="qty-btn icon-btn icon-btn-cancel"
                    title="Cancel"
                    onClick={() => {
                      setAddingCategory(false);
                      setCategoryNameDraft("");
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {mainCats.length > 0 && (
              <p className="field-hint" style={{ marginBottom: 4 }}>
                Main
              </p>
            )}
            {mainCats.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleCategoryDragEnd("main", e)}
              >
                <SortableContext
                  items={mainCats.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {mainCats.map((c) =>
                    editingCategoryId === c.id ? (
                      <CategoryEditRow
                        key={c.id}
                        editDraft={categoryEditDraft}
                        setEditDraft={setCategoryEditDraft}
                        onSave={() => submitEditCategory(c.id)}
                        onCancel={() => setEditingCategoryId(null)}
                        busy={busy}
                      />
                    ) : (
                      <SortableCategoryRow
                        key={c.id}
                        cat={c}
                        active={c.id === selectedCategoryId}
                        onSelect={() => selectCategory(c.id)}
                        onEdit={() => startEditCategory(c)}
                        onDelete={() => deleteCategory(c.id)}
                      />
                    ),
                  )}
                </SortableContext>
              </DndContext>
            )}

            {otherCats.length > 0 && (
              <p
                className="field-hint"
                style={{ marginTop: 12, marginBottom: 4 }}
              >
                Others
              </p>
            )}
            {otherCats.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleCategoryDragEnd("others", e)}
              >
                <SortableContext
                  items={otherCats.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {otherCats.map((c) =>
                    editingCategoryId === c.id ? (
                      <CategoryEditRow
                        key={c.id}
                        editDraft={categoryEditDraft}
                        setEditDraft={setCategoryEditDraft}
                        onSave={() => submitEditCategory(c.id)}
                        onCancel={() => setEditingCategoryId(null)}
                        busy={busy}
                      />
                    ) : (
                      <SortableCategoryRow
                        key={c.id}
                        cat={c}
                        active={c.id === selectedCategoryId}
                        onSelect={() => selectCategory(c.id)}
                        onEdit={() => startEditCategory(c)}
                        onDelete={() => deleteCategory(c.id)}
                      />
                    ),
                  )}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Item table — drag to reorder */}
          <div className="pl-items">
            {!selectedCategory ? (
              <div className="pl-empty">Select a category on the left to manage its items.</div>
            ) : isEventCategory ? (
              <EventCategoryPanel categoryName={selectedCategory.name} events={selectedCategory.events ?? []} />
            ) : (
              <>
                <div className="pl-toolbar">
                  <div className="pl-title">
                    <h2>{selectedCategory.name}</h2>
                    <span>
                      {selectedCategory.items.length} item{selectedCategory.items.length === 1 ? "" : "s"}
                      {soldOutCount > 0 && ` · ${soldOutCount} sold out`}
                    </span>
                  </div>
                  <div className="pl-actions">
                    {selectedCategory.items.length > 0 && (
                      <input
                        className="pl-search"
                        type="search"
                        placeholder="Search items…"
                        value={itemQuery}
                        onChange={(e) => setItemQuery(e.target.value)}
                      />
                    )}
                    <button
                      className="pl-btn"
                      onClick={() => { setNotice(null); setBulkOpen(true); }}
                      title="Paste rows from Google Sheets to add or update many items at once"
                    >
                      Bulk Paste
                    </button>
                    <button
                      className="pl-btn pl-btn-primary"
                      disabled={addingItem}
                      onClick={() => setAddingItem(true)}
                    >
                      + Add Item
                    </button>
                  </div>
                </div>

                {addingItem && (
                  <div className="pl-add-card">
                    <div className="pl-add-grid">
                      <div className="pl-add-name">
                        <label className="field-label">Item Name</label>
                        <input
                          className="field-input"
                          placeholder="e.g. 56 Diamonds"
                          autoFocus
                          value={itemDraft.name}
                          onChange={(e) => setItemDraft((d) => ({ ...d, name: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") submitAddItem(); }}
                        />
                      </div>
                      <div>
                        <label className="field-label">Price</label>
                        <div className="input-prefix">
                          <span>₱</span>
                          <input
                            className="field-input"
                            placeholder="0"
                            type="number"
                            min="0"
                            value={itemDraft.price}
                            onChange={(e) => setItemDraft((d) => ({ ...d, price: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") submitAddItem(); }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="field-label">Original Price</label>
                        <div className="input-prefix">
                          <span>₱</span>
                          <input
                            className="field-input"
                            placeholder="Optional"
                            type="number"
                            min="0"
                            value={itemDraft.originalPrice}
                            onChange={(e) => setItemDraft((d) => ({ ...d, originalPrice: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="field-label">Status</label>
                        <select
                          className="field-input"
                          value={itemDraft.status}
                          onChange={(e) =>
                            setItemDraft((d) => ({ ...d, status: e.target.value as "available" | "sold_out" }))
                          }
                        >
                          <option value="available">Available</option>
                          <option value="sold_out">Sold Out</option>
                        </select>
                      </div>
                      <div className="pl-add-notes">
                        <label className="field-label">Notes</label>
                        <input
                          className="field-input"
                          placeholder="Optional — e.g. No rush"
                          value={itemDraft.notes}
                          onChange={(e) => setItemDraft((d) => ({ ...d, notes: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="pl-add-actions">
                      <button
                        className="pl-btn"
                        onClick={() => { setAddingItem(false); setItemDraft(EMPTY_ITEM_DRAFT); }}
                      >
                        Cancel
                      </button>
                      <button
                        className="pl-btn pl-btn-primary"
                        disabled={busy || !itemDraft.name.trim() || itemDraft.price === ""}
                        onClick={submitAddItem}
                      >
                        {busy ? "Saving…" : "Save Item"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="pl-table-wrap">
                <table className="admin-table pl-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}></th>
                      <th>Name</th>
                      <th className="pl-num">Price</th>
                      <th className="pl-num">Original</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCategory.items.length === 0 && (
                      <tr>
                        <td colSpan={7} className="pl-empty-row">
                          No items yet. Click <strong>+ Add Item</strong> or <strong>Bulk Paste</strong> to add some.
                        </td>
                      </tr>
                    )}
                    {selectedCategory.items.length > 0 && visibleItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="pl-empty-row">No items match “{itemQuery}”.</td>
                      </tr>
                    )}
                    {visibleItems.length > 0 && (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleItemDragEnd}
                      >
                        <SortableContext
                          items={selectedCategory.items.map((it) => it.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {visibleItems.map((it) =>
                            editingItemId === it.id ? (
                              <ItemEditRow
                                key={it.id}
                                editDraft={itemEditDraft}
                                setEditDraft={setItemEditDraft}
                                onSave={() => submitEditItem(it.id)}
                                onCancel={() => setEditingItemId(null)}
                                busy={busy}
                              />
                            ) : (
                              <SortableItemRow
                                key={it.id}
                                item={it}
                                dragDisabled={!!itemQuery.trim()}
                                onEdit={() => startEditItem(it)}
                                onDelete={() => deleteItem(it.id)}
                                onToggleSoldOut={() => toggleSoldOut(it)}
                              />
                            ),
                          )}
                        </SortableContext>
                      </DndContext>
                    )}
                  </tbody>
                </table>
                </div>
                {itemQuery.trim() && visibleItems.length > 0 && (
                  <p className="field-hint" style={{ marginTop: 8 }}>Clear the search to drag and reorder items.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {bulkOpen && selectedCategory && (
        <BulkPasteModal
          categoryId={selectedCategory.id}
          categoryName={selectedCategory.name}
          items={selectedCategory.items}
          onClose={() => setBulkOpen(false)}
          onApplied={(items, summary) => {
            setGames((prev) =>
              prev.map((g) => ({
                ...g,
                categories: g.categories.map((c) =>
                  c.id === selectedCategory.id ? { ...c, items } : c,
                ),
              })),
            );
            setBulkOpen(false);
            setNotice(`${selectedCategory.name}: ${summary}.`);
          }}
        />
      )}

      {confirmModal && (
        <div className="qr-modal-overlay" onClick={() => setConfirmModal(null)}>
          <div
            className="qr-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 380 }}
          >
            <h3>Confirm Delete</h3>
            <p
              className="field-hint"
              style={{ marginBottom: 20, fontSize: 13.5 }}
            >
              {confirmModal.message}
            </p>
            <div className="item-actions" style={{ justifyContent: "center" }}>
              <button
                className="qty-btn icon-btn-cancel"
                style={{ width: "auto", padding: "10px 20px" }}
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                className="qty-btn icon-btn-confirm"
                style={{ width: "auto", padding: "10px 20px" }}
                disabled={busy}
                onClick={confirmModal.onConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function SortableGameButton({
  game,
  active,
  onSelect,
}: {
  game: Game;
  active: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: game.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: "grab",
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      className={`cat-btn ${active ? "active" : ""}`}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      {game.name}
    </button>
  );
}
function SortableCategoryRow({
  cat,
  active,
  onSelect,
  onEdit,
  onDelete,
}: {
  cat: Category;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 6,
        padding: "8px 6px",
        borderRadius: 6,
        cursor: "pointer",
        background: isDragging
          ? "rgba(255,255,255,0.1)"
          : active
            ? "rgba(255,255,255,0.08)"
            : "transparent",
      }}
      onClick={onSelect}
    >
      <span
        style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}
      >
        <button
          className="qty-btn icon-btn"
          title="Drag to reorder"
          style={{ cursor: "grab" }}
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span style={{ fontSize: 13.5 }}>
          {cat.name} <span className="field-hint">({cat.items.length})</span>
        </span>
      </span>
      <span className="item-actions" onClick={(e) => e.stopPropagation()}>
        <button className="qty-btn icon-btn" title="Edit" onClick={onEdit}>
          ✎
        </button>
        <button className="qty-btn icon-btn" title="Delete" onClick={onDelete}>
          ✕
        </button>
      </span>
    </div>
  );
}

function CategoryEditRow({
  editDraft,
  setEditDraft,
  onSave,
  onCancel,
  busy,
}: {
  editDraft: { name: string; group: "main" | "others" };
  setEditDraft: (d: { name: string; group: "main" | "others" }) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div
      style={{
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <input
        className="field-input"
        value={editDraft.name}
        onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
      />
      <select
        className="others-sel"
        style={{ marginTop: 6, width: "100%" }}
        value={editDraft.group}
        onChange={(e) =>
          setEditDraft({
            ...editDraft,
            group: e.target.value as "main" | "others",
          })
        }
      >
        <option value="main">Main Category</option>
        <option value="others">Others</option>
      </select>
      <div className="item-actions" style={{ marginTop: 6 }}>
        <button
          className="qty-btn icon-btn icon-btn-confirm"
          title="Save"
          disabled={busy}
          onClick={onSave}
        >
          ✓
        </button>
        <button
          className="qty-btn icon-btn icon-btn-cancel"
          title="Cancel"
          onClick={onCancel}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function SortableItemRow({
  item,
  dragDisabled,
  onEdit,
  onDelete,
  onToggleSoldOut,
}: {
  item: Item;
  dragDisabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSoldOut: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: dragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? "rgba(255,255,255,0.06)" : undefined,
  };
  const soldOut = item.status === "sold_out";

  return (
    <tr ref={setNodeRef} style={style} className={`pl-row ${soldOut ? "pl-row-soldout" : ""}`}>
      <td>
        {!dragDisabled && (
          <button className="pl-drag" title="Drag to reorder" {...attributes} {...listeners}>
            ⠿
          </button>
        )}
      </td>
      <td className="pl-name">{item.name}</td>
      <td className="pl-num pl-price">₱{item.price.toLocaleString()}</td>
      <td className="pl-num">
        {item.originalPrice != null ? <s className="pl-orig">₱{item.originalPrice.toLocaleString()}</s> : <span className="pl-dash">—</span>}
      </td>
      <td>
        <button
          className={`pl-status ${soldOut ? "pl-status-out" : "pl-status-ok"}`}
          title={soldOut ? "Click to mark available" : "Click to mark sold out"}
          onClick={onToggleSoldOut}
        >
          {soldOut ? "Sold Out" : "Available"}
        </button>
      </td>
      <td className="pl-notes" title={item.notes ?? undefined}>{item.notes || <span className="pl-dash">—</span>}</td>
      <td className="actions-cell">
        <div className="item-actions pl-row-actions">
          <button className="pl-icon" title="Edit" aria-label={`Edit ${item.name}`} onClick={onEdit}>
            ✎
          </button>
          <button className="pl-icon pl-icon-danger" title="Delete" aria-label={`Delete ${item.name}`} onClick={onDelete}>
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

function ItemEditRow({
  editDraft,
  setEditDraft,
  onSave,
  onCancel,
  busy,
}: {
  editDraft: ItemDraft;
  setEditDraft: (d: ItemDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <tr>
      <td></td>
      <td>
        <input
          className="field-input"
          value={editDraft.name}
          onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
        />
      </td>
      <td>
        <input
          className="field-input"
          type="number"
          value={editDraft.price}
          onChange={(e) =>
            setEditDraft({ ...editDraft, price: e.target.value })
          }
        />
      </td>
      <td>
        <input
          className="field-input"
          type="number"
          value={editDraft.originalPrice}
          onChange={(e) =>
            setEditDraft({ ...editDraft, originalPrice: e.target.value })
          }
        />
      </td>
      <td>
        <select
          className="others-sel"
          value={editDraft.status}
          onChange={(e) =>
            setEditDraft({
              ...editDraft,
              status: e.target.value as "available" | "sold_out",
            })
          }
        >
          <option value="available">Available</option>
          <option value="sold_out">Sold Out</option>
        </select>
      </td>
      <td>
        <input
          className="field-input"
          value={editDraft.notes}
          onChange={(e) =>
            setEditDraft({ ...editDraft, notes: e.target.value })
          }
        />
      </td>
      <td className="actions-cell">
        <div className="item-actions">
          <button
            className="qty-btn icon-btn icon-btn-confirm"
            title="Save"
            disabled={busy}
            onClick={onSave}
          >
            ✓
          </button>
          <button
            className="qty-btn icon-btn icon-btn-cancel"
            title="Cancel"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

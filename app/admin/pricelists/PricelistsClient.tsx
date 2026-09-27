'use client';

import { useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Item = {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  status: 'available' | 'sold_out';
  notes: string | null;
  sortOrder: number;
};

type Category = {
  id: string;
  name: string;
  group: 'main' | 'others';
  sortOrder: number;
  items: Item[];
};

type Game = {
  id: string;
  name: string;
  slug: string;
  categories: Category[];
};

type ItemDraft = {
  name: string;
  price: string;
  originalPrice: string;
  status: 'available' | 'sold_out';
  notes: string;
};

const EMPTY_ITEM_DRAFT: ItemDraft = { name: '', price: '', originalPrice: '', status: 'available', notes: '' };

export default function PricelistsClient({ initialGames }: { initialGames: Game[] }) {
  const [games, setGames] = useState(initialGames);
  const [selectedGameId, setSelectedGameId] = useState(initialGames[0]?.id ?? '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialGames[0]?.categories[0]?.id ?? '');

  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
  const [categoryGroupDraft, setCategoryGroupDraft] = useState<'main' | 'others'>('main');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryEditDraft, setCategoryEditDraft] = useState<{ name: string; group: 'main' | 'others' }>({ name: '', group: 'main' });

  const [addingItem, setAddingItem] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(EMPTY_ITEM_DRAFT);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemEditDraft, setItemEditDraft] = useState<ItemDraft>(EMPTY_ITEM_DRAFT);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const selectedGame = games.find((g) => g.id === selectedGameId);
  const categories = selectedGame?.categories ?? [];
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  function selectGame(id: string) {
    setSelectedGameId(id);
    const g = games.find((x) => x.id === id);
    setSelectedCategoryId(g?.categories[0]?.id ?? '');
    setAddingCategory(false);
    setEditingCategoryId(null);
    setAddingItem(false);
    setEditingItemId(null);
    setError(null);
  }

  function selectCategory(id: string) {
    setSelectedCategoryId(id);
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
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: selectedGameId, name: categoryNameDraft.trim(), group: categoryGroupDraft }),
      });
      if (!res.ok) throw new Error();
      const newCat = await res.json();
      setGames((prev) =>
        prev.map((g) =>
          g.id === selectedGameId ? { ...g, categories: [...g.categories, { ...newCat, items: [] }] } : g
        )
      );
      setSelectedCategoryId(newCat.id);
      setCategoryNameDraft('');
      setCategoryGroupDraft('main');
      setAddingCategory(false);
    } catch {
      setError('Failed to add category. Please try again.');
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryEditDraft.name.trim(), group: categoryEditDraft.group }),
      });
      if (!res.ok) throw new Error();
      setGames((prev) =>
        prev.map((g) => ({
          ...g,
          categories: g.categories.map((c) =>
            c.id === id ? { ...c, name: categoryEditDraft.name.trim(), group: categoryEditDraft.group } : c
          ),
        }))
      );
      setEditingCategoryId(null);
    } catch {
      setError('Failed to update category. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function deleteCategory(id: string) {
    setConfirmModal({
      message: 'Delete this category and all its pricelist items? This cannot be undone.',
      onConfirm: () => performDeleteCategory(id),
    });
  }

  async function performDeleteCategory(id: string) {
    setConfirmModal(null);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete category.');
      setGames((prev) => prev.map((g) => ({ ...g, categories: g.categories.filter((c) => c.id !== id) })));
      if (selectedCategoryId === id) {
        const remaining = categories.filter((c) => c.id !== id);
        setSelectedCategoryId(remaining[0]?.id ?? '');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to delete category.');
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
      const res = await fetch('/api/admin/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          name: itemDraft.name.trim(),
          price: parsePrice(itemDraft.price),
          originalPrice: itemDraft.originalPrice ? parsePrice(itemDraft.originalPrice) : null,
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
                      originalPrice: newItem.originalPrice != null ? Number(newItem.originalPrice) : null,
                    },
                  ],
                }
              : c
          ),
        }))
      );
      setItemDraft(EMPTY_ITEM_DRAFT);
      setAddingItem(false);
    } catch {
      setError('Failed to add item. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function startEditItem(item: Item) {
    setEditingItemId(item.id);
    setItemEditDraft({
      name: item.name,
      price: String(item.price),
      originalPrice: item.originalPrice != null ? String(item.originalPrice) : '',
      status: item.status,
      notes: item.notes ?? '',
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
        originalPrice: itemEditDraft.originalPrice ? parsePrice(itemEditDraft.originalPrice) : null,
        status: itemEditDraft.status,
        notes: itemEditDraft.notes.trim() || null,
      };
      const res = await fetch(`/api/admin/items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setGames((prev) =>
        prev.map((g) => ({
          ...g,
          categories: g.categories.map((c) => ({
            ...c,
            items: c.items.map((it) => (it.id === id ? { ...it, ...payload } : it)),
          })),
        }))
      );
      setEditingItemId(null);
    } catch {
      setError('Failed to update item. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function deleteItem(id: string) {
    setConfirmModal({
      message: 'Delete this pricelist item? This cannot be undone.',
      onConfirm: () => performDeleteItem(id),
    });
  }

  async function performDeleteItem(id: string) {
    setConfirmModal(null);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/items/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete item.');
      setGames((prev) =>
        prev.map((g) => ({
          ...g,
          categories: g.categories.map((c) => ({ ...c, items: c.items.filter((it) => it.id !== id) })),
        }))
      );
    } catch (e: any) {
      setError(e.message || 'Failed to delete item.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleSoldOut(item: Item) {
    const nextStatus = item.status === 'available' ? 'sold_out' : 'available';
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/items/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      setGames((prev) =>
        prev.map((g) => ({
          ...g,
          categories: g.categories.map((c) => ({
            ...c,
            items: c.items.map((it) => (it.id === item.id ? { ...it, status: nextStatus } : it)),
          })),
        }))
      );
    } catch {
      setError('Failed to update status.');
    } finally {
      setBusy(false);
    }
  }

  // --- Drag-and-drop reordering for categories (within the same group) ---

  async function handleCategoryDragEnd(group: 'main' | 'others', event: DragEndEvent) {
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
    const otherGroupCats = selectedGame.categories.filter((c) => c.group !== group);

    // Optimistic UI update — only re-number the dragged group; other group untouched
    setGames((prev) =>
      prev.map((g) => ({
        ...g,
        categories: g.categories.map((c) => {
          const idx = reorderedGroup.findIndex((rc) => rc.id === c.id);
          return idx === -1 ? c : { ...c, sortOrder: idx };
        }),
      }))
    );

    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/categories/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reorderedGroup.map((c) => c.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError('Failed to save new category order. Refresh to see the saved order.');
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
            ? { ...c, items: reordered.map((it, i) => ({ ...it, sortOrder: i })) }
            : c
        ),
      }))
    );

    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/items/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map((it) => it.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError('Failed to save new order. Refresh to see the saved order.');
    } finally {
      setBusy(false);
    }
  }

  const mainCats = categories.filter((c) => c.group === 'main').sort((a, b) => a.sortOrder - b.sortOrder);
  const otherCats = categories.filter((c) => c.group === 'others').sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <h1 className="admin-page-title">Pricelists</h1>
      <p className="field-hint">Manage categories and pricelist items per game.</p>

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="panel">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {games.map((g) => (
            <button
              key={g.id}
              className={`cat-btn ${g.id === selectedGameId ? 'active' : ''}`}
              onClick={() => selectGame(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          {/* Category list — no reordering */}
          <div>
            <div className="panel-head" style={{ justifyContent: 'space-between' }}>
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
              <div style={{ marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
                <input
                  className="field-input"
                  placeholder="Category name"
                  value={categoryNameDraft}
                  onChange={(e) => setCategoryNameDraft(e.target.value)}
                />
                <select
                  className="others-sel"
                  style={{ marginTop: 8, width: '100%' }}
                  value={categoryGroupDraft}
                  onChange={(e) => setCategoryGroupDraft(e.target.value as 'main' | 'others')}
                >
                  <option value="main">Main Category</option>
                  <option value="others">Others</option>
                </select>
                <div className="item-actions" style={{ marginTop: 8 }}>
                  <button className="qty-btn icon-btn icon-btn-confirm" title="Save" disabled={busy} onClick={submitAddCategory}>✓</button>
                  <button className="qty-btn icon-btn icon-btn-cancel" title="Cancel" onClick={() => { setAddingCategory(false); setCategoryNameDraft(''); }}>✕</button>
                </div>
              </div>
            )}

            {mainCats.length > 0 && <p className="field-hint" style={{ marginBottom: 4 }}>Main</p>}
            {mainCats.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleCategoryDragEnd('main', e)}>
                <SortableContext items={mainCats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
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
                    )
                  )}
                </SortableContext>
              </DndContext>
            )}

            {otherCats.length > 0 && <p className="field-hint" style={{ marginTop: 12, marginBottom: 4 }}>Others</p>}
            {otherCats.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleCategoryDragEnd('others', e)}>
                <SortableContext items={otherCats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
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
                    )
                  )}
                </SortableContext>
              </DndContext>
            )}

          </div>

          {/* Item table — drag to reorder */}
          <div>
            <div className="panel-head">
              <h2>{selectedCategory ? `Items — ${selectedCategory.name}` : 'Select a category'}</h2>
            </div>

            {selectedCategory && (
              <>
                {!addingItem ? (
                  <button
                    className="qty-btn"
                    style={{ marginBottom: 12, width: 'auto', padding: '10px 16px', whiteSpace: 'nowrap' }}
                    onClick={() => setAddingItem(true)}
                  >
                    + Add Item
                  </button>
                ) : (
                  <div className="order-expand" style={{ marginBottom: 12 }}>
                    <div className="order-expand-col" style={{ flex: '1 1 100%' }}>
                      <input className="field-input" placeholder="Item name" value={itemDraft.name}
                        onChange={(e) => setItemDraft((d) => ({ ...d, name: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <input className="field-input" placeholder="Price" type="number" value={itemDraft.price}
                          onChange={(e) => setItemDraft((d) => ({ ...d, price: e.target.value }))} />
                        <input className="field-input" placeholder="Original price (optional)" type="number" value={itemDraft.originalPrice}
                          onChange={(e) => setItemDraft((d) => ({ ...d, originalPrice: e.target.value }))} />
                        <select className="others-sel" value={itemDraft.status}
                          onChange={(e) => setItemDraft((d) => ({ ...d, status: e.target.value as 'available' | 'sold_out' }))}>
                          <option value="available">Available</option>
                          <option value="sold_out">Sold Out</option>
                        </select>
                      </div>
                      <input className="field-input" style={{ marginTop: 8 }} placeholder="Notes (optional)" value={itemDraft.notes}
                        onChange={(e) => setItemDraft((d) => ({ ...d, notes: e.target.value }))} />
                      <div className="item-actions" style={{ marginTop: 8 }}>
                        <button className="qty-btn icon-btn icon-btn-confirm" title="Save" disabled={busy} onClick={submitAddItem}>✓</button>
                        <button className="qty-btn icon-btn icon-btn-cancel" title="Cancel" onClick={() => { setAddingItem(false); setItemDraft(EMPTY_ITEM_DRAFT); }}>✕</button>
                      </div>
                    </div>
                  </div>
                )}

                <table className="admin-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Name</th>
                      <th>Price</th>
                      <th>Original Price</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCategory.items.length === 0 && (
                      <tr><td colSpan={7} className="field-hint">No items yet.</td></tr>
                    )}
                    {selectedCategory.items.length > 0 && (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleItemDragEnd}
                      >
                        <SortableContext
                          items={selectedCategory.items.map((it) => it.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {selectedCategory.items.map((it) =>
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
                                onEdit={() => startEditItem(it)}
                                onDelete={() => deleteItem(it.id)}
                                onToggleSoldOut={() => toggleSoldOut(it)}
                              />
                            )
                          )}
                        </SortableContext>
                      </DndContext>
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>

      {confirmModal && (
        <div className="qr-modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3>Confirm Delete</h3>
            <p className="field-hint" style={{ marginBottom: 20, fontSize: 13.5 }}>{confirmModal.message}</p>
            <div className="item-actions" style={{ justifyContent: 'center' }}>
              <button
                className="qty-btn icon-btn-cancel"
                style={{ width: 'auto', padding: '10px 20px' }}
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                className="qty-btn icon-btn-confirm"
                style={{ width: 'auto', padding: '10px 20px' }}
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

function SortableCategoryRow({
  cat, active, onSelect, onEdit, onDelete,
}: {
  cat: Category;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
        padding: '8px 6px', borderRadius: 6, cursor: 'pointer',
        background: isDragging ? 'rgba(255,255,255,0.1)' : active ? 'rgba(255,255,255,0.08)' : 'transparent',
      }}
      onClick={onSelect}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <button className="qty-btn icon-btn" title="Drag to reorder" style={{ cursor: 'grab' }}
          onClick={(e) => e.stopPropagation()} {...attributes} {...listeners}>
          ⠿
        </button>
        <span style={{ fontSize: 13.5 }}>{cat.name} <span className="field-hint">({cat.items.length})</span></span>
      </span>
      <span className="item-actions" onClick={(e) => e.stopPropagation()}>
        <button className="qty-btn icon-btn" title="Edit" onClick={onEdit}>✎</button>
        <button className="qty-btn icon-btn" title="Delete" onClick={onDelete}>✕</button>
      </span>
    </div>
  );
}

function CategoryEditRow({
  editDraft, setEditDraft, onSave, onCancel, busy,
}: {
  editDraft: { name: string; group: 'main' | 'others' };
  setEditDraft: (d: { name: string; group: 'main' | 'others' }) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <input className="field-input" value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
      <select className="others-sel" style={{ marginTop: 6, width: '100%' }} value={editDraft.group}
        onChange={(e) => setEditDraft({ ...editDraft, group: e.target.value as 'main' | 'others' })}>
        <option value="main">Main Category</option>
        <option value="others">Others</option>
      </select>
      <div className="item-actions" style={{ marginTop: 6 }}>
        <button className="qty-btn icon-btn icon-btn-confirm" title="Save" disabled={busy} onClick={onSave}>✓</button>
        <button className="qty-btn icon-btn icon-btn-cancel" title="Cancel" onClick={onCancel}>✕</button>
      </div>
    </div>
  );
}

function SortableItemRow({
  item, onEdit, onDelete, onToggleSoldOut,
}: {
  item: Item;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSoldOut: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? 'rgba(255,255,255,0.06)' : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td style={{ width: 32 }}>
        <button
          className="qty-btn icon-btn"
          title="Drag to reorder"
          style={{ cursor: 'grab' }}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </td>
      <td>{item.name}</td>
      <td>₱{item.price}</td>
      <td>{item.originalPrice != null ? `₱${item.originalPrice}` : '—'}</td>
      <td>
        <span className={`badge badge-${item.status === 'available' ? 'done' : 'pending'}`}>
          {item.status === 'available' ? 'Available' : 'Sold Out'}
        </span>
      </td>
      <td className="field-hint">{item.notes || '—'}</td>
      <td className="actions-cell">
        <div className="item-actions">
          <button
            className="qty-btn icon-btn"
            title={item.status === 'available' ? 'Mark sold out' : 'Mark available'}
            onClick={onToggleSoldOut}
          >
            {item.status === 'available' ? '⊘' : '✓'}
          </button>
          <button className="qty-btn icon-btn" title="Edit" onClick={onEdit}>✎</button>
          <button className="qty-btn icon-btn" title="Delete" onClick={onDelete}>✕</button>
        </div>
      </td>
    </tr>
  );
}

function ItemEditRow({
  editDraft, setEditDraft, onSave, onCancel, busy,
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
      <td><input className="field-input" value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} /></td>
      <td><input className="field-input" type="number" value={editDraft.price} onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value })} /></td>
      <td><input className="field-input" type="number" value={editDraft.originalPrice} onChange={(e) => setEditDraft({ ...editDraft, originalPrice: e.target.value })} /></td>
      <td>
        <select className="others-sel" value={editDraft.status} onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value as 'available' | 'sold_out' })}>
          <option value="available">Available</option>
          <option value="sold_out">Sold Out</option>
        </select>
      </td>
      <td><input className="field-input" value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} /></td>
      <td className="actions-cell">
        <div className="item-actions">
          <button className="qty-btn icon-btn icon-btn-confirm" title="Save" disabled={busy} onClick={onSave}>✓</button>
          <button className="qty-btn icon-btn icon-btn-cancel" title="Cancel" onClick={onCancel}>✕</button>
        </div>
      </td>
    </tr>
  );
}
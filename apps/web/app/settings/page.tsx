'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import { createClient } from '../../utils/client';
import { getCategoryColor } from '../../utils/categories';
import AppShell from '../components/AppShell';
import {
  Button,
  Input,
  Card,
  Dialog,
  EmptyState,
  PageHeader,
  CategoryTile,
  RowSkeleton,
} from '../components/ui';

type CategoryRow = {
  id: string;
  name: string;
  color?: string | null;
};

export default function SettingsPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; count: number } | null>(
    null
  );

  const supabase = createClient();

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const fetchData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data } = await supabase
      .from('categories')
      .select('id, name, color')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setCategories(data);
    setLoading(false);
  };

  const handleEditClick = (cat: CategoryRow) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setFormError(null);
  };

  const handleSaveEdit = async (id: string) => {
    setFormError(null);
    const trimmed = editName.trim();
    if (!trimmed) {
      setFormError('Category name cannot be empty.');
      return;
    }
    if (
      categories.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setFormError('A category with this name already exists.');
      return;
    }

    const existing = categories.find((cat) => cat.id === id);
    if (!existing) return;

    const { error: updateError } = await supabase
      .from('categories')
      .update({ name: trimmed })
      .eq('id', id)
      .eq('user_id', userId);

    if (updateError) {
      setFormError(updateError.message);
      return;
    }

    if (existing.name !== trimmed) {
      const { error: expenseError } = await supabase
        .from('expenses')
        .update({ category_id: trimmed })
        .eq('user_id', userId)
        .eq('category_id', existing.name);

      if (expenseError) {
        toast.error(`Category renamed, but expense sync failed: ${expenseError.message}`);
        await fetchData();
        return;
      }
    }

    toast.success('Category updated');
    setEditingId(null);
    setCategories(categories.map((cat) => (cat.id === id ? { ...cat, name: trimmed } : cat)));
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setFormError('Category name cannot be empty.');
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setFormError('A category with this name already exists.');
      return;
    }

    const color = getCategoryColor(trimmed);
    const { data, error: insertError } = await supabase
      .from('categories')
      .insert([{ user_id: userId, name: trimmed, color }])
      .select('id, name, color')
      .single();

    if (insertError) {
      setFormError(insertError.message);
      return;
    }

    setCategories([...categories, data]);
    setNewCategoryName('');
    toast.success('Category created');
  };

  const requestDelete = async (id: string) => {
    const target = categories.find((cat) => cat.id === id);
    if (!target) return;

    const { count, error: countError } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', target.name)
      .eq('user_id', userId);

    if (countError) {
      toast.error('Failed to check category usage.');
      return;
    }

    setDeleteTarget({ id, name: target.name, count: count || 0 });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.count > 0) {
      toast.error(
        `Cannot delete — tied to ${deleteTarget.count} transaction(s). Edit or remove those first.`
      );
      setDeleteTarget(null);
      return;
    }

    const previousCategories = [...categories];
    setCategories(categories.filter((cat) => cat.id !== deleteTarget.id));
    setDeleteTarget(null);

    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('user_id', userId);

    if (deleteError) {
      setCategories(previousCategories);
      toast.error(deleteError.message);
    } else {
      toast.success('Category deleted');
    }
  };

  if (loading) {
    return (
      <AppShell>
        <PageHeader
          title="Categories"
          description="Label spending clearly — rename or remove anytime."
        />
        <Card className="p-4">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete category?"
        description={
          deleteTarget && deleteTarget.count > 0
            ? `"${deleteTarget.name}" is used by ${deleteTarget.count} transaction(s). Remove or reassign those expenses first.`
            : deleteTarget
              ? `Delete "${deleteTarget.name}"? This cannot be undone.`
              : undefined
        }
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={confirmDelete}
              disabled={!!deleteTarget && deleteTarget.count > 0}
            >
              Delete
            </Button>
          </>
        }
      />

      <PageHeader
        title="Categories"
        description="Label spending clearly — rename or remove anytime."
      />

      <form
        onSubmit={handleAddCategory}
        className="flex flex-col sm:flex-row gap-2 mb-6 items-stretch sm:items-end"
      >
        <div className="flex-1">
          <Input
            label="New category"
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="e.g. Fuel"
            maxLength={40}
            error={formError || undefined}
          />
        </div>
        <Button type="submit" variant="accent" className="sm:mb-0">
          Add category
        </Button>
      </form>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--ef-border)] bg-[var(--ef-gray-50)]">
          <h2 className="text-xs font-medium text-[var(--ef-muted)]">
            <span className="ef-emoji mr-1.5" aria-hidden>
              🏷️
            </span>
            Your categories
            <span className="ml-2 tabular-nums text-[var(--ef-gray-500)]">
              ({categories.length})
            </span>
          </h2>
        </div>

        <div className="divide-y divide-[var(--ef-border)]">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[var(--ef-gray-50)] transition-colors group"
            >
              {editingId === cat.id ? (
                <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                  <Input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="Category name"
                    className="flex-1"
                    maxLength={40}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="accent" onClick={() => handleSaveEdit(cat.id)}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingId(null);
                        setFormError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryTile name={cat.name} color={cat.color} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--ef-ink)] truncate">
                        {cat.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!px-2"
                      onClick={() => handleEditClick(cat)}
                      aria-label={`Edit ${cat.name}`}
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!px-2 text-[var(--ef-danger)]"
                      onClick={() => requestDelete(cat.id)}
                      aria-label={`Delete ${cat.name}`}
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <EmptyState
              emoji="🏷️"
              title="No categories yet"
              description="Add one above — it will get an emoji tile automatically."
            />
          )}
        </div>
      </Card>
    </AppShell>
  );
}

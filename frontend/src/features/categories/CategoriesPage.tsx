import {
  AlertCircle,
  Eye,
  FilePenLine,
  FolderTree,
  Plus,
  Search,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Table } from '../../components/ui/Table';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../lib/api/client';
import { login } from '../../lib/api/auth.api';
import { getSubcategories } from '../../lib/api/catalog.api';
import type { SubcategoryOption } from '../../lib/api/catalog.types';
import {
  createCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../../lib/api/categories.api';
import type { Category, CategoryPayload } from '../../lib/api/categories.api';

const PAGE_SIZE = 20;
type StatusFilter = 'all' | 'true' | 'false';
type CategoryFormValues = {
  name: string;
  description: string;
  isActive: boolean;
};

const emptyForm: CategoryFormValues = {
  name: '',
  description: '',
  isActive: true,
};

export function CategoriesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(true);
  const [meta, setMeta] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [subcategoryLoadError, setSubcategoryLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formValues, setFormValues] = useState<CategoryFormValues>(emptyForm);
  const [formError, setFormError] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] =
    useState<Category | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [detailsSubcategories, setDetailsSubcategories] = useState<
    SubcategoryOption[]
  >([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsSubcategoryError, setDetailsSubcategoryError] = useState('');
  const [signInOpen, setSignInOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError('');
    setAuthError(false);
    setActionError('');

    const query = {
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
    };
    const statusQuery = listCategories(
      {
        ...query,
        isActive: status === 'all' ? undefined : status,
      },
      controller.signal,
    );

    statusQuery
      .then((result) => {
        if (!active) return;
        setCategories(result.data);
        setMeta(result.meta);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        setLoadError(
          error instanceof Error ? error.message : 'Could not load categories.',
        );
        if (error instanceof ApiError && error.status === 401) {
          setAuthError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [page, reloadToken, search, status]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setSubcategoriesLoading(true);
    setSubcategoryLoadError('');
    getSubcategories(controller.signal)
      .then((allSubcategories) => {
      if (active) {
        setSubcategories(allSubcategories);
        setSubcategoryLoadError('');
      }
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        setSubcategories([]);
        setSubcategoryLoadError(
          error instanceof Error
            ? error.message
            : 'Subcategory counts are unavailable.',
        );
      })
      .finally(() => {
        if (active) setSubcategoriesLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const subcategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const subcategory of subcategories) {
      counts.set(
        subcategory.categoryId,
        (counts.get(subcategory.categoryId) ?? 0) + 1,
      );
    }
    return counts;
  }, [subcategories]);

  const refresh = useCallback(
    () => setReloadToken((value) => value + 1),
    [],
  );

  function openCreateForm() {
    setEditingCategory(null);
    setFormValues(emptyForm);
    setNameError('');
    setFormError('');
    setFormOpen(true);
  }

  function openEditForm(category: Category) {
    setEditingCategory(category);
    setFormValues({
      name: category.name,
      description: category.description ?? '',
      isActive: category.isActive,
    });
    setNameError('');
    setFormError('');
    setFormOpen(true);
  }

  async function openDetails(category: Category) {
    setSelectedCategory(category);
    setDetailsSubcategories([]);
    setDetailsError('');
    setDetailsSubcategoryError('');
    setDetailsLoading(true);
    try {
      const freshCategory = await getCategory(category.id);
      setSelectedCategory(freshCategory);
      try {
        const allSubcategories = await getSubcategories();
        setDetailsSubcategories(
          allSubcategories.filter(
            (subcategory) => subcategory.categoryId === category.id,
          ),
        );
      } catch (error) {
        setDetailsSubcategoryError(
          error instanceof Error
            ? error.message
            : 'Could not load subcategories for this category.',
        );
      }
    } catch (error) {
      setDetailsError(
        error instanceof Error
          ? error.message
          : 'Could not load category details.',
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  function updateForm<K extends keyof CategoryFormValues>(
    field: K,
    value: CategoryFormValues[K],
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
    if (field === 'name') setNameError('');
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = formValues.name.trim();
    if (!name) {
      setNameError('Category name is required.');
      document.getElementById('category-name')?.focus();
      return;
    }
    if (name.length > 255) {
      setNameError('Category name must be 255 characters or fewer.');
      document.getElementById('category-name')?.focus();
      return;
    }

    setSaving(true);
    setFormError('');
    setNameError('');
    const payload: CategoryPayload = {
      name,
      description: formValues.description.trim(),
      isActive: formValues.isActive,
    };

    try {
      const saved = editingCategory
        ? await updateCategory(editingCategory.id, payload)
        : await createCategory(payload);
      setFormOpen(false);
      refresh();
      showToast({
        tone: 'success',
        title: editingCategory ? 'Category updated' : 'Category created',
        description: saved.name,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setNameError('A category with this name already exists.');
      } else if (error instanceof ApiError && error.status === 400) {
        setFormError(error.message || 'Please check the category fields.');
      } else {
        setFormError(
          error instanceof Error ? error.message : 'Could not save category.',
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus() {
    if (!pendingStatusChange) return;
    setStatusChanging(true);
    setActionError('');
    try {
      const updated = await updateCategory(pendingStatusChange.id, {
        isActive: !pendingStatusChange.isActive,
      });
      setPendingStatusChange(null);
      refresh();
      showToast({
        tone: 'success',
        title: updated.isActive ? 'Category activated' : 'Category deactivated',
        description: updated.name,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not update category.';
      setActionError(message);
      setPendingStatusChange(null);
    } finally {
      setStatusChanging(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setSignInError('');
    try {
      await login(email.trim(), password);
      setPassword('');
      setSignInOpen(false);
      refresh();
    } catch (error) {
      setSignInError(error instanceof Error ? error.message : 'Sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  }

  const categoryRows = loading ? (
    <tr>
      <td colSpan={5}>
        <FeedbackState
          tone="loading"
          title="Loading categories"
          description="Fetching categories and their subcategory relationships."
        />
      </td>
    </tr>
  ) : loadError ? (
    <tr>
      <td colSpan={5}>
        <FeedbackState
          tone="error"
          title={authError ? 'Sign-in required' : 'Categories could not be loaded'}
          description={
            authError
              ? 'This endpoint requires a valid POS account. Sign in to manage categories.'
              : loadError
          }
          action={
            authError ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSignInError('');
                  setSignInOpen(true);
                }}
              >
                Sign in
              </Button>
            ) : (
              <Button variant="secondary" onClick={refresh}>
                Retry
              </Button>
            )
          }
        />
      </td>
    </tr>
  ) : categories.length === 0 ? (
    <tr>
      <td colSpan={5}>
        <FeedbackState
          tone="empty"
          title={search ? 'No matching categories' : 'No categories yet'}
          description={
            search
              ? 'Try a different name or clear your search.'
              : 'Create a category to organize related products and subcategories.'
          }
          action={
            !search ? (
              <Button onClick={openCreateForm}>
                <Plus size={16} /> Add category
              </Button>
            ) : undefined
          }
        />
      </td>
    </tr>
  ) : (
    categories.map((category) => {
      const count = subcategoryCounts.get(category.id) ?? 0;
      return (
        <tr key={category.id} className="text-sm text-slate-600">
          <td className="px-4 py-3.5 first:pl-5">
            <div className="flex min-w-48 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <FolderTree size={17} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{category.name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {category.description || 'No description'}
                </p>
              </div>
            </div>
          </td>
          <td className="px-4 py-3.5">
            {subcategoriesLoading ? (
              <span className="text-slate-400">Loading…</span>
            ) : subcategoryLoadError ? (
              <span title={subcategoryLoadError} className="text-slate-400">Unavailable</span>
            ) : (
              <>
                <span className="tabular-nums">{count}</span>
                <span className="ml-1 text-xs text-slate-400">
                  {count === 1 ? 'subcategory' : 'subcategories'}
                </span>
              </>
            )}
          </td>
          <td className="px-4 py-3.5">
            <StatusBadge tone={category.isActive ? 'success' : 'neutral'}>
              {category.isActive ? 'Active' : 'Inactive'}
            </StatusBadge>
          </td>
          <td className="px-4 py-3.5 text-xs text-slate-500">
            {new Intl.DateTimeFormat('en-PK', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }).format(new Date(category.updatedAt))}
          </td>
          <td className="px-4 py-3.5 last:pr-5">
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                aria-label={`View ${category.name}`}
                title="View details"
                onClick={() => void openDetails(category)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <Eye size={16} />
              </button>
              <button
                type="button"
                aria-label={`Edit ${category.name}`}
                title="Edit category"
                onClick={() => openEditForm(category)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
              >
                <FilePenLine size={16} />
              </button>
              <button
                type="button"
                aria-label={`${category.isActive ? 'Deactivate' : 'Activate'} ${category.name}`}
                title={category.isActive ? 'Deactivate category' : 'Activate category'}
                onClick={() => setPendingStatusChange(category)}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-amber-50 hover:text-amber-800"
              >
                {category.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </td>
        </tr>
      );
    })
  );

  const countLabel = loading
    ? 'Loading…'
    : `${meta.total.toLocaleString()} categories`;

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">Catalog</p>
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">
            Categories
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Organize products into clear groups for faster inventory management.
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus size={16} /> Add category
        </Button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span className="flex items-center gap-2">
            <AlertCircle size={17} />
            {actionError}
          </span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setActionError('')}
            className="text-rose-700"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            aria-label="Search categories by name"
            placeholder="Search category names…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Status</span>
          <Select
            aria-label="Filter categories by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
            className="min-w-36"
          >
            <option value="all">All categories</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </Select>
          <span className="whitespace-nowrap text-xs text-slate-500">
            {countLabel}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table
          headers={['Category', 'Subcategories', 'Status', 'Last updated', 'Actions']}
          caption="Category management"
        >
          {categoryRows}
        </Table>
        {!loading && !loadError && meta.total > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              totalItems={meta.total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Subcategory counts use the category relationship returned by the
        subcategory API. Product counts are not exposed by the current category
        or product-list API, so this page deactivates categories instead of
        offering a potentially misleading delete action. Deactivation keeps
        existing product and subcategory references intact.
      </p>
      {subcategoryLoadError && (
      <p role="status" className="text-xs text-amber-700">
        Subcategory totals could not be loaded: {subcategoryLoadError}
      </p>
      )}

      <Modal
        open={formOpen}
        onClose={() => {
          if (!saving) setFormOpen(false);
        }}
        title={editingCategory ? 'Edit category' : 'Add category'}
        description={
          editingCategory
            ? 'Update the category information.'
            : 'Add a category to organize your catalog.'
        }
      >
        <form onSubmit={(event) => void submitForm(event)} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {formError}
            </div>
          )}
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Category name <span className="text-rose-600">*</span>
            <Input
              id="category-name"
              autoFocus
              maxLength={255}
              value={formValues.name}
              onChange={(event) => updateForm('name', event.target.value)}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'category-name-error' : undefined}
            />
            {nameError && (
              <span id="category-name-error" role="alert" className="block text-xs text-rose-700">
                {nameError}
              </span>
            )}
          </label>
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Description
            <Textarea
              rows={4}
              value={formValues.description}
              onChange={(event) => updateForm('description', event.target.value)}
            />
          </label>
          {editingCategory && (
            <label className="flex items-center gap-2.5 text-sm font-normal text-slate-700">
              <input
                type="checkbox"
                checked={formValues.isActive}
                onChange={(event) => updateForm('isActive', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              Category is active
            </label>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingCategory ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={selectedCategory !== null}
        onClose={() => setSelectedCategory(null)}
        title="Category details"
        description={selectedCategory?.name}
      >
        {detailsLoading ? (
          <FeedbackState tone="loading" title="Loading details" />
        ) : detailsError ? (
          <FeedbackState
            tone="error"
            title="Details could not be loaded"
            description={detailsError}
          />
        ) : selectedCategory ? (
          <div className="space-y-5">
            <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">Name</dt>
                <dd className="mt-1 text-sm text-slate-800">{selectedCategory.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Status</dt>
                <dd className="mt-1">
                  <StatusBadge tone={selectedCategory.isActive ? 'success' : 'neutral'}>
                    {selectedCategory.isActive ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Description</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                  {selectedCategory.description || 'No description'}
                </dd>
              </div>
            </dl>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Subcategories ({detailsSubcategories.length})
              </h3>
              {detailsSubcategoryError ? (
                <p role="alert" className="mt-2 text-sm text-rose-700">
                  Subcategories could not be loaded: {detailsSubcategoryError}
                </p>
              ) : detailsSubcategories.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No subcategories are linked to this category.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {detailsSubcategories.map((subcategory) => (
                    <li
                      key={subcategory.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-700">{subcategory.name}</span>
                      <StatusBadge tone={subcategory.isActive ? 'success' : 'neutral'}>
                        {subcategory.isActive ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setSelectedCategory(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingStatusChange !== null}
        onCancel={() => {
          if (!statusChanging) setPendingStatusChange(null);
        }}
        onConfirm={() => void changeStatus()}
        title={
          pendingStatusChange?.isActive
            ? 'Deactivate this category?'
            : 'Activate this category?'
        }
        description={
          pendingStatusChange?.isActive
            ? `“${pendingStatusChange.name}” will no longer be available for new catalog assignments. Existing product and subcategory links are preserved.`
            : `“${pendingStatusChange?.name ?? ''}” will become available for catalog assignments again.`
        }
        confirmLabel={pendingStatusChange?.isActive ? 'Deactivate category' : 'Activate category'}
        isLoading={statusChanging}
      />

      <Modal
        open={signInOpen}
        onClose={() => {
          if (!signingIn) setSignInOpen(false);
        }}
        title="Sign in to continue"
        description="Category APIs require a valid POS account."
      >
        <form onSubmit={(event) => void signIn(event)} className="space-y-4">
          {signInError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {signInError}
            </p>
          )}
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Email
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Password
            <Input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={signingIn}
              onClick={() => setSignInOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={signingIn}>
              {signingIn ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

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
import { useNavigate } from 'react-router-dom';
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
import { getCategories } from '../../lib/api/catalog.api';
import type { CategoryOption } from '../../lib/api/catalog.types';
import {
  createSubcategory,
  getSubcategory,
  listAllSubcategories,
  listSubcategories,
  updateSubcategory,
} from '../../lib/api/subcategories.api';
import type {
  Subcategory,
  SubcategoryPayload,
} from '../../lib/api/subcategories.api';

const PAGE_SIZE = 20;
type StatusFilter = 'all' | 'true' | 'false';

interface SubcategoryFormValues {
  name: string;
  description: string;
  categoryId: string;
  isActive: boolean;
}

const emptyForm: SubcategoryFormValues = {
  name: '',
  description: '',
  categoryId: '',
  isActive: true,
};

export function SubcategoriesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesError, setCategoriesError] = useState('');
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [actionError, setActionError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] =
    useState<Subcategory | null>(null);
  const [formValues, setFormValues] =
    useState<SubcategoryFormValues>(emptyForm);
  const [formError, setFormError] = useState('');
  const [nameError, setNameError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<Subcategory | null>(null);
  const [detailsError, setDetailsError] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] =
    useState<Subcategory | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

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
    getCategories(controller.signal)
      .then((records) => {
        if (active) {
          setCategories(records);
          setCategoriesError('');
        }
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        setCategoriesError(
          error instanceof Error ? error.message : 'Could not load categories.',
        );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError('');
    setAuthError(false);
    setActionError('');

    const query = {
      search: search || undefined,
      isActive: status === 'all' ? undefined : status,
    };

    const request = categoryFilter
      ? listAllSubcategories(query, controller.signal).then((records) => {
          const filtered = records.filter(
            (record) => record.categoryId === categoryFilter,
          );
          const start = (page - 1) * PAGE_SIZE;
          return {
            data: filtered.slice(start, start + PAGE_SIZE),
            meta: {
              page,
              limit: PAGE_SIZE,
              total: filtered.length,
              totalPages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
            },
          };
        })
      : listSubcategories(
          {
            ...query,
            page,
            limit: PAGE_SIZE,
          },
          controller.signal,
        );

    request
      .then((result) => {
        if (!active) return;
        setSubcategories(result.data);
        setMeta(result.meta);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Could not load subcategories.',
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
  }, [categoryFilter, page, reloadToken, search, status]);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const refresh = useCallback(
    () => setReloadToken((value) => value + 1),
    [],
  );

  function openCreateForm() {
    setEditingSubcategory(null);
    setFormValues({
      ...emptyForm,
      categoryId: categories.find((category) => category.isActive)?.id ?? '',
    });
    setFormError('');
    setNameError('');
    setCategoryError('');
    setFormOpen(true);
  }

  function openEditForm(subcategory: Subcategory) {
    setEditingSubcategory(subcategory);
    setFormValues({
      name: subcategory.name,
      description: subcategory.description ?? '',
      categoryId: subcategory.categoryId,
      isActive: subcategory.isActive,
    });
    setFormError('');
    setNameError('');
    setCategoryError('');
    setFormOpen(true);
  }

  async function openDetails(subcategory: Subcategory) {
    setSelectedSubcategory(subcategory);
    setDetailsError('');
    setDetailsLoading(true);
    try {
      setSelectedSubcategory(await getSubcategory(subcategory.id));
    } catch (error) {
      setDetailsError(
        error instanceof Error
          ? error.message
          : 'Could not load subcategory details.',
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  function updateForm<K extends keyof SubcategoryFormValues>(
    field: K,
    value: SubcategoryFormValues[K],
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
    if (field === 'name') setNameError('');
    if (field === 'categoryId') setCategoryError('');
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = formValues.name.trim();
    if (!name) {
      setNameError('Subcategory name is required.');
      document.getElementById('subcategory-name')?.focus();
      return;
    }
    if (name.length > 255) {
      setNameError('Subcategory name must be 255 characters or fewer.');
      document.getElementById('subcategory-name')?.focus();
      return;
    }
    if (!formValues.categoryId) {
      setCategoryError('Select a parent category.');
      document.getElementById('subcategory-category')?.focus();
      return;
    }
    const selectedCategory = categories.find(
      (category) => category.id === formValues.categoryId,
    );
    const isExistingInactiveParent =
      editingSubcategory?.categoryId === formValues.categoryId;
    if (!selectedCategory?.isActive && !isExistingInactiveParent) {
      setCategoryError('Choose an active category.');
      document.getElementById('subcategory-category')?.focus();
      return;
    }

    setSaving(true);
    setFormError('');
    const payload: SubcategoryPayload = {
      name,
      description: formValues.description.trim(),
      categoryId: formValues.categoryId,
      isActive: formValues.isActive,
    };
    try {
      const saved = editingSubcategory
        ? await updateSubcategory(editingSubcategory.id, payload)
        : await createSubcategory(payload);
      setFormOpen(false);
      refresh();
      showToast({
        tone: 'success',
        title: editingSubcategory
          ? 'Subcategory updated'
          : 'Subcategory created',
        description: saved.name,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setNameError(
          'A subcategory with this name already exists in the selected category.',
        );
      } else if (error instanceof ApiError && error.status === 400) {
        setCategoryError(error.message || 'The selected category is unavailable.');
      } else {
        setFormError(
          error instanceof Error
            ? error.message
            : 'Could not save subcategory.',
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
      const updated = await updateSubcategory(pendingStatusChange.id, {
        isActive: !pendingStatusChange.isActive,
      });
      setPendingStatusChange(null);
      refresh();
      showToast({
        tone: 'success',
        title: updated.isActive
          ? 'Subcategory activated'
          : 'Subcategory deactivated',
        description: updated.name,
      });
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not update subcategory status.',
      );
      setPendingStatusChange(null);
    } finally {
      setStatusChanging(false);
    }
  }

  const rows = loading ? (
    <tr>
      <td colSpan={5}>
        <FeedbackState
          tone="loading"
          title="Loading subcategories"
          description="Fetching subcategories from your catalog."
        />
      </td>
    </tr>
  ) : loadError ? (
    <tr>
      <td colSpan={5}>
        <FeedbackState
          tone="error"
          title={authError ? 'Sign-in required' : 'Subcategories could not be loaded'}
          description={loadError}
          action={
            authError ? (
              <Button variant="secondary" onClick={() => navigate('/login')}>
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
  ) : subcategories.length === 0 ? (
    <tr>
      <td colSpan={5}>
        <FeedbackState
          tone="empty"
          title={search || categoryFilter ? 'No matching subcategories' : 'No subcategories yet'}
          description={
            search || categoryFilter
              ? 'Try changing the search or parent category filter.'
              : 'Add a subcategory to refine your product catalog.'
          }
          action={
            !search && !categoryFilter ? (
              <Button onClick={openCreateForm} disabled={!categories.some((category) => category.isActive)}>
                <Plus size={16} /> Add subcategory
              </Button>
            ) : undefined
          }
        />
      </td>
    </tr>
  ) : (
    subcategories.map((subcategory) => (
      <tr key={subcategory.id} className="text-sm text-slate-600">
        <td className="px-4 py-3.5 first:pl-5">
          <div className="flex min-w-48 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <FolderTree size={17} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{subcategory.name}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {subcategory.description || 'No description'}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5">
          {subcategory.category?.name ??
            categoryNames.get(subcategory.categoryId) ??
            'Category unavailable'}
        </td>
        <td className="px-4 py-3.5">
          <StatusBadge tone={subcategory.isActive ? 'success' : 'neutral'}>
            {subcategory.isActive ? 'Active' : 'Inactive'}
          </StatusBadge>
        </td>
        <td className="px-4 py-3.5 text-xs text-slate-500">
          {new Intl.DateTimeFormat('en-PK', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }).format(new Date(subcategory.updatedAt))}
        </td>
        <td className="px-4 py-3.5 last:pr-5">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              aria-label={`View ${subcategory.name}`}
              title="View details"
              onClick={() => void openDetails(subcategory)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Eye size={16} />
            </button>
            <button
              type="button"
              aria-label={`Edit ${subcategory.name}`}
              title="Edit subcategory"
              onClick={() => openEditForm(subcategory)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
            >
              <FilePenLine size={16} />
            </button>
            <button
              type="button"
              aria-label={`${subcategory.isActive ? 'Deactivate' : 'Activate'} ${subcategory.name}`}
              title={subcategory.isActive ? 'Deactivate subcategory' : 'Activate subcategory'}
              onClick={() => setPendingStatusChange(subcategory)}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-amber-50 hover:text-amber-800"
            >
              {subcategory.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </td>
      </tr>
    ))
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">Catalog</p>
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">
            Subcategories
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Organize products under the right parent category.
          </p>
        </div>
        <Button
          onClick={openCreateForm}
          disabled={categoriesError !== '' || !categories.some((category) => category.isActive)}
        >
          <Plus size={16} /> Add subcategory
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

      {categoriesError && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Parent categories could not be loaded: {categoriesError}
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            aria-label="Search subcategories by name"
            placeholder="Search subcategory names…"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          aria-label="Filter by parent category"
          value={categoryFilter}
          onChange={(event) => {
            setCategoryFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All parent categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}{!category.isActive ? ' (Inactive)' : ''}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-3">
          <Select
            aria-label="Filter subcategories by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </Select>
          <span className="whitespace-nowrap text-xs text-slate-500">
            {loading ? 'Loading…' : `${meta.total.toLocaleString()} subcategories`}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table
          headers={['Subcategory', 'Parent category', 'Status', 'Last updated', 'Actions']}
          caption="Subcategory management"
        >
          {rows}
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
        When a parent category is selected, the API has no category filter, so
        matching subcategories are assembled from its paginated results. Product
        references are not available as a count; deactivation is offered instead
        of deletion so existing product relationships are preserved.
      </p>

      <Modal
        open={formOpen}
        onClose={() => {
          if (!saving) setFormOpen(false);
        }}
        title={editingSubcategory ? 'Edit subcategory' : 'Add subcategory'}
        description="Subcategory names are unique within their parent category."
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
            Subcategory name <span className="text-rose-600">*</span>
            <Input
              id="subcategory-name"
              autoFocus
              maxLength={255}
              value={formValues.name}
              onChange={(event) => updateForm('name', event.target.value)}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'subcategory-name-error' : undefined}
            />
            {nameError && (
              <span id="subcategory-name-error" role="alert" className="block text-xs text-rose-700">
                {nameError}
              </span>
            )}
          </label>
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Parent category <span className="text-rose-600">*</span>
            <Select
              id="subcategory-category"
              required
              value={formValues.categoryId}
              onChange={(event) => updateForm('categoryId', event.target.value)}
              aria-invalid={Boolean(categoryError)}
              aria-describedby={categoryError ? 'subcategory-category-error' : undefined}
            >
              <option value="">Select a category</option>
              {categories
                .filter(
                  (category) =>
                    category.isActive ||
                    category.id === editingSubcategory?.categoryId,
                )
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}{!category.isActive ? ' (Inactive)' : ''}
                  </option>
                ))}
              {editingSubcategory &&
                !categories.some(
                  (category) => category.id === editingSubcategory.categoryId,
                ) && (
                  <option value={editingSubcategory.categoryId}>
                    {editingSubcategory.category?.name ??
                      'Existing unavailable parent category'}{' '}
                    (Existing)
                  </option>
                )}
            </Select>
            {categoryError && (
              <span id="subcategory-category-error" role="alert" className="block text-xs text-rose-700">
                {categoryError}
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
          {editingSubcategory && (
            <label className="flex items-center gap-2.5 text-sm font-normal text-slate-700">
              <input
                type="checkbox"
                checked={formValues.isActive}
                onChange={(event) => updateForm('isActive', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              Subcategory is active
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
              {saving
                ? 'Saving…'
                : editingSubcategory
                  ? 'Save changes'
                  : 'Create subcategory'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={selectedSubcategory !== null}
        onClose={() => setSelectedSubcategory(null)}
        title="Subcategory details"
        description={selectedSubcategory?.name}
      >
        {detailsLoading ? (
          <FeedbackState tone="loading" title="Loading details" />
        ) : detailsError ? (
          <FeedbackState
            tone="error"
            title="Details could not be loaded"
            description={detailsError}
          />
        ) : selectedSubcategory ? (
          <div className="space-y-5">
            <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">Name</dt>
                <dd className="mt-1 text-sm text-slate-800">
                  {selectedSubcategory.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Parent category</dt>
                <dd className="mt-1 text-sm text-slate-800">
                  {selectedSubcategory.category?.name ??
                    categoryNames.get(selectedSubcategory.categoryId) ??
                    'Category unavailable'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Status</dt>
                <dd className="mt-1">
                  <StatusBadge tone={selectedSubcategory.isActive ? 'success' : 'neutral'}>
                    {selectedSubcategory.isActive ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Description</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                  {selectedSubcategory.description || 'No description'}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button
                variant="secondary"
                onClick={() => setSelectedSubcategory(null)}
              >
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
            ? 'Deactivate this subcategory?'
            : 'Activate this subcategory?'
        }
        description={
          pendingStatusChange?.isActive
            ? `“${pendingStatusChange.name}” will no longer be available for new assignments. Existing product references will be preserved.`
            : `“${pendingStatusChange?.name ?? ''}” will be available for new assignments again.`
        }
        confirmLabel={
          pendingStatusChange?.isActive
            ? 'Deactivate subcategory'
            : 'Activate subcategory'
        }
        isLoading={statusChanging}
      />
    </section>
  );
}

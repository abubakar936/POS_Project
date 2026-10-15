import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { ApiError } from '../../lib/api/client';
import {
  getActiveCategories,
  getCompanies,
  getActiveSubcategories,
  getVendors,
} from '../../lib/api/catalog.api';
import type {
  CategoryOption,
  CompanyOption,
  SubcategoryOption,
  VendorOption,
} from '../../lib/api/catalog.types';
import { createProduct, getProduct, updateProduct } from '../../lib/api/products.api';
import { MEASURING_UNITS, isKnownMeasuringUnit } from '../../lib/api/measurement-units';
import {
  emptyProductFormValues,
  productFormToPayload,
  productToFormValues,
  validateProductForm,
  type ProductFormValues,
} from './product-form';

type Catalogs = {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  companies: CompanyOption[];
  vendors: VendorOption[];
};

const emptyCatalogs: Catalogs = {
  categories: [],
  subcategories: [],
  companies: [],
  vendors: [],
};

export function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [values, setValues] = useState<ProductFormValues>(emptyProductFormValues);
  const [catalogs, setCatalogs] = useState<Catalogs>(emptyCatalogs);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setInitialLoading(true);
    setLoadingError('');

    const productPromise = id
      ? getProduct(id, controller.signal)
      : Promise.resolve(null);

    Promise.all([
      productPromise,
      getActiveCategories(controller.signal),
      getActiveSubcategories(controller.signal),
      getCompanies(controller.signal),
      getVendors(controller.signal),
    ])
      .then(([product, categories, subcategories, companies, vendors]) => {
        const resolvedCategories =
          product?.categoryId && !categories.some((category) => category.id === product.categoryId)
            ? [...categories, {
                id: product.categoryId,
                name: product.category?.name ?? 'Unavailable category reference',
                isActive: false,
              }]
            : categories;
        const resolvedSubcategories =
          product?.subCategoryId && !subcategories.some((subcategory) => subcategory.id === product.subCategoryId)
            ? [...subcategories, {
                id: product.subCategoryId,
                name: product.subCategory?.name ?? 'Unavailable subcategory reference',
                categoryId: product.categoryId ?? '',
                isActive: false,
              }]
            : subcategories;
        const resolvedCompanies =
          product?.companyId && !companies.some((company) => company.id === product.companyId)
            ? [...companies, { id: product.companyId, name: 'Unavailable company reference', isActive: false }]
            : companies;
        const resolvedVendors =
          product?.vendorId && !vendors.some((vendor) => vendor.id === product.vendorId)
            ? [...vendors, { id: product.vendorId, name: 'Unavailable vendor reference', isActive: false }]
            : vendors;
        if (!active) return;
        setCatalogs({
          categories: resolvedCategories,
          subcategories: resolvedSubcategories,
          companies: resolvedCompanies,
          vendors: resolvedVendors,
        });
        if (product) setValues(productToFormValues(product));
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadingError(error instanceof Error ? error.message : 'Could not load product form data.');
      })
      .finally(() => {
        if (active) setInitialLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);

  const availableSubcategories = useMemo(
    () => catalogs.subcategories.filter((subcategory) => subcategory.categoryId === values.categoryId),
    [catalogs.subcategories, values.categoryId],
  );

  function updateField<K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateProductForm(values);
    setFieldErrors(errors);
    setSubmitError('');
    if (Object.keys(errors).length > 0) {
      document.getElementById(Object.keys(errors)[0] ?? '')?.focus();
      return;
    }

    setSaving(true);
    try {
      const payload = productFormToPayload(values);
      const product = id
        ? await updateProduct(id, payload)
        : await createProduct(payload);
      navigate('/products', {
        replace: true,
        state: { savedProductName: product.name },
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSubmitError('A product with this SKU or barcode already exists. Check the existing catalog and use a unique identifier.');
      } else {
        setSubmitError(error instanceof Error ? error.message : 'Could not save product.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (initialLoading) {
    return <FeedbackState tone="loading" title={isEdit ? 'Loading product' : 'Preparing product form'} description="Loading product details and catalog options." />;
  }

  if (loadingError) {
    return (
      <FeedbackState
        tone="error"
        title="Product form could not be loaded"
        description={loadingError}
        action={<Link to="/products"><Button variant="secondary">Back to products</Button></Link>}
      />
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start gap-3">
        <Link to="/products" aria-label="Back to products" className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-800"><ArrowLeft size={18} /></Link>
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">Catalog / Products</p>
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">{isEdit ? 'Edit product' : 'Add product'}</h1>
          <p className="mt-1 text-sm text-slate-500">{isEdit ? 'Update product information and availability.' : 'Add an item to your product catalog.'}</p>
        </div>
      </div>

      {submitError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{submitError}</div>}

      <form onSubmit={(event) => void submit(event)} noValidate className="space-y-5">
        <FormSection title="Product information" description="Name and identifiers help your team quickly recognize products.">
          <Field label="Product name" required error={fieldErrors.name}>
            <Input id="name" autoFocus value={values.name} onChange={(event) => updateField('name', event.target.value)} aria-invalid={Boolean(fieldErrors.name)} />
          </Field>
          <Field label="SKU" hint="Optional internal product code." error={fieldErrors.sku}>
            <Input id="sku" value={values.sku} onChange={(event) => updateField('sku', event.target.value)} aria-invalid={Boolean(fieldErrors.sku)} />
          </Field>
          <Field label="Barcode" hint="Optional barcode value." error={fieldErrors.barcode}>
            <Input id="barcode" value={values.barcode} onChange={(event) => updateField('barcode', event.target.value)} aria-invalid={Boolean(fieldErrors.barcode)} />
          </Field>
          <Field label="Measuring unit" hint="Fractional quantities are allowed for weight, volume, length and custom units." error={fieldErrors.measuringUnit}>
            <Select
              id="measuringUnit"
              value={values.measuringUnitCustom ? '__custom__' : values.measuringUnit}
              onChange={(event) => {
                const value = event.target.value;
                if (value === '__custom__') {
                  setValues((current) => ({
                    ...current,
                    measuringUnit: current.measuringUnitCustom ? current.measuringUnit : '',
                    measuringUnitCustom: true,
                  }));
                  setFieldErrors((current) => {
                    if (!current.measuringUnit) return current;
                    const next = { ...current };
                    delete next.measuringUnit;
                    return next;
                  });
                } else {
                  setValues((current) => ({
                    ...current,
                    measuringUnit: value,
                    measuringUnitCustom: false,
                  }));
                  setFieldErrors((current) => {
                    if (!current.measuringUnit) return current;
                    const next = { ...current };
                    delete next.measuringUnit;
                    return next;
                  });
                }
              }}
              aria-invalid={Boolean(fieldErrors.measuringUnit)}
            >
              <option value="">No unit selected</option>
              {values.measuringUnit && !values.measuringUnitCustom && !isKnownMeasuringUnit(values.measuringUnit) && (
                <option value={values.measuringUnit}>{values.measuringUnit} (existing unit)</option>
              )}
              {MEASURING_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>{unit.label}</option>
              ))}
              <option value="__custom__">Other (custom unit)</option>
            </Select>
            {values.measuringUnitCustom && (
              <Input
                id="customMeasuringUnit"
                value={values.measuringUnit}
                onChange={(event) => updateField('measuringUnit', event.target.value)}
                placeholder="Enter custom unit"
                maxLength={50}
                aria-label="Custom measuring unit"
                aria-invalid={Boolean(fieldErrors.measuringUnit)}
              />
            )}
          </Field>
          <Field label="Pack size" hint="Optional package size." error={fieldErrors.packSize}>
            <Input id="packSize" value={values.packSize} onChange={(event) => updateField('packSize', event.target.value)} aria-invalid={Boolean(fieldErrors.packSize)} />
          </Field>
          <Field label="Pieces per carton" error={fieldErrors.pcsPerCarton}>
            <Input id="pcsPerCarton" type="number" min="1" step="1" value={values.pcsPerCarton} onChange={(event) => updateField('pcsPerCarton', event.target.value)} aria-invalid={Boolean(fieldErrors.pcsPerCarton)} />
          </Field>
          <Field label="Company">
            <Select id="companyId" value={values.companyId} onChange={(event) => updateField('companyId', event.target.value)}>
              <option value="">No company</option>
              {catalogs.companies.map((company) => <option key={company.id} value={company.id}>{company.name}{!company.isActive ? ' (Inactive)' : ''}</option>)}
            </Select>
          </Field>
          <Field label="Vendor">
            <Select id="vendorId" value={values.vendorId} onChange={(event) => updateField('vendorId', event.target.value)}>
              <option value="">No vendor</option>
              {catalogs.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.companyName ? ` · ${vendor.companyName}` : ''}{!vendor.isActive ? ' (Inactive)' : ''}</option>)}
            </Select>
          </Field>
        </FormSection>

        <FormSection title="Classification" description="Subcategory choices follow the selected category.">
          <Field label="Category">
            <Select id="categoryId" value={values.categoryId} onChange={(event) => {
              const categoryId = event.target.value;
              setValues((current) => ({
                ...current,
                categoryId,
                subCategoryId: catalogs.subcategories.some((subcategory) => subcategory.id === current.subCategoryId && subcategory.categoryId === categoryId) ? current.subCategoryId : '',
              }));
            }}>
              <option value="">No category</option>
              {catalogs.categories.map((category) => <option key={category.id} value={category.id}>{category.name}{!category.isActive ? ' (Inactive)' : ''}</option>)}
            </Select>
          </Field>
          <Field label="Subcategory" error={fieldErrors.subCategoryId}>
            <Select id="subCategoryId" value={values.subCategoryId} disabled={!values.categoryId} onChange={(event) => updateField('subCategoryId', event.target.value)} aria-invalid={Boolean(fieldErrors.subCategoryId)}>
              <option value="">No subcategory</option>
              {availableSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}{!subcategory.isActive ? ' (Inactive)' : ''}</option>)}
            </Select>
          </Field>
        </FormSection>

        <FormSection title="Pricing" description="Amounts are submitted as decimal strings to match the API.">
          <PriceField id="purchasePrice" label="Buy price" value={values.purchasePrice} onChange={(value) => updateField('purchasePrice', value)} error={fieldErrors.purchasePrice} />
          <PriceField id="salePrice" label="Selling price" value={values.salePrice} onChange={(value) => updateField('salePrice', value)} error={fieldErrors.salePrice} />
          <PriceField id="retailPrice" label="Retail price" value={values.retailPrice} onChange={(value) => updateField('retailPrice', value)} error={fieldErrors.retailPrice} />
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" checked={values.isPricePrinted} onChange={(event) => updateField('isPricePrinted', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              Price is printed on the product
            </label>
            {values.isPricePrinted && <PriceField id="printedPrice" label="Printed price" value={values.printedPrice} onChange={(value) => updateField('printedPrice', value)} error={fieldErrors.printedPrice} />}
          </div>
        </FormSection>

        <FormSection title="Additional details">
          <Field label="Description" className="md:col-span-2">
            <Textarea id="description" rows={4} value={values.description} onChange={(event) => updateField('description', event.target.value)} />
          </Field>
          <div className="space-y-3 md:col-span-2">
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" checked={values.isActive} onChange={(event) => updateField('isActive', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              Product is active
            </label>
            <p className="text-xs text-slate-500">
              Opening stock, on-hand quantity and low-stock thresholds are managed in{' '}
              <Link to="/stocks" className="font-medium text-teal-700 hover:text-teal-800">Stock / Inventory</Link>,
              separately from product information.
            </p>
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" checked={values.hasVariants} onChange={(event) => updateField('hasVariants', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              This product has variants
            </label>
            <p className="ml-6 text-xs text-slate-500">The API stores this flag; variant definitions are not currently supported by the backend.</p>
          </div>
        </FormSection>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Link to="/products"><Button type="button" variant="secondary" disabled={saving}>Cancel</Button></Link>
          <Button type="submit" disabled={saving}><Save size={16} />{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}</Button>
        </div>
      </form>
    </section>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </header>
      <div className="grid gap-x-5 gap-y-4 p-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-xs font-medium text-slate-700 ${className}`}>
        {label}{required && <span className="ml-1 text-rose-600">*</span>}
      <span className="mt-1.5 block space-y-1.5 font-normal">
        {children}
        {error ? <span role="alert" className="block text-xs text-rose-700">{error}</span> : hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

function PriceField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Rs.</span>
        <Input id={id} inputMode="decimal" placeholder="0.00" value={value} onChange={(event) => onChange(event.target.value)} className="pl-10" aria-invalid={Boolean(error)} />
      </div>
    </Field>
  );
}

"use client";

import React, { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "./org-api";

interface CategoriesTabProps {
  isAdmin: boolean;
}

export default function CategoriesTab({ isAdmin }: CategoriesTabProps) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);

  const { data, isLoading, error } = useCategories({ page, pageSize: 10, q });

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory(editingCat?.id || "");
  const deleteMutation = useDeleteCategory();

  const { register, control, handleSubmit, reset } = useForm({
    defaultValues: {
      name: "",
      description: "",
      optionalFields: [] as { key: string; defaultValue: string }[],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "optionalFields",
  });

  const handleOpenCreate = () => {
    setEditingCat(null);
    reset({
      name: "",
      description: "",
      optionalFields: [],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: any) => {
    setEditingCat(cat);
    // Convert optionalFields record to array format for form
    const optFieldsArray = cat.optionalFields
      ? Object.entries(cat.optionalFields).map(([key, val]) => ({
          key,
          defaultValue: String(val),
        }))
      : [];

    reset({
      name: cat.name,
      description: cat.description || "",
      optionalFields: optFieldsArray,
    });
    setModalOpen(true);
  };

  const onSubmit = async (formData: any) => {
    // Convert array format back to record object
    const optFieldsObj: Record<string, any> = {};
    formData.optionalFields.forEach((item: any) => {
      if (item.key.trim()) {
        // Try parsing number, boolean or keep string
        const val = item.defaultValue.trim();
        if (val === "true") optFieldsObj[item.key] = true;
        else if (val === "false") optFieldsObj[item.key] = false;
        else if (!isNaN(Number(val)) && val !== "") optFieldsObj[item.key] = Number(val);
        else optFieldsObj[item.key] = val;
      }
    });

    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      optionalFields: Object.keys(optFieldsObj).length > 0 ? optFieldsObj : undefined,
    };

    try {
      if (editingCat) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      setModalOpen(false);
    } catch (e: any) {
      alert(e.message || "Failed to save asset category");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this category?")) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (e: any) {
        alert(e.message || "Failed to delete category");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 sm:max-w-xs">
          <input
            type="text"
            placeholder="Search categories..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] px-4 py-2 text-sm text-[var(--af-text)] placeholder-[var(--af-muted)] focus:border-[var(--af-accent)] focus:outline-none"
          />
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 rounded-lg bg-[var(--af-accent)] px-4 py-2 text-sm font-medium text-[#042f2e] transition hover:bg-[var(--af-accent-hover)]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Category
          </button>
        )}
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-sm text-[var(--af-muted)]">
          Loading categories...
        </div>
      ) : error ? (
        <div className="flex h-32 items-center justify-center text-sm text-red-500">
          Failed to load categories.
        </div>
      ) : !data || data.data.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--af-border)] text-sm text-[var(--af-muted)]">
          No asset categories found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--af-border)] bg-[var(--af-surface)]/40 backdrop-blur-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--af-border)] bg-[var(--af-surface)]/80 text-xs font-semibold text-[var(--af-muted)] uppercase tracking-wider">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Custom Schema Fields</th>
                <th className="px-6 py-4">Associated Assets</th>
                {isAdmin && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--af-border)]">
              {data.data.map((cat: any) => (
                <tr key={cat.id} className="transition hover:bg-[var(--af-surface-elevated)]/40">
                  <td className="px-6 py-4 font-medium text-[var(--af-text)]">{cat.name}</td>
                  <td className="px-6 py-4 text-[var(--af-muted)] max-w-xs truncate">
                    {cat.description || "—"}
                  </td>
                  <td className="px-6 py-4">
                    {cat.optionalFields && Object.keys(cat.optionalFields).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(cat.optionalFields).map(([key, val]) => (
                          <span
                            key={key}
                            className="inline-flex items-center rounded bg-[var(--af-surface-elevated)] px-2 py-0.5 text-xs text-[var(--af-text)] border border-[var(--af-border)]/40"
                          >
                            {key}: <span className="text-[var(--af-muted)] ml-1">{String(val)}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--af-muted)]">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-semibold text-[var(--af-text)]">
                    {cat._count?.assets ?? 0}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          className="rounded-lg p-1.5 text-[var(--af-muted)] hover:bg-[var(--af-surface-elevated)] hover:text-[var(--af-text)]"
                          title="Edit category"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          disabled={cat._count?.assets > 0}
                          onClick={() => handleDelete(cat.id)}
                          className={`rounded-lg p-1.5 ${
                            cat._count?.assets > 0
                              ? "text-[var(--af-muted)] opacity-30 cursor-not-allowed"
                              : "text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400"
                          }`}
                          title={cat._count?.assets > 0 ? "Cannot delete: has assets" : "Delete category"}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex justify-between items-center px-2 py-4">
          <p className="text-xs text-[var(--af-muted)]">
            Showing Page {page} of {data.meta.totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[var(--af-border)] px-3 py-1 text-xs text-[var(--af-text)] disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
              disabled={page === data.meta.totalPages}
              className="rounded-lg border border-[var(--af-border)] px-3 py-1 text-xs text-[var(--af-text)] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[var(--af-border)] bg-[var(--af-surface)] p-6 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-[var(--af-text)] mb-4">
                {editingCat ? "Edit Asset Category" : "Add Asset Category"}
              </h3>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--af-muted)] uppercase mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    {...register("name")}
                    className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
                    placeholder="Electronics, Furniture, IT, etc."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--af-muted)] uppercase mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    {...register("description")}
                    className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none resize-none"
                    placeholder="Describe category purpose..."
                  />
                </div>

                {/* Custom Optional Fields */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[var(--af-muted)] uppercase">
                      Custom Schema Fields
                    </label>
                    <button
                      type="button"
                      onClick={() => append({ key: "", defaultValue: "" })}
                      className="text-xs text-[var(--af-accent)] hover:underline font-medium"
                    >
                      + Add Custom Field
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-center">
                        <input
                          type="text"
                          required
                          placeholder="Field name (e.g. warrantyMonths)"
                          {...register(`optionalFields.${index}.key` as const)}
                          className="flex-1 rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-1.5 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Default value (e.g. 12)"
                          {...register(`optionalFields.${index}.defaultValue` as const)}
                          className="flex-1 rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-1.5 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg border border-[var(--af-border)] px-4 py-2 text-sm font-medium text-[var(--af-text)] transition hover:bg-[var(--af-surface-elevated)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="rounded-lg bg-[var(--af-accent)] px-4 py-2 text-sm font-medium text-[#042f2e] transition hover:bg-[var(--af-accent-hover)] disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

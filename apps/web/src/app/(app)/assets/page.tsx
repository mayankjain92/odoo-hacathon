"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAssetSchema, Role, AssetStatus } from "@assetflow/shared";
import {
  Plus,
  Search,
  SlidersHorizontal,
  X,
  History,
  AlertOctagon,
  Calendar,
  User,
  Wrench,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ScanLine
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { QrScanner } from "@/components/qr-scanner";

export default function AssetsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Modals & Panels State
  const [showRegForm, setShowRegForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // Trigger form open via query param (e.g. from Dashboard quick action)
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setShowRegForm(true);
    }
  }, [searchParams]);

  // Fetch Current User
  const { data: user } = useQuery<any>({ queryKey: ["auth-user"] });

  // Fetch Categories for dropdown & schema construction
  const { data: catsRes } = useQuery<{ data: any[] }>({
    queryKey: ["categories"],
    queryFn: () => apiFetch<{ data: any[] }>("/org/categories"),
  });
  const categories = catsRes?.data || [];

  const { data: assetsRes, isLoading } = useQuery<any>({
    queryKey: ["assets", search, categoryFilter, statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append("q", search);
      if (categoryFilter) params.append("categoryId", categoryFilter);
      if (statusFilter && statusFilter !== 'All') params.append("status", statusFilter);
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());
      
      return apiFetch(`/assets?${params.toString()}`);
    },
  });

  const assets = assetsRes?.data || [];
  const totalPages = assetsRes?.meta?.totalPages || 1;

  // React Hook Form for asset registration
  const {
    register: registerAsset,
    handleSubmit: handleSubmitAsset,
    watch: watchAsset,
    setValue: setValueAsset,
    reset: resetAsset,
    formState: { errors: assetErrors },
  } = useForm({
    resolver: zodResolver(createAssetSchema),
    defaultValues: {
      name: "",
      categoryId: "",
      acquisitionDate: new Date().toISOString().split("T")[0],
      acquisitionCost: 0,
      serialNumber: "",
      condition: "New",
      location: "Central Storage",
      isSharedBookable: false,
      departmentId: null as string | null,
    },
  });

  // Watch selected category to dynamically fetch metadata spec
  const selectedCatId = watchAsset("categoryId");
  const selectedCategoryObj = categories.find(c => c.id === selectedCatId);
  const optionalFields = selectedCategoryObj?.optionalFields || {};

  // Mutation to create asset
  const createAssetMutation = useMutation({
    mutationFn: (data: any) => {
      // Collect dynamic metadata values from the form inputs
      const metadata: Record<string, any> = {};
      Object.keys(optionalFields).forEach((key) => {
        const val = (document.getElementById(`meta-${key}`) as HTMLInputElement)?.value;
        metadata[key] = val;
      });

      return apiFetch("/assets", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          acquisitionCost: Number(data.acquisitionCost),
          metadata,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      resetAsset();
      setShowRegForm(false);
    },
  });

  const isEditor = user?.role === Role.Admin || user?.role === Role.AssetManager;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">
            Asset Inventory
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Explore hardware, software licenses, and workspaces across the organization.
          </p>
        </div>

        {isEditor && (
          <button
            onClick={() => setShowRegForm(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] px-4.5 py-2.5 text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Register Asset
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 bg-[var(--af-surface)]/40 p-4 rounded-[var(--af-radius)] border border-[var(--af-border)]">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--af-muted)]" />
          <input
            type="text"
            placeholder="Search assets by tag, name or serial..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 py-2.5 pl-10 pr-24 text-xs text-white placeholder-neutral-500 outline-none focus:border-[var(--af-accent)]"
          />
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="absolute right-2 top-1.5 flex items-center gap-1.5 rounded-md border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/70 px-2.5 py-1.5 text-2xs font-semibold text-[var(--af-accent)] transition hover:bg-[var(--af-surface-elevated)] cursor-pointer"
          >
            <ScanLine className="h-3.5 w-3.5" /> Scan QR
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]"
          >
            <option value="">All Statuses</option>
            <option value={AssetStatus.Available}>Available</option>
            <option value={AssetStatus.Allocated}>Allocated</option>
            <option value={AssetStatus.Reserved}>Reserved</option>
            <option value={AssetStatus.UnderMaintenance}>Under Maintenance</option>
            <option value={AssetStatus.Lost}>Lost</option>
          </select>
        </div>
      </div>

      {/* Asset Table */}
      <div className="overflow-x-auto rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/40">
        <table className="w-full border-collapse text-left text-xs text-[var(--af-text)]">
          <thead>
            <tr className="border-b border-[var(--af-border)] bg-[var(--af-surface)]/80 text-[var(--af-muted)] uppercase tracking-wider font-bold">
              <th className="px-6 py-4">Asset Tag</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Cost</th>
              <th className="px-6 py-4">Serial Number</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--af-border)] bg-transparent">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-[var(--af-muted)]">
                  Loading assets...
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-[var(--af-muted)]">
                  No assets found.
                </td>
              </tr>
            ) : (
              assets.map((asset: any) => {
                return (
                  <tr
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className="hover:bg-[var(--af-surface)]/20 transition cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono font-semibold text-[var(--af-accent)]">
                      {asset.assetTag}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">{asset.name}</td>
                    <td className="px-6 py-4">{asset.category?.name ?? "Hardware"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
                        asset.status === AssetStatus.Available ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40" :
                        asset.status === AssetStatus.Allocated ? "bg-cyan-950 text-cyan-400 border border-cyan-800/40" :
                        asset.status === AssetStatus.UnderMaintenance ? "bg-amber-950 text-amber-400 border border-amber-800/40" :
                        "bg-neutral-900 text-neutral-400 border border-neutral-800"
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono">${(asset.acquisitionCost ?? 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-[var(--af-muted)] font-mono">{asset.serialNumber || "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[var(--af-muted)]">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-2 text-white hover:bg-[var(--af-surface)] transition disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-2 text-white hover:bg-[var(--af-surface)] transition disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Asset Register Drawer */}
      {showRegForm && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--af-surface)] border-l border-[var(--af-border)] p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          <div className="space-y-6 overflow-y-auto pr-1">
            <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-white">Register Asset</h3>
              <button onClick={() => setShowRegForm(false)} className="text-[var(--af-muted)] hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form id="asset-reg-form" onSubmit={handleSubmitAsset((data) => createAssetMutation.mutate(data))} className="space-y-4">
              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Asset Name</label>
                <input
                  type="text"
                  {...registerAsset("name")}
                  placeholder="MacBook Pro M3 Max"
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)]"
                />
                {assetErrors.name && <p className="text-3xs text-red-400">{assetErrors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Acquisition Date</label>
                <input
                  type="date"
                  {...registerAsset("acquisitionDate")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)]"
                />
                {assetErrors.acquisitionDate && <p className="text-3xs text-red-400">{assetErrors.acquisitionDate.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Asset Category</label>
                <select
                  {...registerAsset("categoryId")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {assetErrors.categoryId && <p className="text-3xs text-red-400">{assetErrors.categoryId.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Cost (USD)</label>
                  <input
                    type="number"
                    {...registerAsset("acquisitionCost", { valueAsNumber: true })}
                    placeholder="2500"
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)]"
                  />
                  {assetErrors.acquisitionCost && <p className="text-3xs text-red-400">{assetErrors.acquisitionCost.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Serial Number</label>
                  <input
                    type="text"
                    {...registerAsset("serialNumber")}
                    placeholder="C02GGH..."
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)]"
                  />
                </div>
              </div>

              {/* Dynamic Optional Attributes Fields */}
              {Object.keys(optionalFields).length > 0 && (
                <div className="border-t border-[var(--af-border)] pt-4 space-y-3">
                  <span className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)] block">
                    Category Specific Metadata
                  </span>
                  <div className="space-y-3.5 bg-[var(--af-bg)]/40 border border-[var(--af-border)]/60 rounded-lg p-3">
                    {Object.entries(optionalFields).map(([key, type]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-3xs font-semibold uppercase tracking-wider text-neutral-300">
                          {key} ({String(type)})
                        </label>
                        <input
                          id={`meta-${key}`}
                          type={type === "number" ? "number" : "text"}
                          placeholder={`Enter custom ${key}`}
                          className="w-full rounded border border-[var(--af-border)] bg-[var(--af-bg)] px-2.5 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>

          <button
            type="submit"
            form="asset-reg-form"
            disabled={createAssetMutation.isPending}
            className="w-full rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-3 text-xs font-semibold transition disabled:opacity-50 mt-4"
          >
            {createAssetMutation.isPending ? "Registering asset..." : "Register Asset"}
          </button>
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-[var(--af-border)] pb-3">
              <div>
                <span className="font-mono text-xs text-[var(--af-accent)] font-semibold">{selectedAsset.assetTag}</span>
                <h4 className="font-[family-name:var(--font-display)] text-lg font-bold text-white mt-1">
                  {selectedAsset.name}
                </h4>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="text-[var(--af-muted)] hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Asset specifications */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 bg-[var(--af-bg)]/40 border border-[var(--af-border)]/60 rounded-lg p-4 text-xs">
                <h5 className="font-semibold text-white uppercase tracking-wider text-[var(--af-muted)]">Inventory Details</h5>
                <div className="divide-y divide-[var(--af-border)]">
                  <div className="flex justify-between py-2">
                    <span className="text-[var(--af-muted)]">Category</span>
                    <span className="text-white font-medium">
                      {selectedAsset.category?.name ?? selectedAsset.categoryId ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-[var(--af-muted)]">Serial Number</span>
                    <span className="text-white font-mono">{selectedAsset.serialNumber || "-"}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-[var(--af-muted)]">Acquisition Cost</span>
                    <span className="text-white font-mono flex items-center"><DollarSign className="h-3.5 w-3.5" />{(selectedAsset.acquisitionCost ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-[var(--af-muted)]">Lifecycle Status</span>
                    <span className="text-white font-medium">{selectedAsset.status}</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Metadata Attributes Display */}
              <div className="space-y-3 bg-[var(--af-bg)]/40 border border-[var(--af-border)]/60 rounded-lg p-4 text-xs">
                <h5 className="font-semibold text-white uppercase tracking-wider text-[var(--af-muted)]">Custom Attributes</h5>
                <div className="divide-y divide-[var(--af-border)]">
                  {selectedAsset.metadata && Object.keys(selectedAsset.metadata).length > 0 ? (
                    Object.entries(selectedAsset.metadata).map(([k, v]: [string, any]) => (
                      <div key={k} className="flex justify-between py-2">
                        <span className="text-[var(--af-muted)] capitalize">{k}</span>
                        <span className="text-white font-medium">{String(v)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-[var(--af-muted)]">No category-specific specifications.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Allocation History Log */}
            <div className="space-y-3">
              <h5 className="font-semibold text-white text-xs uppercase tracking-wider text-[var(--af-muted)] flex items-center gap-1.5">
                <History className="h-4 w-4" />
                Asset History timeline
              </h5>
              <div className="border border-[var(--af-border)] rounded-lg bg-[var(--af-bg)]/30 divide-y divide-[var(--af-border)] text-xs">
                {selectedAsset.status === AssetStatus.Available && (
                  <div className="p-3 text-[var(--af-muted)] text-center">No active allocation or bookings.</div>
                )}
                {selectedAsset.status === AssetStatus.Allocated && (
                  <div className="flex items-center justify-between p-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-cyan-950 border border-cyan-800 text-cyan-400 px-2 py-0.5 text-3xs font-semibold">Active Allocation</span>
                        <span className="text-white font-medium">Currently assigned</span>
                      </div>
                      <p className="text-[var(--af-muted)] text-3xs">Expected return dates can be managed under Allocations section.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <QrScanner
          onClose={() => setShowScanner(false)}
          onScan={(value) => {
            // QR payload is the asset tag; feed it straight into search
            setSearch(value.trim());
            setPage(1);
            setShowScanner(false);
          }}
        />
      )}
    </div>
  );
}

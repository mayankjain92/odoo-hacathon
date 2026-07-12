"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiClientError } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBookingSchema } from "@assetflow/shared";
import {
  CalendarDays,
  Clock,
  Plus,
  X,
  User,
  AlertTriangle,
  FileCheck,
  CheckCircle,
  HelpCircle,
  AlertCircle
} from "lucide-react";

export default function BookingsPage() {
  const queryClient = useQueryClient();

  // Dialog/Form State
  const [showBookForm, setShowBookForm] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Queries
  const { data: user } = useQuery<any>({ queryKey: ["auth-user"] });

  const { data: assetsRes } = useQuery<{ data: any[] }>({
    queryKey: ["assets"],
    queryFn: () => apiFetch<{ data: any[] }>("/assets?pageSize=100"),
  });
  const assets = assetsRes?.data || [];

  const { data: bookingsRes } = useQuery<{ data: any[] }>({
    queryKey: ["bookings"],
    queryFn: () => apiFetch<{ data: any[] }>("/bookings"),
  });
  const bookings = bookingsRes?.data || [];

  const { data: employeesRes } = useQuery<any>({
    queryKey: ["employees"],
    queryFn: () => apiFetch("/org/employees"),
  });
  const employees = employeesRes?.data || [];

  // Form for booking
  const {
    register: registerBooking,
    handleSubmit: handleSubmitBooking,
    reset: resetBooking,
    formState: { errors: bookingErrors },
  } = useForm({
    resolver: zodResolver(createBookingSchema),
    defaultValues: {
      assetId: "",
      startsAt: "",
      endsAt: "",
    },
  });

  // Mutation to book resource
  const bookMutation = useMutation({
    mutationFn: (data: any) => {
      // Map form string dates to Full ISO format
      return apiFetch("/bookings", {
        method: "POST",
        body: JSON.stringify({
          assetId: data.assetId,
          startsAt: new Date(data.startsAt).toISOString(),
          endsAt: new Date(data.endsAt).toISOString(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      resetBooking();
      setBookingError(null);
      setShowBookForm(false);
    },
    onError: (err: ApiClientError) => {
      setBookingError(err.message || "Overlap detected: The asset is already reserved for this duration.");
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--af-border)] pb-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">
            Resource Booking Calendar
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Reserve workspaces, laptops, projectors, or test devices for specified time intervals.
          </p>
        </div>

        <button
          onClick={() => setShowBookForm(true)}
          className="flex items-center gap-2 rounded-lg bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] px-4.5 py-2.5 text-xs font-semibold transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Book Resource
        </button>
      </div>

      {/* Main Agenda Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Reservation Timeline Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[var(--af-accent)]" />
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider text-[var(--af-muted)]">
              Upcoming Reservations
            </h3>
          </div>

          <div className="space-y-3">
            {bookings.length === 0 ? (
              <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/30 p-8 text-center text-xs text-[var(--af-muted)]">
                No asset bookings are currently scheduled.
              </div>
            ) : (
              bookings.map((booking: any) => {
                const asset = assets.find(a => a.id === booking.assetId);
                const emp = employees.find((e: any) => e.id === booking.userId);
                const start = new Date(booking.startedAt);
                const end = new Date(booking.endedAt);

                return (
                  <div
                    key={booking.id}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="rounded bg-[var(--af-surface-elevated)] border border-[var(--af-border)] px-2 py-0.5 text-3xs font-mono font-semibold text-[var(--af-accent)]">
                          {asset ? asset.assetTag : "AF-XXXX"}
                        </span>
                        <h4 className="text-white font-semibold text-xs">{asset ? asset.name : "Asset"}</h4>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-[var(--af-muted)]">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleDateString()} {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {emp && (
                          <div className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            <span>Reserved by <strong className="text-neutral-300">{emp.name}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="self-end sm:self-auto">
                      <span className={`rounded-full px-2.5 py-0.5 text-3xs font-semibold ${
                        booking.status === "Approved" ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40" :
                        booking.status === "Pending" ? "bg-amber-950 text-amber-400 border border-amber-800/40" :
                        "bg-neutral-900 text-neutral-400 border border-neutral-800"
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Info / Policy Column */}
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] p-5 space-y-4">
            <h4 className="font-semibold text-white text-sm">Booking Policies</h4>
            <ul className="space-y-3.5 text-xs text-[var(--af-muted)] list-disc pl-4 leading-relaxed">
              <li>
                Shared hardware assets must be booked at least <strong>1 hour</strong> prior to usage.
              </li>
              <li>
                Booking intervals cannot exceed <strong>14 consecutive days</strong> without Department Head authorization.
              </li>
              <li>
                The system automatically checks for overlap. Overlapping reservation requests will trigger an alert.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Book Drawer */}
      {showBookForm && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--af-surface)] border-l border-[var(--af-border)] p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-white flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[var(--af-accent)]" />
                Reserve Resource
              </h3>
              <button onClick={() => setShowBookForm(false)} className="text-[var(--af-muted)] hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {bookingError && (
              <div className="flex items-start gap-3 rounded-lg bg-red-950/50 border border-red-800/60 p-4 text-xs text-red-400">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Schedule Overlap Conflict</h4>
                  <p className="mt-0.5">{bookingError}</p>
                </div>
              </div>
            )}

            <form id="book-form" onSubmit={handleSubmitBooking((data) => bookMutation.mutate(data))} className="space-y-4">
              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Select Asset</label>
                <select
                  {...registerBooking("assetId")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                >
                  <option value="">Select Resource</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.assetTag}) - {a.status}</option>
                  ))}
                </select>
                {bookingErrors.assetId && <p className="text-3xs text-red-400">{bookingErrors.assetId.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Start Date & Time</label>
                <input
                  type="datetime-local"
                  {...registerBooking("startsAt")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                />
                {bookingErrors.startsAt && <p className="text-3xs text-red-400">{bookingErrors.startsAt.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">End Date & Time</label>
                <input
                  type="datetime-local"
                  {...registerBooking("endsAt")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                />
                {bookingErrors.endsAt && <p className="text-3xs text-red-400">{bookingErrors.endsAt.message}</p>}
              </div>
            </form>
          </div>

          <button
            type="submit"
            form="book-form"
            disabled={bookMutation.isPending}
            className="w-full rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-3 text-xs font-semibold transition disabled:opacity-50 mt-4"
          >
            {bookMutation.isPending ? "Validating timeslots..." : "Confirm Booking"}
          </button>
        </div>
      )}
    </div>
  );
}

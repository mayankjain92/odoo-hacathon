"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiClientError } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const bookingFormSchema = z
  .object({
    assetId: z.string().min(1, "Asset is required"),
    startDate: z.string().min(1, "Required"),
    startTime: z.string().min(1, "Required"),
    endDate: z.string().min(1, "Required"),
    endTime: z.string().min(1, "Required"),
  })
  .refine(
    (data) => {
      const start = new Date(`${data.startDate}T${data.startTime}`);
      const end = new Date(`${data.endDate}T${data.endTime}`);
      return end > start;
    },
    { message: "End must be after start", path: ["endTime"] }
  );
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
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export default function BookingsPage() {
  const queryClient = useQueryClient();

  // Dialog/Form State
  const [showBookForm, setShowBookForm] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Calendar State
  const [calAssetId, setCalAssetId] = useState<string>("");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

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

  // Bookings for the calendar's selected resource
  const { data: assetBookingsRes } = useQuery<any>({
    queryKey: ["asset-bookings", calAssetId],
    queryFn: () => apiFetch<any>(`/bookings/assets/${calAssetId}`),
    enabled: !!calAssetId,
  });
  const calBookings = assetBookingsRes?.bookings || [];

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
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      assetId: "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
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
          startsAt: new Date(`${data.startDate}T${data.startTime}`).toISOString(),
          endsAt: new Date(`${data.endDate}T${data.endTime}`).toISOString(),
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

  // Calendar derivations for the selected resource
  const bookableAssets = assets.filter((a: any) => a.isSharedBookable);
  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const leadingBlanks = new Date(calYear, calMonthIdx, 1).getDay();
  const today = new Date();
  const bookingsByDay: Record<number, any[]> = {};
  for (const b of calBookings) {
    const s = new Date(b.startsAt);
    if (s.getFullYear() === calYear && s.getMonth() === calMonthIdx) {
      const day = s.getDate();
      (bookingsByDay[day] = bookingsByDay[day] || []).push(b);
    }
  }

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

      {/* Resource Calendar */}
      <div className="space-y-4 rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/40 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[var(--af-accent)]" />
            <h3 className="text-sm font-semibold text-white">Resource Calendar</h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={calAssetId}
              onChange={(e) => setCalAssetId(e.target.value)}
              className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]"
            >
              <option value="">Select a resource…</option>
              {bookableAssets.map((a: any) => (
                <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1, 1))}
                className="rounded-md border border-[var(--af-border)] p-1.5 text-[var(--af-muted)] transition hover:text-white cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[7.5rem] text-center text-xs font-semibold text-white">
                {calMonth.toLocaleString("default", { month: "long", year: "numeric" })}
              </span>
              <button
                type="button"
                onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1, 1))}
                className="rounded-md border border-[var(--af-border)] p-1.5 text-[var(--af-muted)] transition hover:text-white cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {!calAssetId ? (
          <p className="py-8 text-center text-xs text-[var(--af-muted)]">
            Select a bookable resource to view its reservation calendar.
          </p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1 text-center text-3xs font-semibold uppercase tracking-wider text-[var(--af-muted)]">{d}</div>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="aspect-square rounded-md" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayBookings = bookingsByDay[day] || [];
              const isToday =
                today.getFullYear() === calYear &&
                today.getMonth() === calMonthIdx &&
                today.getDate() === day;
              return (
                <div
                  key={day}
                  className={`aspect-square overflow-hidden rounded-md border p-1.5 text-left ${
                    dayBookings.length
                      ? "border-[var(--af-accent)]/40 bg-[var(--af-accent)]/5"
                      : "border-[var(--af-border)] bg-[var(--af-surface)]/30"
                  } ${isToday ? "ring-1 ring-[var(--af-accent)]" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-2xs font-semibold ${isToday ? "text-[var(--af-accent)]" : "text-neutral-300"}`}>{day}</span>
                    {dayBookings.length > 0 && (
                      <span className="text-3xs font-bold text-[var(--af-accent)]">{dayBookings.length}</span>
                    )}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {dayBookings.slice(0, 2).map((b: any) => (
                      <div key={b.id} className="truncate rounded bg-[var(--af-accent)]/15 px-1 py-0.5 text-3xs text-[var(--af-accent)]">
                        {new Date(b.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    ))}
                    {dayBookings.length > 2 && (
                      <div className="text-3xs text-[var(--af-muted)]">+{dayBookings.length - 2}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                const start = new Date(booking.startsAt);
                const end = new Date(booking.endsAt);

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
                        booking.status === "Ongoing" ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40" :
                        booking.status === "Upcoming" ? "bg-amber-950 text-amber-400 border border-amber-800/40" :
                        booking.status === "Cancelled" ? "bg-red-950 text-red-400 border border-red-800/40" :
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
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    {...registerBooking("startDate")}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                  />
                  <input
                    type="time"
                    {...registerBooking("startTime")}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                  />
                </div>
                {bookingErrors.startDate && <p className="text-3xs text-red-400">{bookingErrors.startDate?.message?.toString()}</p>}
                {bookingErrors.startTime && <p className="text-3xs text-red-400">{bookingErrors.startTime?.message?.toString()}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">End Date & Time</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    {...registerBooking("endDate")}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                  />
                  <input
                    type="time"
                    {...registerBooking("endTime")}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                  />
                </div>
                {bookingErrors.endDate && <p className="text-3xs text-red-400">{bookingErrors.endDate?.message?.toString()}</p>}
                {bookingErrors.endTime && <p className="text-3xs text-red-400">{bookingErrors.endTime?.message?.toString()}</p>}
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

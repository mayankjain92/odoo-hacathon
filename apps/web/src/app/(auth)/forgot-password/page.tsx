"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiFetch, ApiClientError } from "@/lib/api";
import Link from "next/link";
import { Mail, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";

const forgotSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export default function ForgotPasswordPage() {
  const [success, setSuccess] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: { email: string }) => apiFetch<any>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (err: ApiClientError) => {
      setAuthError(err.message || "Failed to process request");
    },
  });

  const onSubmit = (data: { email: string }) => {
    setAuthError(null);
    mutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/80 p-8 shadow-2xl backdrop-blur-md">
        {success ? (
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-white">Check your email</h2>
            <p className="text-sm text-[var(--af-muted)]">
              We have sent password recovery instructions to your email address.
            </p>
            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-[var(--af-accent)] hover:underline"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-[var(--af-accent)] uppercase">
                AssetFlow ERP
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-white">
                Reset Password
              </h2>
              <p className="text-sm text-[var(--af-muted)]">
                Enter your email address to receive reset details
              </p>
            </div>

            {authError && (
              <div className="flex items-center gap-3 rounded-lg bg-red-950/50 border border-red-800/60 p-4 text-sm text-red-400">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p>{authError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--af-muted)]">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--af-muted)]">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    {...register("email")}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-bg)]/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition focus:border-[var(--af-accent)] focus:ring-1 focus:ring-[var(--af-accent)]"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full rounded-[var(--af-radius)] bg-[var(--af-accent)] py-3 font-semibold text-[#042f2e] transition hover:bg-[var(--af-accent-hover)] active:scale-[0.98] disabled:opacity-50"
              >
                {mutation.isPending ? "Sending link..." : "Send Reset Instructions"}
              </button>
            </form>

            <div className="text-center text-sm">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-[var(--af-muted)] hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema } from "@assetflow/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiClientError } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, User, KeyRound, AlertTriangle } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiFetch<any>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      router.push("/dashboard");
    },
    onError: (err: ApiClientError) => {
      setAuthError(err.message || "Registration failed");
    },
  });

  const onSubmit = (data: any) => {
    setAuthError(null);
    mutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center space-y-2">
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-[var(--af-accent)] uppercase">
            AssetFlow ERP
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-white">
            Register Account
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Create an employee profile to get started
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
              Full Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--af-muted)]">
                <User className="h-4 w-4" />
              </span>
              <input
                type="text"
                {...register("name")}
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-bg)]/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition focus:border-[var(--af-accent)] focus:ring-1 focus:ring-[var(--af-accent)]"
              />
            </div>
            {errors.name && (
              <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>
            )}
          </div>

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
                placeholder="jane.doe@company.com"
                className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-bg)]/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition focus:border-[var(--af-accent)] focus:ring-1 focus:ring-[var(--af-accent)]"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--af-muted)]">
              Password (min 8 chars)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--af-muted)]">
                <KeyRound className="h-4 w-4" />
              </span>
              <input
                type="password"
                {...register("password")}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-bg)]/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition focus:border-[var(--af-accent)] focus:ring-1 focus:ring-[var(--af-accent)]"
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
            )}
          </div>

          <div className="rounded-lg bg-[var(--af-surface-elevated)]/60 border border-[var(--af-border)]/85 p-3.5 text-xs text-[var(--af-muted)]">
            <p>
              Note: System policy restricts new registrations to the <strong>Employee</strong> role. Higher administrative clearance requires Admin promotion.
            </p>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-[var(--af-radius)] bg-[var(--af-accent)] py-3 font-semibold text-[#042f2e] transition hover:bg-[var(--af-accent-hover)] active:scale-[0.98] disabled:opacity-50"
          >
            {mutation.isPending ? "Creating account..." : "Register"}
          </button>
        </form>

        <div className="text-center text-sm text-[var(--af-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--af-accent)] hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

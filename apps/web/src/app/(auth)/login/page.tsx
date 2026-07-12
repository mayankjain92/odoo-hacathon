"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@assetflow/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiClientError } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Mail, AlertTriangle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiFetch<any>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      router.push("/dashboard");
    },
    onError: (err: ApiClientError) => {
      setAuthError(err.message || "Invalid credentials");
    },
  });

  const onSubmit = (data: any) => {
    setAuthError(null);
    mutation.mutate(data);
  };

  const handleQuickLogin = (email: string) => {
    setValue("email", email);
    setValue("password", "password123");
    onSubmit({ email, password: "password123" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center space-y-2">
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-[var(--af-accent)] uppercase">
            AssetFlow ERP
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-white">
            Welcome back
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Sign in to manage your enterprise resources
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--af-muted)]">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[var(--af-accent)] hover:underline"
              >
                Forgot?
              </Link>
            </div>
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

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-[var(--af-radius)] bg-[var(--af-accent)] py-3 font-semibold text-[#042f2e] transition hover:bg-[var(--af-accent-hover)] active:scale-[0.98] disabled:opacity-50"
          >
            {mutation.isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-[var(--af-border)]"></div>
          <span className="flex-shrink mx-4 text-xs uppercase tracking-wider text-[var(--af-muted)]">
            Quick demo login
          </span>
          <div className="flex-grow border-t border-[var(--af-border)]"></div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => handleQuickLogin("admin@assetflow.com")}
            className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 py-2 text-center text-white hover:border-[var(--af-accent)]/50 transition cursor-pointer"
          >
            Admin Profile
          </button>
          <button
            onClick={() => handleQuickLogin("manager@assetflow.com")}
            className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 py-2 text-center text-white hover:border-[var(--af-accent)]/50 transition cursor-pointer"
          >
            Asset Manager
          </button>
          <button
            onClick={() => handleQuickLogin("head@assetflow.com")}
            className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 py-2 text-center text-white hover:border-[var(--af-accent)]/50 transition cursor-pointer"
          >
            IT Dept Head
          </button>
          <button
            onClick={() => handleQuickLogin("employee@assetflow.com")}
            className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 py-2 text-center text-white hover:border-[var(--af-accent)]/50 transition cursor-pointer"
          >
            IT Employee
          </button>
        </div>

        <div className="text-center text-sm text-[var(--af-muted)]">
          Need an account?{" "}
          <Link href="/signup" className="text-[var(--af-accent)] hover:underline">
            Register employee
          </Link>
        </div>
      </div>
    </div>
  );
}

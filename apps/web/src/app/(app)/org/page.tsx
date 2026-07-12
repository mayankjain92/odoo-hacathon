"use client";

import React, { useState } from "react";
import { useCurrentUser } from "@/features/org/org-api";
import DepartmentsTab from "@/features/org/DepartmentsTab";
import CategoriesTab from "@/features/org/CategoriesTab";
import EmployeesTab from "@/features/org/EmployeesTab";

export default function OrgPage() {
  const [activeTab, setActiveTab] = useState<"departments" | "categories" | "employees">("departments");
  const { data: user, isLoading } = useCurrentUser();

  const isAdmin = user?.role === "Admin";

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-[var(--af-muted)] animate-pulse">Loading organization setup...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--af-text)]">
          Organization Control
        </h1>
        <p className="text-[var(--af-muted)] max-w-2xl">
          Manage departments, asset classification schemas, and system employee role promotions.
          {!isAdmin && (
            <span className="ml-1 text-[var(--af-accent)]/80">(Read-Only View)</span>
          )}
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="border-b border-[var(--af-border)]">
        <div className="flex gap-6 -mb-px">
          <button
            onClick={() => setActiveTab("departments")}
            className={`pb-4 text-sm font-medium border-b-2 transition-all duration-200 ${
              activeTab === "departments"
                ? "border-[var(--af-accent)] text-[var(--af-accent)]"
                : "border-transparent text-[var(--af-muted)] hover:text-[var(--af-text)]"
            }`}
          >
            Departments
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`pb-4 text-sm font-medium border-b-2 transition-all duration-200 ${
              activeTab === "categories"
                ? "border-[var(--af-accent)] text-[var(--af-accent)]"
                : "border-transparent text-[var(--af-muted)] hover:text-[var(--af-text)]"
            }`}
          >
            Asset Categories
          </button>
          <button
            onClick={() => setActiveTab("employees")}
            className={`pb-4 text-sm font-medium border-b-2 transition-all duration-200 ${
              activeTab === "employees"
                ? "border-[var(--af-accent)] text-[var(--af-accent)]"
                : "border-transparent text-[var(--af-muted)] hover:text-[var(--af-text)]"
            }`}
          >
            Employees Directory
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === "departments" && <DepartmentsTab isAdmin={isAdmin} />}
        {activeTab === "categories" && <CategoriesTab isAdmin={isAdmin} />}
        {activeTab === "employees" && <EmployeesTab isAdmin={isAdmin} />}
      </div>
    </div>
  );
}

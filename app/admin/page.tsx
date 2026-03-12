"use client";
import { useMemo, useState, useEffect } from "react";

type NavItem = {
  key: string;
  label: string;
};

const navItems: NavItem[] = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "levels", label: "Levels" },
  { key: "payouts", label: "Payouts" },
  { key: "settings", label: "Settings" },
];

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 sm:p-5 shadow-sm ring-1 ring-ring">
      <div className="text-xs text-subtext">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {hint ? <div className="mt-2 text-sm text-subtext">{hint}</div> : null}
    </div>
  );
}

export default function AdminPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [active, setActive] = useState<NavItem["key"]>("overview");

  const users = useMemo(
    () => [
      { id: "USR-1024", name: "Ali Khan", status: "Active", directs: 2, level: 6 },
      { id: "USR-1025", name: "Mehak Shah", status: "Active", directs: 2, level: 4 },
      { id: "USR-1026", name: "Haris Farooq", status: "Pending", directs: 1, level: 2 },
      { id: "USR-1027", name: "Ayesha Iqbal", status: "Blocked", directs: 0, level: 1 },
    ],
    [],
  );

  const activity = useMemo(
    () => [
      { time: "2m ago", text: "USR-1026 completed signup" },
      { time: "10m ago", text: "USR-1025 added a direct invite" },
      { time: "1h ago", text: "Payout batch generated (preview)" },
      { time: "3h ago", text: "Policy updated: max directs = 2" },
    ],
    [],
  );

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-ring hover:bg-muted lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
            <div>
              <div className="text-xs text-subtext">Admin Panel</div>
              <div className="text-lg font-semibold">MLM Marketing</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium">Admin</div>
              <div className="text-xs text-subtext">admin@mlm.local</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20">
              AD
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block">
            <div className="rounded-3xl bg-card p-3 shadow-sm ring-1 ring-ring">
              <div className="px-3 py-2 text-xs font-medium text-subtext">Navigation</div>
              <div className="mt-1 grid gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActive(item.key)}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                      active === item.key ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>{item.label}</span>
                    {active === item.key ? <span className="text-primary">●</span> : null}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="space-y-6">
            <div className="w-full max-w-full rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm text-subtext">Overview</div>
                  <div className="mt-1 text-2xl font-semibold">System snapshot</div>
                  <div className="mt-2 max-w-2xl text-sm text-subtext">
                    Yeh admin UI preview hai. Abhi backend connect nahi, lekin structure ready hai for users, levels (1–20), aur payouts.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-muted w-full sm:w-auto"
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90 w-full sm:w-auto"
                  >
                    Create Payout Batch
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total Users" value="2,431" hint="Active: 2,118 · Pending: 207" />
                <StatCard label="Max Directs" value="2" hint="Per-user join limit" />
                <StatCard label="Levels" value="20" hint="Binary tree depth" />
                <StatCard label="Today Signups" value="48" hint="Last 24 hours (preview)" />
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="w-full max-w-full rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Users</div>
                    <div className="mt-1 text-sm text-subtext">Latest accounts and status</div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      className="h-10 w-full sm:w-40 rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Search"
                    />
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center rounded-2xl bg-muted px-4 text-sm font-medium text-foreground ring-1 ring-ring transition hover:bg-secondary"
                    >
                      Filter
                    </button>
                  </div>
                </div>

                <div className="mt-6 w-full max-w-full overflow-x-auto rounded-2xl ring-1 ring-ring sm:overflow-visible">
                  <div className="min-w-[680px] sm:min-w-0">
                    <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.6fr] gap-2 bg-muted px-3 sm:px-4 py-3 text-xs font-medium text-subtext">
                      <div>User</div>
                      <div>Status</div>
                      <div>Directs</div>
                      <div>Level</div>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto sm:max-h-none sm:overflow-y-visible">
                      <div className="divide-y divide-[color:var(--ring)]">
                        {users.map((u) => (
                          <div key={u.id} className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.6fr] gap-2 px-3 sm:px-4 py-4 text-sm">
                            <div>
                              <div className="font-medium text-foreground">{u.name}</div>
                              <div className="text-xs text-subtext">{u.id}</div>
                            </div>
                            <div className="flex items-center">
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                                  u.status === "Active"
                                    ? "bg-[rgba(16,185,129,0.10)] text-foreground ring-[rgba(16,185,129,0.35)]"
                                    : u.status === "Pending"
                                      ? "bg-[rgba(255,106,0,0.10)] text-foreground ring-[rgba(255,106,0,0.35)]"
                                      : "bg-[rgba(239,68,68,0.10)] text-foreground ring-[rgba(239,68,68,0.35)]"
                                }`}
                              >
                                {u.status}
                              </span>
                            </div>
                            <div className="text-subtext">{u.directs}/2</div>
                            <div className="text-subtext">L{u.level}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full max-w-full rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
                <div className="text-sm font-semibold">Recent Activity</div>
                <div className="mt-1 text-sm text-subtext">System events (preview)</div>
                <div className="mt-6 grid gap-3">
                  {activity.map((a, i) => (
                    <div key={i} className="rounded-2xl bg-muted p-3 sm:p-4 ring-1 ring-ring">
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-sm text-foreground">{a.text}</div>
                        <div className="text-xs text-subtext">{a.time}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 w-full max-w-full rounded-2xl bg-muted p-5 ring-1 ring-ring">
                  <div className="text-sm font-semibold">Level Configuration</div>
                  <div className="mt-2 text-sm text-subtext">Current: 20 levels · Direct limit: 2</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-card px-5 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-background w-full"
                    >
                      Edit Levels
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90 w-full"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
          />
          <div className="absolute left-0 top-0 h-full w-[84%] max-w-xs bg-card shadow-xl ring-1 ring-ring">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="text-sm font-semibold">Admin Menu</div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground ring-1 ring-ring hover:bg-secondary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="px-3 pb-4">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActive(item.key);
                    setMobileNavOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    active === item.key ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{item.label}</span>
                  {active === item.key ? <span className="text-primary">●</span> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

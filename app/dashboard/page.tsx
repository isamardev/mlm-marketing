"use client";
import { useMemo, useState } from "react";

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
    <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-ring">
      <div className="text-xs text-subtext">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {hint ? <div className="mt-2 text-sm text-subtext">{hint}</div> : null}
    </div>
  );
}

export default function UserDashboardPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [active, setActive] = useState<"home" | "network" | "wallet" | "settings">("home");
  const [level, setLevel] = useState(6);
  const maxLevel = 20;

  const newAtLevel = (n: number) => Math.pow(2, n - 1);
  const totalAtLevel = (n: number) => Math.pow(2, n) - 1;

  const networkRows = useMemo(() => {
    const rows: { level: number; newNodes: number; total: number }[] = [];
    for (let i = 1; i <= maxLevel; i += 1) {
      rows.push({ level: i, newNodes: newAtLevel(i), total: totalAtLevel(i) });
    }
    return rows;
  }, []);

  const transactions = useMemo(
    () => [
      { id: "TX-9001", type: "Referral Bonus", amount: "+1,200", date: "Today" },
      { id: "TX-9002", type: "Wallet Transfer", amount: "-500", date: "Yesterday" },
      { id: "TX-9003", type: "Level Bonus", amount: "+2,400", date: "2 days ago" },
    ],
    [],
  );

  const activeRow = networkRows[level - 1];

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
              <div className="text-xs text-subtext">User Panel</div>
              <div className="text-lg font-semibold">Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium">Ali Khan</div>
              <div className="text-xs text-subtext">USR-1024</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20">
              AK
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block">
            <div className="rounded-3xl bg-card p-3 shadow-sm ring-1 ring-ring">
              <div className="px-3 py-2 text-xs font-medium text-subtext">Menu</div>
              <div className="mt-1 grid gap-1">
                {[
                  { key: "home", label: "Home" },
                  { key: "network", label: "My Network" },
                  { key: "wallet", label: "Wallet" },
                  { key: "settings", label: "Settings" },
                ].map((i) => (
                  <button
                    key={i.key}
                    type="button"
                    onClick={() => setActive(i.key as typeof active)}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                      active === i.key ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>{i.label}</span>
                    {active === i.key ? <span className="text-primary">●</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-ring">
              <div className="text-xs text-subtext">Referral Link</div>
              <div className="mt-2 truncate rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                https://mlm.local/ref/USR-1024
              </div>
              <button
                type="button"
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
              >
                Copy Link
              </button>
            </div>
          </aside>

          <main className="space-y-6">
            <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm text-subtext">Welcome back</div>
                  <div className="mt-1 text-2xl font-semibold">Ali Khan</div>
                  <div className="mt-2 max-w-2xl text-sm text-subtext">
                    Yeh user panel UI preview hai. Network summary, levels (1–20), aur wallet sections ready hain.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-muted"
                  >
                    Withdraw
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
                  >
                    Add Direct
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Directs" value="2/2" hint="Limit reached" />
                <StatCard label="Active Level" value={`L${level}`} hint="Current depth" />
                <StatCard label="Total Network" value={totalAtLevel(level).toLocaleString()} hint="Up to active level" />
                <StatCard label="Wallet Balance" value="PKR 12,850" hint="Preview" />
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl bg-muted p-6 ring-1 ring-ring sm:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Network Explorer</div>
                    <div className="mt-1 text-sm text-subtext">Level 1 par 1, Level 2 par 3, aise hi grow hota hai</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-subtext">Selected</div>
                    <div className="text-lg font-semibold">L{level}</div>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={maxLevel}
                    value={level}
                    onChange={(e) => setLevel(parseInt(e.target.value, 10))}
                    className="w-full accent-primary"
                  />
                  <div className="flex w-20 items-center justify-center rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring">
                    L{level}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <StatCard label={`Total at L${level}`} value={activeRow.total.toLocaleString()} />
                  <StatCard label={`New on L${level}`} value={activeRow.newNodes.toLocaleString()} />
                  <StatCard label="Max Level" value="20" />
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl bg-card ring-1 ring-ring">
                  <div className="grid grid-cols-[0.6fr_1fr_1fr] gap-2 bg-muted px-4 py-3 text-xs font-medium text-subtext">
                    <div>Level</div>
                    <div>New</div>
                    <div>Total</div>
                  </div>
                  <div className="max-h-[360px] overflow-auto">
                    {networkRows.map((r) => (
                      <div
                        key={r.level}
                        className={`grid grid-cols-[0.6fr_1fr_1fr] gap-2 px-4 py-3 text-sm ${
                          r.level === level ? "bg-[rgba(255,106,0,0.08)]" : ""
                        }`}
                      >
                        <div className="font-medium">L{r.level}</div>
                        <div className="text-subtext">{r.newNodes.toLocaleString()}</div>
                        <div className="text-subtext">{r.total.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
                <div className="text-sm font-semibold">Wallet</div>
                <div className="mt-1 text-sm text-subtext">Recent transactions (preview)</div>
                <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-ring">
                  <div className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 bg-muted px-4 py-3 text-xs font-medium text-subtext">
                    <div>Type</div>
                    <div>Amount</div>
                    <div>Date</div>
                  </div>
                  <div className="divide-y divide-[color:var(--ring)]">
                    {transactions.map((t) => (
                      <div key={t.id} className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 px-4 py-4 text-sm">
                        <div>
                          <div className="font-medium text-foreground">{t.type}</div>
                          <div className="text-xs text-subtext">{t.id}</div>
                        </div>
                        <div className={`font-medium ${t.amount.startsWith("+") ? "text-[rgb(16,185,129)]" : "text-[rgb(239,68,68)]"}`}>
                          {t.amount}
                        </div>
                        <div className="text-subtext">{t.date}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-muted px-5 text-sm font-medium text-foreground ring-1 ring-ring transition hover:bg-secondary"
                  >
                    Download Statement
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
                  >
                    Add Funds
                  </button>
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
              <div className="text-sm font-semibold">Menu</div>
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
              {[
                { key: "home", label: "Home" },
                { key: "network", label: "My Network" },
                { key: "wallet", label: "Wallet" },
                { key: "settings", label: "Settings" },
              ].map((i) => (
                <button
                  key={i.key}
                  type="button"
                  onClick={() => {
                    setActive(i.key as typeof active);
                    setMobileNavOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    active === i.key ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{i.label}</span>
                  {active === i.key ? <span className="text-primary">●</span> : null}
                </button>
              ))}
            </div>
            <div className="px-4 pb-6">
              <div className="text-xs text-subtext">Referral Link</div>
              <div className="mt-2 truncate rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                https://mlm.local/ref/USR-1024
              </div>
              <button
                type="button"
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


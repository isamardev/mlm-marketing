"use client";
import { useCallback, useMemo, useState, useEffect, type FormEvent } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaUser } from "react-icons/fa";
import { toast } from "react-toastify";

type NavItem = {
  key: string;
  label: string;
};

const navItems: NavItem[] = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "deposits", label: "Deposits" },
  { key: "levels", label: "Levels" },
  { key: "payouts", label: "Payouts" },
  { key: "settings", label: "Settings" },
  { key: "withdrawals", label: "Withdrawals" },
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

function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAdminLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (username === "admin" && password === "admin123") {
      const result = await signIn("credentials", {
        email: "admin@example.com",
        password: "admin123",
        redirect: false,
      });
      
      if (result?.error) {
        setError("Login failed");
      } else {
        router.push("/admin");
      }
    } else {
      setError("Invalid admin credentials");
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent">
      <div className="w-full max-w-md p-6">
        <div className="rounded-3xl bg-card p-8 shadow-xl ring-1 ring-ring">
          <h1 className="text-2xl font-semibold text-center mb-6">Admin Login</h1>
          
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-2xl bg-background px-4 py-3 text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Enter admin username"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl bg-background px-4 py-3 text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Enter admin password"
                required
              />
            </div>
            
            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-primary py-3 text-white font-medium ring-1 ring-primary/20 transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Admin Login"}
            </button>
          </form>
          
          <div className="mt-6 text-center text-sm text-subtext">
            Use username: <strong>admin</strong> and password: <strong>admin123</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function NetworkTreeAdmin({ nodes, origin, onCopyMessage }: { nodes: any[], origin: string, onCopyMessage: (message: string) => void }) {
  const [w, setW] = useState(800);
  const ref = (typeof window !== "undefined" ? (document.createElement("div") as HTMLDivElement) : null);
  useEffect(() => {
    const update = () => {
      const el = document.getElementById("admin-tree-canvas");
      const width = el ? (el.clientWidth || 800) : 800;
      setW(width);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const nodesByDepth = useMemo(() => {
    const grouped: Record<number, any[]> = {};
    nodes.forEach((node) => {
      if (!grouped[node.depth]) grouped[node.depth] = [];
      grouped[node.depth].push(node);
    });
    return grouped;
  }, [nodes]);

  const depths = Object.keys(nodesByDepth).map(Number).sort((a, b) => a - b);
  const maxDepth = Math.max(...depths, 0);

  const rowH = 84;
  const padY = 20;
  const iconSize = 24;

  const rows = useMemo(() => {
    const r: Array<Array<{ x: number; y: number; node: any }>> = [];
    for (let depth = 0; depth <= maxDepth; depth += 1) {
      const levelNodes = nodesByDepth[depth] || [];
      const y = padY + depth * rowH;
      const pts = levelNodes.map((node, idx) => ({
        x: Math.round(w * ((idx + 1) / (levelNodes.length + 1))),
        y,
        node,
      }));
      r.push(pts);
    }
    return r;
  }, [maxDepth, nodesByDepth, w]);

  const svgW = w;
  const svgH = padY + (maxDepth + 1) * rowH + 20;

  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let depth = 0; depth < rows.length - 1; depth += 1) {
    const parentRow = rows[depth];
    const childRow = rows[depth + 1];
    parentRow.forEach((parent) => {
      const children = childRow.filter((child) => child.node.referredById === parent.node.id);
      children.forEach((child) => {
        lines.push({
          x1: parent.x,
          y1: parent.y + iconSize / 2,
          x2: child.x,
          y2: child.y - iconSize / 2,
        });
      });
    });
  }

  return (
    <div id="admin-tree-canvas" className="relative mt-5 w-full">
      <svg width={svgW} height={svgH} className="block" style={{ maxWidth: "100%" }}>
        {lines.map((ln, idx) => (
          <line key={idx} x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} stroke="var(--ring)" strokeWidth={1.5} />
        ))}
      </svg>
      <div className="absolute inset-0">
        {rows.flatMap((row, depth) =>
          row.map((pt, idx) => (
            <div key={`a-${depth}-${idx}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pt.x, top: pt.y }}>
              <div className="flex flex-col items-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 ring-1 ring-ring">
                  <FaUser className="text-foreground" size={16} />
                </div>
                <div className="mt-1 text-xs font-medium text-foreground max-w-[80px] truncate">
                  {pt.node.username}
                </div>
                <div className="text-[10px] text-subtext">L{pt.node.depth}</div>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const text = origin ? `${origin}/?ref=${pt.node.referrerCode}` : pt.node.referrerCode;
                    try {
                      await navigator.clipboard.writeText(text);
                      onCopyMessage(`Copied ${pt.node.username}'s referral link`);
                    } catch {
                      onCopyMessage("Copy failed");
                    }
                  }}
                  className="mt-1 text-[8px] text-blue-500 hover:text-blue-700 underline"
                >
                  Copy Link
                </button>
              </div>
            </div>
          )),
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [active, setActive] = useState<NavItem["key"]>("overview");

  const [stats, setStats] = useState<{
    totalUsers: number;
    totalDeposits: number;
    systemBalance: number;
    availableBalance: number;
    todayEarning: number;
  } | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [levels, setLevels] = useState<number[]>(Array.from({ length: 20 }, () => 0));
  const [levelsMsg, setLevelsMsg] = useState("");
  const [payoutMsg, setPayoutMsg] = useState("");
  const [payoutUserId, setPayoutUserId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutHash, setPayoutHash] = useState("");
  const [adminTreeNodes, setAdminTreeNodes] = useState<any[] | null>(null);
  const [origin, setOrigin] = useState("");
  const [adminUiMsg, setAdminUiMsg] = useState("");
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [deposits, setDeposits] = useState<any[]>([]);
  const [depositStatus, setDepositStatus] = useState<string>("all");
  const [userStatusFilter, setUserStatusFilter] = useState<string>("all");
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

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
    const o = typeof window !== "undefined" ? window.location.origin : "";
    setOrigin(o);
  }, []);

  const fetchAdminUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setUsers([]);
        setUsersError(typeof data?.error === "string" ? data.error : "Failed to load users");
        return;
      }
      if (Array.isArray(data?.users)) {
        setUsers(data.users);
      } else {
        setUsers([]);
        setUsersError("No users data found");
      }
    } catch {
      setUsers([]);
      setUsersError("Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!session?.user?.id || session.user.status !== "admin") {
      return;
    }
    const load = async () => {
      const [s, l, t] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/settings", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/tree", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (typeof s?.totalUsers === "number") setStats(s);
      if (Array.isArray(l?.levelPercentages) && l.levelPercentages.length === 20) {
        setLevels(l.levelPercentages.map((x: any) => Number(x)));
      }
      if (Array.isArray(t?.nodes)) setAdminTreeNodes(t.nodes);
      try {
        const res = await fetch("/api/admin/withdrawals", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setPendingWithdrawals(data.items || []);
      } catch {}
      try {
        const res = await fetch("/api/admin/deposits", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setDeposits(data.items || []);
      } catch {}
    };
    load().catch(() => setLevelsMsg("Failed to load admin data"));
  }, [router, session?.user?.id, session?.user?.status, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!session?.user?.id || session.user.status !== "admin") return;
    if (active !== "users") return;
    fetchAdminUsers().catch(() => undefined);
  }, [active, fetchAdminUsers, session?.user?.id, session?.user?.status, status]);

  const initials = useMemo(() => {
    const email = session?.user?.email ?? "admin";
    return String(email).slice(0, 2).toUpperCase();
  }, [session?.user?.email]);
  const toUSD = useCallback(
    (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
        Number.isFinite(n) ? n : 0,
      ),
    [],
  );

  if (status !== "authenticated" || !session?.user?.id || session.user.status !== "admin") {
    return <AdminLoginForm />;
  }

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
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="hidden h-10 w-10 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-ring hover:bg-muted lg:inline-flex"
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              {sidebarCollapsed ? "›" : "‹"}
            </button>
              <div className="flex items-center gap-3">
                <img src="/logo.svg" alt="Logo" className="h-8 w-auto rounded-md ring-1 ring-ring" />
              </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium">{session?.user?.name ?? "Admin"}</div>
              <div className="text-xs text-subtext">{session?.user?.email ?? "-"}</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20">
              {initials}
            </div>
          </div>
        </div>

        <div className={`mt-6 grid gap-6 ${sidebarCollapsed ? "lg:grid-cols-[1fr]" : "lg:grid-cols-[260px_1fr]"}`}>
          {!sidebarCollapsed && (
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
          )}

          <main className="space-y-6">
            {active === "overview" ? (
              <>
                <div className="w-full max-w-full overflow-hidden rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm text-subtext">Overview</div>
                      <div className="mt-1 text-2xl font-semibold">System snapshot</div>
                      <div className="mt-2 max-w-2xl text-sm text-subtext">
                        Live admin APIs enabled: stats, settings, users, deposit verify, and payouts.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="inline-flex items-center justify-center rounded-full bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-muted w-full sm:w-auto"
                      >
                        Logout
                      </button>
                      <button
                        type="button"
                        onClick={() => setActive("payouts")}
                        className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90 w-full sm:w-auto"
                      >
                        Verify Deposit
                      </button>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                    <StatCard label="Total Users" value={String(stats?.totalUsers ?? 0)} hint="All statuses" />
                    <StatCard label="Total Deposits" value={toUSD(Number(stats?.totalDeposits ?? 0))} hint="Transaction type: deposit" />
                    <StatCard label="Available Balance" value={toUSD(Number(stats?.availableBalance ?? 0))} hint="Admin wallet" />
                    <StatCard label="Today Earning" value={toUSD(Number(stats?.todayEarning ?? 0))} hint="Admin commissions today" />
                    <StatCard label="System Balance" value={toUSD(Number(stats?.systemBalance ?? 0))} hint="Sum of balances" />
                    <StatCard label="Levels" value="20" hint="Commission depth" />
                  </div>
                </div>
                <div className="w-full max-w-full overflow-hidden rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
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
                </div>
              </>
            ) : null}

            {active === "users" ? (
              <div className="w-full max-w-full overflow-hidden rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Users</div>
                    <div className="mt-1 text-sm text-subtext">Users with downline count (33 levels · payouts L1-20)</div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={userStatusFilter}
                      onChange={(e) => setUserStatusFilter(e.target.value)}
                      className="h-10 rounded-2xl bg-background px-3 text-sm text-foreground ring-1 ring-ring"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="blocked">Blocked</option>
                      <option value="admin">Admin</option>
                    </select>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-10 w-full sm:w-40 rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Search"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        fetchAdminUsers().catch(() => undefined);
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-2xl bg-card px-4 text-sm font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                {usersError ? (
                  <div className="mt-4 rounded-2xl bg-card p-4 text-sm text-red-500 ring-1 ring-ring">{usersError}</div>
                ) : null}
                <div className="mt-6 w-full max-w-full overflow-x-auto rounded-2xl ring-1 ring-ring sm:overflow-visible">
                  <div className="min-w-[680px] sm:min-w-0">
                    <div className="grid grid-cols-[1.2fr_0.7fr_0.8fr_0.7fr_0.8fr_1fr] gap-2 bg-muted px-3 sm:px-4 py-3 text-xs font-medium text-subtext">
                      <div>User</div>
                      <div>Status</div>
                      <div>Verify</div>
                      <div>Balance</div>
                      <div>Downline</div>
                      <div>Action</div>
                    </div>
                    <div className="max-h-[560px] overflow-y-auto sm:max-h-none sm:overflow-y-visible">
                      <div className="divide-y divide-[color:var(--ring)]">
                        {usersLoading ? (
                          <div className="px-4 py-6 text-center text-sm text-subtext">Loading users...</div>
                        ) : null}
                        {users
                          .filter((u) => {
                            if (userStatusFilter === "all") return true;
                            return String(u.status ?? "").toLowerCase() === userStatusFilter.toLowerCase();
                          })
                          .filter((u) => {
                            if (!search.trim()) return true;
                            const s = search.trim().toLowerCase();
                            return (
                              String(u.username ?? "").toLowerCase().includes(s) ||
                              String(u.email ?? "").toLowerCase().includes(s) ||
                              String(u.referrerCode ?? "").toLowerCase().includes(s)
                            );
                          })
                          .map((u) => (
                            <div key={u.id} className="grid grid-cols-[1.2fr_0.7fr_0.8fr_0.7fr_0.8fr_1fr] gap-2 px-3 sm:px-4 py-4 text-sm">
                              <div>
                                <div className="font-medium text-foreground">{u.username}</div>
                                <div className="text-xs text-subtext">{u.email}</div>
                              </div>
                              <div className="flex items-center">
                                <span
                                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                                    u.status === "active" || u.status === "admin"
                                      ? "bg-[rgba(16,185,129,0.10)] text-foreground ring-[rgba(16,185,129,0.35)]"
                                      : u.status === "inactive"
                                      ? "bg-[rgba(255,106,0,0.10)] text-foreground ring-[rgba(255,106,0,0.35)]"
                                      : "bg-[rgba(239,68,68,0.10)] text-foreground ring-[rgba(239,68,68,0.35)]"
                                  }`}
                                >
                                  {u.status}
                                </span>
                              </div>
                              <div className="flex items-center">
                                {u.verifyStatus === "verified" ? (
                                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 bg-[rgba(16,185,129,0.10)] text-foreground ring-[rgba(16,185,129,0.35)]">
                                    VERIFIED
                                  </span>
                                ) : u.verifyStatus === "unverified" ? (
                                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 bg-[rgba(239,68,68,0.10)] text-foreground ring-[rgba(239,68,68,0.35)]">
                                    UNVERIFIED{typeof u.secondsLeft === "number" && u.secondsLeft > 0 ? ` · ${Math.floor(u.secondsLeft / 3600)}h` : ""}
                                  </span>
                                ) : u.verifyStatus === "expired" ? (
                                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 bg-[rgba(255,106,0,0.10)] text-foreground ring-[rgba(255,106,0,0.35)]">
                                    EXPIRED
                                  </span>
                                ) : (
                                  <span className="text-xs text-subtext">—</span>
                                )}
                              </div>
                              <div className="text-subtext">{String(u.balance ?? 0)}</div>
                              <div className="text-subtext">{String(u.downlineCount ?? 0)}</div>
                              <div className="flex items-center gap-2">
                                {u.status === "admin" ? (
                                  <span className="text-xs text-subtext">Admin</span>
                                ) : (
                                  <>
                                    {u.status !== "active" && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            const res = await fetch("/api/admin/users/status", {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ id: u.id, status: "active" }),
                                            });
                                            const data = await res.json();
                                            if (!res.ok) {
                                              toast.error(typeof data?.error === "string" ? data.error : "Update failed");
                                              return;
                                            }
                                            toast.success(u.status === "blocked" ? "User unblocked" : "User activated");
                                            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: "active" } : x)));
                                          } catch {
                                            toast.error("Update failed");
                                          }
                                        }}
                                        className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-1 text-xs text-white ring-1 ring-primary/20"
                                      >
                                        {u.status === "blocked" ? "Unblock" : "Activate"}
                                      </button>
                                    )}
                                    {u.status !== "inactive" && u.status !== "admin" && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            const res = await fetch("/api/admin/users/status", {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ id: u.id, status: "inactive" }),
                                            });
                                            const data = await res.json();
                                            if (!res.ok) {
                                              toast.error(typeof data?.error === "string" ? data.error : "Update failed");
                                              return;
                                            }
                                            toast.success("User deactivated");
                                            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: "inactive" } : x)));
                                          } catch {
                                            toast.error("Update failed");
                                          }
                                        }}
                                        className="inline-flex items-center justify-center rounded-full bg-card px-3 py-1 text-xs text-foreground ring-1 ring-ring"
                                      >
                                        Deactivate
                                      </button>
                                    )}
                                    {u.status !== "blocked" && u.status !== "admin" && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            const res = await fetch("/api/admin/users/status", {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ id: u.id, status: "blocked" }),
                                            });
                                            const data = await res.json();
                                            if (!res.ok) {
                                              toast.error(typeof data?.error === "string" ? data.error : "Update failed");
                                              return;
                                            }
                                            toast.success("User blocked");
                                            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: "blocked" } : x)));
                                          } catch {
                                            toast.error("Update failed");
                                          }
                                        }}
                                        className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1 text-xs text-white ring-1 ring-red-600/20"
                                      >
                                        Block
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        {!usersLoading &&
                        users
                          .filter((u) => {
                            if (userStatusFilter === "all") return true;
                            return String(u.status ?? "").toLowerCase() === userStatusFilter.toLowerCase();
                          })
                          .filter((u) => {
                            if (!search.trim()) return true;
                            const s = search.trim().toLowerCase();
                            return (
                              String(u.username ?? "").toLowerCase().includes(s) ||
                              String(u.email ?? "").toLowerCase().includes(s) ||
                              String(u.referrerCode ?? "").toLowerCase().includes(s)
                            );
                          }).length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-subtext">No users found</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {active === "payouts" ? (
              <div className="w-full max-w-full overflow-hidden rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
                <div className="text-sm font-semibold">Verify Deposit Hash</div>
                <div className="mt-1 text-sm text-subtext">Admin-only: dedupe + optional BscScan verify + payout trigger</div>
                <form
                  className="mt-4 grid gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPayoutMsg("");
                    try {
                      const res = await fetch("/api/admin/verify-hash", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          sourceUserId: payoutUserId,
                          txHash: payoutHash,
                          amount: Number(payoutAmount),
                          chain: "BSC",
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        setPayoutMsg(typeof data?.error === "string" ? data.error : "Verify failed");
                        toast.error(typeof data?.error === "string" ? data.error : "Verify failed");
                        return;
                      }
                      setPayoutMsg("Verified and payout processed");
                      toast.success("Verified and payout processed");
                    } catch {
                      setPayoutMsg("Verify failed");
                      toast.error("Verify failed");
                    }
                  }}
                >
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-subtext">User ID</span>
                    <input
                      required
                      value={payoutUserId}
                      onChange={(e) => setPayoutUserId(e.target.value)}
                      className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="cuid..."
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-subtext">Transaction Hash</span>
                    <input
                      required
                      value={payoutHash}
                      onChange={(e) => setPayoutHash(e.target.value)}
                      className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="0x..."
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-subtext">Amount</span>
                    <input
                      required
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="100"
                    />
                  </label>
                  {payoutMsg ? <div className="rounded-2xl bg-card p-4 text-sm text-subtext ring-1 ring-ring">{payoutMsg}</div> : null}
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90 w-full"
                  >
                    Verify + Payout
                  </button>
                </form>
              </div>
            ) : null}

            {active === "settings" || active === "levels" ? (
              <div className="w-full max-w-full overflow-hidden rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
                <div className="text-sm font-semibold">Level Percentages (1–20)</div>
                <div className="mt-2 text-sm text-subtext">Update commission settings</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {levels.map((v, idx) => (
                    <label key={idx} className="grid gap-2">
                      <span className="text-xs font-medium text-subtext">Level {idx + 1}</span>
                      <input
                        value={String(v)}
                        onChange={(e) => {
                          const next = [...levels];
                          next[idx] = Number(e.target.value);
                          setLevels(next);
                        }}
                        className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="0"
                      />
                    </label>
                  ))}
                </div>
                {levelsMsg ? <div className="mt-4 rounded-2xl bg-card p-4 text-sm text-subtext ring-1 ring-ring">{levelsMsg}</div> : null}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setActive("levels")}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-card px-5 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-background w-full"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setLevelsMsg("");
                      try {
                        const res = await fetch("/api/admin/settings", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ levelPercentages: levels }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setLevelsMsg(typeof data?.error === "string" ? data.error : "Save failed");
                          return;
                        }
                        setLevelsMsg("Saved");
                      } catch {
                        setLevelsMsg("Save failed");
                      }
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90 w-full"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : null}

            {active === "withdrawals" ? (
                <div className="w-full max-w-full overflow-hidden rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Pending Withdrawals</div>
                      <div className="mt-1 text-sm text-subtext">Approve or reject requests</div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/admin/withdrawals", { cache: "no-store" });
                          const data = await res.json();
                          if (res.ok) setPendingWithdrawals(data.items || []);
                        } catch {}
                      }}
                      className="inline-flex items-center justify-center rounded-full bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-muted"
                    >
                      Refresh
                    </button>
                  </div>
                  {withdrawMsg ? <div className="mt-3 rounded-2xl bg-card p-4 text-sm text-subtext ring-1 ring-ring">{withdrawMsg}</div> : null}
                  <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-ring">
                    <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 bg-muted px-4 py-3 text-xs font-medium text-subtext">
                      <div>User</div>
                      <div>Amount</div>
                      <div>Address</div>
                      <div>Action</div>
                    </div>
                    <div className="divide-y divide-[color:var(--ring)]">
                      {pendingWithdrawals.map((w) => (
                        <div key={w.id} className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 px-4 py-4 text-sm">
                          <div className="text-foreground">
                            <div className="font-medium">{w.user?.username ?? w.userId}</div>
                            <div className="text-xs text-subtext">{w.user?.email ?? "-"}</div>
                          </div>
                          <div className="text-foreground">{String(w.amount)}</div>
                          <div className="text-subtext">{w.address}</div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                setWithdrawMsg("");
                                const txHash = prompt("Enter payout tx hash (BSC)") || "";
                                if (!txHash) return;
                                try {
                                  const res = await fetch("/api/admin/withdrawals", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: w.id, action: "approve", txHash }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok) {
                                    setWithdrawMsg(typeof data?.error === "string" ? data.error : "Approve failed");
                                    toast.error(typeof data?.error === "string" ? data.error : "Approve failed");
                                    return;
                                  }
                                  setWithdrawMsg("Withdrawal approved");
                                  toast.success("Withdrawal approved");
                                  setPendingWithdrawals((prev) => prev.filter((x) => x.id !== w.id));
                                } catch {
                                  setWithdrawMsg("Approve failed");
                                  toast.error("Approve failed");
                                }
                              }}
                              className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-1 text-xs text-white ring-1 ring-primary/20"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setWithdrawMsg("");
                                try {
                                  const res = await fetch("/api/admin/withdrawals", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: w.id, action: "reject" }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok) {
                                    setWithdrawMsg(typeof data?.error === "string" ? data.error : "Reject failed");
                                    toast.error(typeof data?.error === "string" ? data.error : "Reject failed");
                                    return;
                                  }
                                  setWithdrawMsg("Withdrawal rejected");
                                  toast.success("Withdrawal rejected");
                                  setPendingWithdrawals((prev) => prev.filter((x) => x.id !== w.id));
                                } catch {
                                  setWithdrawMsg("Reject failed");
                                  toast.error("Reject failed");
                                }
                              }}
                              className="inline-flex items-center justify-center rounded-full bg-card px-3 py-1 text-xs text-foreground ring-1 ring-ring"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

            {active === "deposits" ? (
                <div className="w-full max-w-full overflow-hidden rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Deposits</div>
                      <div className="mt-1 text-sm text-subtext">Latest deposit records</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={depositStatus}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setDepositStatus(val);
                          try {
                            const q = val === "all" ? "" : `?status=${encodeURIComponent(val)}`;
                            const res = await fetch(`/api/admin/deposits${q}`, { cache: "no-store" });
                            const data = await res.json();
                            if (res.ok) setDeposits(data.items || []);
                          } catch {}
                        }}
                        className="h-10 rounded-2xl bg-background px-3 text-sm text-foreground ring-1 ring-ring"
                      >
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const q = depositStatus === "all" ? "" : `?status=${encodeURIComponent(depositStatus)}`;
                            const res = await fetch(`/api/admin/deposits${q}`, { cache: "no-store" });
                            const data = await res.json();
                            if (res.ok) setDeposits(data.items || []);
                          } catch {}
                        }}
                        className="inline-flex items-center justify-center rounded-full bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-muted"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                  <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-ring">
                    <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] gap-2 bg-muted px-4 py-3 text-xs font-medium text-subtext">
                      <div>Hash</div>
                      <div>User</div>
                      <div>Amount</div>
                      <div>Status</div>
                    </div>
                    <div className="divide-y divide-[color:var(--ring)]">
                      {deposits.map((d) => (
                        <div key={d.id} className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] gap-2 px-4 py-4 text-sm">
                          <div className="truncate">{d.txHash}</div>
                          <div className="truncate">{d.user?.username ?? d.userId}</div>
                          <div className="font-medium text-foreground">{String(d.amount)}</div>
                          <div className={`text-xs`}>
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                                d.status === "confirmed"
                                  ? "bg-[rgba(16,185,129,0.10)] text-foreground ring-[rgba(16,185,129,0.35)]"
                                  : d.status === "pending"
                                  ? "bg-[rgba(255,193,7,0.10)] text-foreground ring-[rgba(255,193,7,0.35)]"
                                  : "bg-[rgba(239,68,68,0.10)] text-foreground ring-[rgba(239,68,68,0.35)]"
                              }`}
                            >
                              {d.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {deposits.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-subtext">No deposits</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

            {active === "overview" && adminTreeNodes ? (
              <div className="w-full max-w-full overflow-hidden rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Admin Tree</div>
                  <div className="mt-1 text-sm text-subtext">Company root with full downline (L1-33 · payouts L1-20)</div>
                  </div>
                  <div className="text-xs text-subtext">{adminTreeNodes.length} nodes</div>
                </div>
                <div className="mt-6 max-h-[380px] overflow-auto rounded-2xl ring-1 ring-ring">
                  <div className="divide-y divide-[color:var(--ring)]">
                    {adminTreeNodes.slice(0, 200).map((n: any) => (
                      <div key={n.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <div className="truncate">
                          <div className="font-medium text-foreground">{n.username}</div>
                          <div className="text-xs text-subtext">L{n.depth} · {n.referrerCode}</div>
                        </div>
                        <div className="text-xs text-subtext">{n.email}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6">
                  <div className="text-sm font-semibold">Admin Network Tree</div>
                  <div className="mt-2 text-sm text-subtext">Visual network graph</div>
                  <NetworkTreeAdmin nodes={adminTreeNodes} origin={origin} onCopyMessage={setAdminUiMsg} />
                  {adminUiMsg ? (
                    <div className="mt-4 rounded-2xl bg-muted p-4 text-xs text-subtext ring-1 ring-ring">{adminUiMsg}</div>
                  ) : null}
                </div>
                </div>
            ) : null}
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

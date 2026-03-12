"use client";
import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const [level, setLevel] = useState<number>(3);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authMessage, setAuthMessage] = useState<string>("");
  const [showGrid, setShowGrid] = useState(false);
  const maxLevel = 20;
  const newAtLevel = (n: number) => Math.pow(2, n - 1);
  const totalAtLevel = (n: number) => Math.pow(2, n) - 1;
  const visibleNodes = useMemo(() => Math.min(totalAtLevel(level), 256), [level]);
  const gridCols = useMemo(() => Math.max(2, Math.floor(Math.sqrt(visibleNodes))), [visibleNodes]);
  const maxTotal = totalAtLevel(maxLevel);
  const pctOfMax = useMemo(() => Math.round((totalAtLevel(level) / maxTotal) * 100), [level, maxTotal]);
  const [vw, setVw] = useState(1024);
  useEffect(() => {
    const set = () => setVw(window.innerWidth || 1024);
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);
  const maxColsByBreakpoint = vw >= 1536 ? 10 : vw >= 1280 ? 8 : vw >= 1024 ? 6 : vw >= 768 ? 4 : vw >= 640 ? 3 : 2;
  const gridColsResponsive = Math.min(maxColsByBreakpoint, Math.max(2, Math.floor(Math.sqrt(visibleNodes))));
  const testimonialsData = [
    { initials: "AK", name: "Ali Khan", city: "Karachi", text: "UI simple aur fast hai. Binary preview se growth samajh aati hai." },
    { initials: "MS", name: "Mehak Shah", city: "Lahore", text: "Light theme readable hai. Forms clean aur minimal hain." },
    { initials: "HF", name: "Haris Farooq", city: "Islamabad", text: "Responsive grid acchi lagti hai; mobile par bhi smooth." },
  ];
  const [tIndex, setTIndex] = useState(0);
  const faqsData = [
    { q: "Binary structure kya hota hai?", a: "Har user 2 log add karta hai. Levels grow hotay hain: L1=1, L2=3, L3=7, waghera." },
    { q: "Kitne levels tak expand hoga?", a: "UI 20 levels tak preview dikhata hai." },
    { q: "Account kaise banega?", a: "Login/Sign Up button se modal khulta hai; form submit se account flow start hoga." },
    { q: "Real payouts implement hain?", a: "Currently UI preview hai; payouts/APIs connect kar sakte hain next step me." },
    { q: "Mobile par kaise dikhayega?", a: "Responsive grid use hoti hai; choti screens par fewer columns dikhte hain." },
  ];
  const [openFaqs, setOpenFaqs] = useState<number[]>([]);
  const toggleFaq = (i: number) =>
    setOpenFaqs((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  useEffect(() => {
    if (!authOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [authOpen]);

  useEffect(() => {
    if (!authOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAuthOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authOpen]);

  const openLogin = () => {
    setAuthMessage("");
    setAuthMode("login");
    setAuthOpen(true);
  };

  const openSignup = () => {
    setAuthMessage("");
    setAuthMode("signup");
    setAuthOpen(true);
  };

  return (
    <div className="min-h-screen bg-transparent font-sans text-foreground selection:bg-primary selection:text-white">
      <section className="relative isolate overflow-hidden">
        <div className="relative mx-auto max-w-7xl px-6 pt-12 pb-12 sm:pt-14 sm:pb-16">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-card/80 px-4 py-2 ring-1 ring-ring backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_rgba(255,106,0,0.35)]" />
              <span className="text-xs tracking-wide text-accent">MLM Binary · 20 Levels</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-muted"
              >
                User Panel
              </a>
              <a
                href="/admin"
                className="inline-flex items-center justify-center rounded-full bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-muted"
              >
                Admin Panel
              </a>
              <button
                type="button"
                onClick={openLogin}
                className="inline-flex items-center justify-center rounded-full bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-muted"
              >
                Login
              </button>
              <button
                type="button"
                onClick={openSignup}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
              >
                Sign Up
              </button>
            </div>
          </div>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              <h1 className="max-w-4xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Clean, modern MLM landing with Electric Orange accents.
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-subtext">
                Har user sirf 2 log add kar sakta hai. Binary structure 20 levels tak.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90" href="#levels">
                  Get Started
                </a>
                <a className="inline-flex items-center justify-center rounded-full bg-card px-6 py-3 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-muted" href="#how-it-works">
                  Learn More
                </a>
              </div>
              <div className="mt-10 grid gap-6 sm:grid-cols-4">
                <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ring">
                  <div className="text-xs text-subtext">Directs</div>
                  <div className="mt-2 text-2xl font-semibold">2</div>
                </div>
                <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ring">
                  <div className="text-xs text-subtext">Levels</div>
                  <div className="mt-2 text-2xl font-semibold">20</div>
                </div>
                <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ring">
                  <div className="text-xs text-subtext">Growth</div>
                  <div className="mt-2 text-2xl font-semibold">1 → 2</div>
                </div>
                <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ring">
                  <div className="text-xs text-subtext">Mode</div>
                  <div className="mt-2 text-2xl font-semibold">UI Only</div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring">
              <div className="text-sm text-subtext">Today’s Snapshot</div>
              <div className="mt-2 text-2xl font-semibold">Binary Growth Preview</div>
              <div className="mt-6 grid gap-4">
                <div className="flex items-center justify-between rounded-2xl bg-muted p-4 ring-1 ring-ring">
                  <span className="text-sm text-subtext">Direct Invites</span>
                  <span className="text-lg font-semibold text-foreground">2</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted p-4 ring-1 ring-ring">
                  <span className="text-sm text-subtext">Max Depth</span>
                  <span className="text-lg font-semibold text-foreground">20 Levels</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted p-4 ring-1 ring-ring">
                  <span className="text-sm text-subtext">Primary Tone</span>
                  <span className="text-lg font-semibold text-foreground">Electric Orange</span>
                </div>
              </div>
              <div className="mt-6 rounded-2xl bg-muted p-4 ring-1 ring-ring">
                <div className="text-xs uppercase text-subtext">Theme</div>
                <div className="mt-2 text-2xl font-semibold">Blackberry Contrast</div>
                <div className="mt-3 text-sm text-subtext">Sharp, modern, fintech‑grade surfaces.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="levels" className="mx-auto max-w-7xl px-6 pb-24 mt-16 sm:mt-24">
        <div className="rounded-3xl bg-muted p-6 ring-1 ring-ring sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Level Explorer</h2>
              <p className="mt-1 text-sm text-subtext">Binary growth preview.</p>
            </div>
            <div className="flex w-full max-w-md items-center gap-4">
              <input
                type="range"
                min={1}
                max={maxLevel}
                value={level}
                onChange={(e) => {
                  setLevel(parseInt(e.target.value, 10));
                  setShowGrid(true);
                }}
                onMouseDown={() => setShowGrid(true)}
                onTouchStart={() => setShowGrid(true)}
                className="w-full accent-primary"
              />
              <div className="flex w-20 items-center justify-center rounded-md bg-card px-3 py-2 text-sm ring-1 ring-ring">
                L{level}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-ring">
              <div className="text-sm text-subtext">Total nodes at L{level}</div>
              <div className="mt-1 text-2xl font-semibold">{totalAtLevel(level).toLocaleString()}</div>
            </div>
            <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-ring">
              <div className="text-sm text-subtext">New nodes on L{level}</div>
              <div className="mt-1 text-2xl font-semibold">{newAtLevel(level).toLocaleString()}</div>
            </div>
            <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-ring">
              <div className="text-sm text-subtext">% of L{maxLevel}</div>
              <div className="mt-1 text-2xl font-semibold">{pctOfMax}%</div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-card p-5 ring-1 ring-ring">
            {showGrid ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-subtext">Visual Preview</div>
                  <div className="text-xs text-subtext">Showing total {visibleNodes.toLocaleString()} nodes up to L{level}</div>
                </div>
                <div
                  className="mt-5 grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${gridColsResponsive}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: visibleNodes }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-full bg-primary/15 ring-1 ring-ring transition hover:bg-primary"
                      title={`Node ${i + 1}`}
                    />
                  ))}
                </div>
                <div className="mt-6 h-3 w-full rounded-full bg-muted ring-1 ring-ring">
                  <div className="h-3 rounded-full bg-primary" style={{ width: `${Math.min(100, pctOfMax)}%` }} />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-muted p-8 text-center ring-1 ring-ring">
                <div className="text-sm text-subtext">Move the slider to preview levels</div>
                <button
                  type="button"
                  onClick={() => setShowGrid(true)}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
                >
                  Show Preview
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 pb-24">
        <div className="rounded-3xl bg-muted p-6 ring-1 ring-ring sm:p-8">
          <h2 className="text-2xl font-semibold">How It Works</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-ring">
              <div className="text-sm text-subtext">Binary Join</div>
              <div className="mt-1 text-lg">Har user 2 log add karega</div>
            </div>
            <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-ring">
              <div className="text-sm text-subtext">Levels</div>
              <div className="mt-1 text-lg">20 tak structure expand hoga</div>
            </div>
            <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-ring">
              <div className="text-sm text-subtext">Accounts</div>
              <div className="mt-1 text-lg">Login / Signup se user account banay</div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90" href="#levels">
              Explore Levels
            </a>
            <a className="inline-flex items-center justify-center rounded-full bg-card px-6 py-3 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-background" href="#">
              Contact
            </a>
          </div>
        </div>
      </section>

      <section id="faqs" className="mx-auto max-w-7xl px-6 pb-24">
        <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
          <h2 className="text-2xl font-semibold">FAQs</h2>
          <div className="mt-6">
            {faqsData.map((item, i) => {
              const open = openFaqs.includes(i);
              return (
                <div key={i} className="rounded-2xl bg-muted ring-1 ring-ring mb-4">
                  <button
                    type="button"
                    onClick={() => toggleFaq(i)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                    aria-expanded={open}
                  >
                    <span className="text-base font-medium text-foreground">{item.q}</span>
                    <span className="rounded-full bg-card px-3 py-1 text-sm text-subtext ring-1 ring-ring">
                      {open ? "Hide" : "Show"}
                    </span>
                  </button>
                  <div
                    className={`px-5 transition-[max-height,opacity] duration-300 ease-out ${open ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}
                  >
                    <div className="pb-4 text-sm text-subtext">{item.a}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="testimonials" className="mx-auto max-w-7xl px-6 pb-24">
        <div className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-ring sm:p-8">
          <h2 className="text-2xl font-semibold">Testimonials</h2>
          <div className="mt-6 relative overflow-hidden rounded-2xl bg-muted ring-1 ring-ring">
            <div
              className="flex w-full transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${tIndex * 100}%)` }}
            >
              {testimonialsData.map((t, i) => (
                <div key={i} className="w-full shrink-0 p-6 sm:px-14">
                  <div className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-ring">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                        {t.initials}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{t.name}</div>
                        <div className="text-xs text-subtext">{t.city}</div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-subtext">{t.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-2">
              {testimonialsData.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTIndex(i)}
                  className={`h-2 w-2 rounded-full ${tIndex === i ? "bg-primary" : "bg-ring"}`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
            <div className="absolute inset-y-0 left-0 flex items-center">
              <button
                type="button"
                onClick={() => setTIndex((idx) => (idx - 1 + testimonialsData.length) % testimonialsData.length)}
                className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground ring-1 ring-ring transition hover:bg-background"
                aria-label="Previous"
              >
                ‹
              </button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <button
                type="button"
                onClick={() => setTIndex((idx) => (idx + 1) % testimonialsData.length)}
                className="mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground ring-1 ring-ring transition hover:bg-background"
                aria-label="Next"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-6 pb-12">
        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl bg-muted p-6 text-sm text-subtext ring-1 ring-ring sm:flex-row">
          <div>© {new Date().getFullYear()} MLM Marketing</div>
          <div className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary shadow-[0_0_10px_rgba(255,106,0,0.35)]" />
            <span>Electric Orange accent theme</span>
          </div>
        </div>
      </footer>

      {authOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label={authMode === "login" ? "Login" : "Sign up"}
        >
          <button
            type="button"
            onClick={() => setAuthOpen(false)}
            className="absolute inset-0 bg-black/30"
            aria-label="Close"
          />
          <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-xl ring-1 ring-ring">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold">{authMode === "login" ? "Login" : "Create Account"}</div>
                <div className="mt-1 text-sm text-subtext">
                  {authMode === "login" ? "Apna account access karein." : "Naya account banayein."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground ring-1 ring-ring transition hover:bg-secondary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1 ring-1 ring-ring">
              <button
                type="button"
                onClick={() => {
                  setAuthMessage("");
                  setAuthMode("login");
                }}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${authMode === "login" ? "bg-card text-foreground shadow-sm" : "text-subtext hover:text-foreground"}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMessage("");
                  setAuthMode("signup");
                }}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${authMode === "signup" ? "bg-card text-foreground shadow-sm" : "text-subtext hover:text-foreground"}`}
              >
                Sign Up
              </button>
            </div>

            <form
              className="mt-6 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                setAuthMessage(authMode === "login" ? "Login UI ready (backend connect pending)." : "Signup UI ready (backend connect pending).");
              }}
            >
              {authMode === "signup" ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Full name</span>
                  <input
                    required
                    type="text"
                    className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Your name"
                  />
                </label>
              ) : null}

              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Email</span>
                <input
                  required
                  type="email"
                  className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="name@email.com"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Password</span>
                <input
                  required
                  type="password"
                  className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="••••••••"
                />
              </label>

              {authMode === "signup" ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Confirm password</span>
                  <input
                    required
                    type="password"
                    className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="••••••••"
                  />
                </label>
              ) : null}

              {authMessage ? (
                <div className="rounded-2xl bg-muted p-4 text-sm text-subtext ring-1 ring-ring">{authMessage}</div>
              ) : null}

              <button
                type="submit"
                className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
              >
                {authMode === "login" ? "Login" : "Create account"}
              </button>

              <div className="text-center text-sm text-subtext">
                {authMode === "login" ? (
                  <button type="button" onClick={openSignup} className="font-medium text-foreground underline underline-offset-4">
                    New here? Create an account
                  </button>
                ) : (
                  <button type="button" onClick={openLogin} className="font-medium text-foreground underline underline-offset-4">
                    Already have an account? Login
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

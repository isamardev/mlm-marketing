"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { FaUser } from "react-icons/fa";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";

const BLOCKED_MESSAGE = "You are blocked by admin. Contact customer support for help.";
const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRefParam = Boolean((searchParams.get("ref") ?? "").trim());
  const { data: session } = useSession();
  const [level, setLevel] = useState<number>(3);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login");
  const [authMessage, setAuthMessage] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(false);
  const [signupStep, setSignupStep] = useState<"form" | "otp">("form");
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "reset">("email");
  const [forgotDevOtp, setForgotDevOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const [referrerCode, setReferrerCode] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [referrerLookupLoading, setReferrerLookupLoading] = useState(false);
  const [referrerLookupMessage, setReferrerLookupMessage] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showGrid, setShowGrid] = useState(false);
  const blockedNoticeHandledRef = useRef(false);
  const maxLevel = 33;
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
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(""), 2200);
    return () => clearTimeout(t);
  }, [toastMessage]);
  const maxColsByBreakpoint = vw >= 1536 ? 10 : vw >= 1280 ? 8 : vw >= 1024 ? 6 : vw >= 768 ? 4 : vw >= 640 ? 3 : 2;
  const gridColsResponsive = Math.min(maxColsByBreakpoint, Math.max(2, Math.floor(Math.sqrt(visibleNodes))));
  const testimonialsData = [
    { initials: "AK", name: "Ali Khan", city: "Karachi", text: "The UI is simple and fast. The binary preview explains growth clearly." },
    { initials: "MS", name: "Mehak Shah", city: "Lahore", text: "Light theme is readable. Forms are clean and minimal." },
    { initials: "HF", name: "Haris Farooq", city: "Islamabad", text: "Responsive grid looks great; smooth on mobile too." },
  ];
  const [tIndex, setTIndex] = useState(0);
  const faqsData = [
    { q: "What is a binary structure?", a: "Each user adds two members. Levels grow like: L1=1, L2=3, L3=7, and so on." },
    { q: "How many levels are supported?", a: "The UI preview supports up to 33 levels." },
    { q: "Do payouts cover all 33 levels?", a: "No. Payouts are limited to the first 20 levels. Levels beyond 20 are visual only." },
    { q: "How do I create an account?", a: "Use the Login/Sign Up button; submit the form to start the flow." },
    { q: "Are real payouts implemented?", a: "This is a UI preview; payouts/APIs can be connected next." },
    { q: "How does it look on mobile?", a: "Responsive grid adapts; fewer columns show on smaller screens." },
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
    const ref = (searchParams.get("ref") ?? "").trim();
    if (ref) {
      setReferrerCode(ref.toUpperCase());
      return;
    }
    setReferrerCode("");
    setReferrerName("");
    setReferrerLookupMessage("");
  }, [searchParams]);

  useEffect(() => {
    if (authMode !== "signup" || !hasRefParam) return;
    const code = referrerCode.trim().toUpperCase();
    if (!code) {
      setReferrerName("");
      setReferrerLookupMessage("");
      setReferrerLookupLoading(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setReferrerLookupLoading(true);
      setReferrerLookupMessage("");
      try {
        const res = await fetch(`/api/auth/register?referrerCode=${encodeURIComponent(code)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as any;
        if (!res.ok) {
          setReferrerName("");
          setReferrerLookupMessage(typeof data?.error === "string" ? data.error : "Referrer not found");
          return;
        }
        setReferrerName(typeof data?.fullName === "string" ? data.fullName : "");
      } catch {
        setReferrerName("");
        setReferrerLookupMessage("Referrer lookup failed");
      } finally {
        setReferrerLookupLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [authMode, hasRefParam, referrerCode]);

  useEffect(() => {
    const blocked = (searchParams.get("blocked") ?? "").trim();
    if (blocked !== "1") {
      blockedNoticeHandledRef.current = false;
      return;
    }
    if (blockedNoticeHandledRef.current) return;
    blockedNoticeHandledRef.current = true;
    setAuthMode("login");
    setAuthOpen(true);
    setAuthMessage(BLOCKED_MESSAGE);
  }, [searchParams]);

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
    setSignupStep("form");
    setOtpCode("");
    setAuthOpen(true);
  };

  const openSignup = () => {
    setAuthMessage("");
    setAuthMode("signup");
    setSignupStep("form");
    setOtpCode("");
    setAuthOpen(true);
  };

  const isSignupForm = authMode === "signup" && signupStep === "form";

  return (
    <div className="min-h-screen bg-transparent font-sans text-foreground selection:bg-primary selection:text-white">
      <section className="relative isolate overflow-hidden">
        <div className="relative mx-auto max-w-7xl px-6 pt-12 pb-12 sm:pt-14 sm:pb-16">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Logo" className="h-9 w-auto rounded-md ring-1 ring-ring" />
              <div className="inline-flex items-center gap-2 rounded-full bg-card/80 px-4 py-2 ring-1 ring-ring backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_rgba(0,201,255,0.35)]" />
                <span className="text-xs tracking-wide text-accent">Connecting People & Ideas</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {session?.user ? (
                <>
                  <button
                    type="button"
                    onClick={() => router.push(session.user.status === "admin" ? "/admin" : "/dashboard")}
                    className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
                  >
                    Open Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="inline-flex items-center justify-center rounded-full bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-ring transition hover:bg-muted"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              <h1 className="max-w-4xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Clean, modern MLM landing with Electric Orange accents.
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-subtext">
                Each user can invite two members. The binary structure visualizes up to 33 levels; payouts are limited to the first 20 levels.
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
                  <span className="text-lg font-semibold text-foreground">33 Levels</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted p-4 ring-1 ring-ring">
                  <span className="text-sm text-subtext">Primary Tone</span>
                  <span className="text-lg font-semibold text-foreground">Teal</span>
                </div>
              </div>
              <div className="mt-6 rounded-2xl bg-muted p-4 ring-1 ring-ring">
                <div className="text-xs uppercase text-subtext">Theme</div>
                <div className="mt-2 text-2xl font-semibold">Blackberry Contrast</div>
                <div className="mt-3 text-sm text-subtext">Sharp, modern, fintech-grade surfaces.</div>
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
                  <div className="text-xs text-subtext">Showing up to L{level}</div>
                </div>
                <div className="mt-5 max-h-[600px] overflow-y-auto">
                  <TreePreview depth={level} />
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
              <div className="mt-1 text-lg">Each user invites two members</div>
            </div>
            <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-ring">
              <div className="text-sm text-subtext">Levels</div>
              <div className="mt-1 text-lg">Structure expands up to 33 levels</div>
            </div>
            <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-ring">
              <div className="text-sm text-subtext">Accounts</div>
              <div className="mt-1 text-lg">Create your account via Login / Sign Up</div>
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
            <span className="h-3 w-3 rounded-full bg-primary shadow-[0_0_10px_rgba(0,178,163,0.35)]" />
            <span>Teal accent theme</span>
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
          {toastMessage ? (
            <div className="fixed right-6 top-6 z-50 rounded-2xl bg-card px-4 py-3 text-sm font-medium text-foreground shadow-lg ring-1 ring-ring">
              {toastMessage}
            </div>
          ) : null}
          <div className={`relative w-full rounded-3xl bg-card p-6 shadow-xl ring-1 ring-ring ${isSignupForm ? "max-w-2xl max-h-[90vh] overflow-y-auto" : "max-w-md"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold">
                  {authMode === "login" ? "Login" : 
                   authMode === "signup" ? "Create Account" : 
                   "Reset Password"}
                </div>
                <div className="mt-1 text-sm text-subtext">
                  {authMode === "login" ? "Access your account." : 
                   authMode === "signup" ? "Create a new account." : 
                   "Reset your password."}
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
                  setSignupStep("form");
                  setForgotStep("email");
                  setOtpCode("");
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
                  setSignupStep("form");
                  setForgotStep("email");
                  setOtpCode("");
                }}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${authMode === "signup" ? "bg-card text-foreground shadow-sm" : "text-subtext hover:text-foreground"}`}
              >
                Sign Up
              </button>
            </div>

            <form
              className="mt-6 grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (authLoading) return;
                setAuthMessage("");
                setAuthLoading(true);
                try {
                  if (authMode === "login") {
                    const result = await signIn("credentials", {
                      email,
                      password,
                      redirect: false,
                    });
                    if (result?.error) {
                      try {
                        const statusRes = await fetch("/api/auth/account-status", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email }),
                        });
                        const statusData = (await statusRes.json()) as any;
                        if (statusData?.status === "blocked") {
                          setAuthMessage(typeof statusData?.message === "string" ? statusData.message : BLOCKED_MESSAGE);
                          return;
                        }
                      } catch {}
                      setAuthMessage("Invalid credentials");
                      return;
                    }
                    setAuthOpen(false);
                    router.push("/dashboard");
                    return;
                  }

                  if (authMode === "forgot") {
                    if (forgotStep === "email") {
                      const otpRes = await fetch("/api/user/request-otp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, purpose: "password_reset" }),
                      });
                      const otpData = (await otpRes.json()) as any;
                      if (!otpRes.ok) {
                        setAuthMessage(typeof otpData?.error === "string" ? otpData.error : "OTP request failed");
                        return;
                      }
                      setForgotStep("otp");
                      setForgotDevOtp(otpData?.devOtp ?? "");
                      setAuthMessage("OTP sent to your email. Please enter the code.");
                      return;
                    }

                    if (forgotStep === "otp") {
                      const verifyRes = await fetch("/api/user/verify-otp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, purpose: "password_reset", code: otpCode }),
                      });
                      const verifyData = (await verifyRes.json()) as any;
                      if (!verifyRes.ok) {
                        setAuthMessage(typeof verifyData?.error === "string" ? verifyData.error : "OTP verification failed");
                        return;
                      }
                      setForgotStep("reset");
                      setAuthMessage("OTP verified. Please enter your new password.");
                      return;
                    }

                    if (forgotStep === "reset") {
                      if (newPassword !== confirmNewPassword) {
                        setAuthMessage("New passwords do not match");
                        return;
                      }
                      const resetRes = await fetch("/api/user/reset-password", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, newPassword, code: otpCode }),
                      });
                      const resetData = (await resetRes.json()) as any;
                      if (!resetRes.ok) {
                        setAuthMessage(typeof resetData?.error === "string" ? resetData.error : "Password reset failed");
                        return;
                      }
                      setToastMessage("Password updated");
                      toast.success("Password updated");
                      setAuthMessage("Password reset successfully. You can now login with your new password.");
                      setAuthMode("login");
                      setForgotStep("email");
                      setForgotDevOtp("");
                      setNewPassword("");
                      setConfirmNewPassword("");
                      setOtpCode("");
                      return;
                    }
                  }

                  if (authMode === "signup") {
                    if (signupStep === "form") {
                      if (password !== confirmPassword) {
                        setAuthMessage("Passwords do not match");
                        return;
                      }
                      if (!acceptedTerms) {
                        setAuthMessage("Please agree to the terms and conditions");
                        return;
                      }
                      if (hasRefParam && referrerCode.trim() && !referrerName.trim()) {
                        setAuthMessage("Please enter a valid referral code");
                        return;
                      }
                      const res = await fetch("/api/auth/register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          fullName,
                          country,
                          email,
                          password,
                          referrerCode: hasRefParam && referrerCode.trim() ? referrerCode.trim().toUpperCase() : undefined,
                          acceptedTerms,
                        }),
                      });
                      const data = (await res.json()) as any;
                      if (!res.ok) {
                        setAuthMessage(typeof data?.error === "string" ? data.error : "Signup failed");
                        return;
                      }
                      const otpRes = await fetch("/api/user/request-otp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, purpose: "registration" }),
                      });
                      const otpData = (await otpRes.json()) as any;
                      setSignupStep("otp");
                      setAuthMessage("OTP sent to your email. Please enter the code.");
                      return;
                    }

                    const verifyRes = await fetch("/api/user/verify-otp", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email, purpose: "registration", code: otpCode }),
                    });
                    const verifyData = (await verifyRes.json()) as any;
                    if (!verifyRes.ok) {
                      setAuthMessage(typeof verifyData?.error === "string" ? verifyData.error : "OTP verification failed");
                      return;
                    }
                    const result = await signIn("credentials", { email, password, redirect: false });
                    if (result?.error) {
                      setAuthMessage("Account created, but login failed");
                      return;
                    }
                    setAuthOpen(false);
                    router.push("/dashboard");
                  }
                } finally {
                  setAuthLoading(false);
                }
              }}
            >
              {isSignupForm ? (
                <>
                  {hasRefParam ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-foreground">Referral code</span>
                          <input
                            type="text"
                            value={referrerCode}
                            readOnly
                            className="h-11 w-full rounded-2xl bg-background px-4 text-sm uppercase text-foreground ring-1 ring-ring outline-none"
                            placeholder="SAMAR786"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-foreground">Referral name</span>
                          <input
                            type="text"
                            value={referrerLookupLoading ? "Loading..." : referrerName}
                            readOnly
                            className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none"
                            placeholder="Referral name"
                          />
                        </label>
                      </div>
                      {referrerLookupMessage ? <div className="text-xs text-red-500">{referrerLookupMessage}</div> : null}
                    </>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-foreground">Full name</span>
                      <input
                        required
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Your full name"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-foreground">Email address</span>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="name@email.com"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">Country</span>
                    <select
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map((countryName) => (
                        <option key={countryName} value={countryName}>
                          {countryName}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}

              {(authMode === "login" || (authMode === "forgot" && forgotStep === "email")) ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Email</span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="name@email.com"
                  />
                </label>
              ) : null}

              {(authMode === "login" || isSignupForm) ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Password</span>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="••••••••"
                  />
                </label>
              ) : null}

              {isSignupForm ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">Confirm password</span>
                  <input
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="••••••••"
                  />
                </label>
              ) : null}

              {isSignupForm ? (
                <label className="flex items-start gap-3 rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-ring"
                  />
                  <span>I agree to the terms and conditions</span>
                </label>
              ) : null}

              {((authMode === "signup" && signupStep === "otp") || (authMode === "forgot" && forgotStep === "otp")) ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">OTP Code</span>
                  <input
                    required
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="123456"
                  />
                </label>
              ) : null}
              {authMode === "forgot" && forgotStep === "otp" && forgotDevOtp ? (
                <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                  Demo OTP: {forgotDevOtp}
                </div>
              ) : null}

              {authMode === "forgot" && forgotStep === "reset" ? (
                <>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">New Password</span>
                    <input
                      required
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="••••••••"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">Confirm New Password</span>
                    <input
                      required
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="••••••••"
                    />
                  </label>
                </>
              ) : null}

              {authMessage ? (
                <div className="rounded-2xl bg-muted p-4 text-sm text-subtext ring-1 ring-ring">{authMessage}</div>
              ) : null}

              <button
                type="submit"
                disabled={authLoading}
                className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90 disabled:opacity-60"
              >
                {authMode === "login" ? "Login" : 
                 authMode === "signup" ? (signupStep === "form" ? "Create an account" : "Verify OTP") : 
                 forgotStep === "email" ? "Next" :
                 forgotStep === "otp" ? "Verify OTP" : "Update Password"}
              </button>

              <div className="text-center text-sm text-subtext">
                {authMode === "login" ? (
                  <>
                    <button type="button" onClick={openSignup} className="font-medium text-foreground underline underline-offset-4">
                      New here? Create an account
                    </button>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMessage("");
                          setAuthMode("forgot");
                          setForgotStep("email");
                          setForgotDevOtp("");
                          setOtpCode("");
                          setNewPassword("");
                          setConfirmNewPassword("");
                        }}
                        className="font-medium text-foreground underline underline-offset-4"
                      >
                        Forgot your password?
                      </button>
                    </div>
                  </>
                ) : authMode === "signup" ? (
                  <button type="button" onClick={openLogin} className="font-medium text-foreground underline underline-offset-4">
                    Already have an account? Login
                  </button>
                ) : (
                  <button type="button" onClick={openLogin} className="font-medium text-foreground underline underline-offset-4">
                    Back to Login
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

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <HomeContent />
    </Suspense>
  );
}

function TreePreview({ depth }: { depth: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.clientWidth || 800);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const visibleDepth = Math.min(depth, 7);
  const rowH = 84;
  const padY = 20;
  const iconSize = 24;
  const rows = useMemo(() => {
    const r: Array<Array<{ x: number; y: number; idx: number }>> = [];
    for (let level = 1; level <= visibleDepth; level += 1) {
      const count = Math.pow(2, level - 1);
      const y = padY + (level - 1) * rowH;
      const pts = Array.from({ length: count }, (_, idx) => ({
        x: Math.round(w * ((idx + 1) / (count + 1))),
        y,
        idx,
      }));
      r.push(pts);
    }
    return r;
  }, [visibleDepth, w]);
  const svgW = w;
  const svgH = padY + visibleDepth * rowH + 20;
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let l = 0; l < rows.length - 1; l += 1) {
    const parents = rows[l];
    const children = rows[l + 1];
    for (let i = 0; i < parents.length; i += 1) {
      const p = parents[i];
      const cL = children[i * 2];
      const cR = children[i * 2 + 1];
      lines.push({ x1: p.x, y1: p.y + iconSize / 2, x2: cL.x, y2: cL.y - iconSize / 2 });
      lines.push({ x1: p.x, y1: p.y + iconSize / 2, x2: cR.x, y2: cR.y - iconSize / 2 });
    }
  }
  return (
    <div ref={ref} className="relative mt-5 w-full">
      <svg width={svgW} height={svgH} className="block" style={{ maxWidth: "100%" }}>
        {lines.map((ln, idx) => (
          <line
            key={idx}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke="var(--ring)"
            strokeWidth={1.5}
          />
        ))}
      </svg>
      <div className="absolute inset-0">
        {rows.flatMap((row, l) =>
          row.map((pt, i) => (
            <div
              key={`n-${l}-${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: pt.x, top: pt.y }}
              title={`L${l + 1} · Node ${i + 1}`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 ring-1 ring-ring">
                <FaUser className="text-foreground" size={16} />
              </div>
            </div>
          )),
        )}
      </div>

      {depth > visibleDepth ? (
        <div className="mt-6 rounded-2xl bg-muted p-4 ring-1 ring-ring">
          <div className="text-xs text-subtext">Deep Levels (L{visibleDepth + 1} to L{depth}) · Compact Binary View</div>
          <div className="mt-3 grid gap-3">
            {Array.from({ length: depth - visibleDepth }, (_, i) => {
              const level = visibleDepth + i + 1;
              const nodes = Math.pow(2, level - 1);
              return (
                <div key={level} className="rounded-xl bg-card px-3 py-3 ring-1 ring-ring">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-foreground">Level {level}</div>
                    <div className="text-xs text-subtext">{nodes.toLocaleString()} nodes</div>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-4">
                    <div className="flex items-center justify-center rounded-full bg-primary/15 p-1.5 ring-1 ring-ring">
                      <FaUser className="text-foreground" size={14} />
                    </div>
                    <div className="h-px w-8 bg-ring" />
                    <div className="flex items-center justify-center rounded-full bg-primary/15 p-1.5 ring-1 ring-ring">
                      <FaUser className="text-foreground" size={14} />
                    </div>
                    <div className="h-px w-8 bg-ring" />
                    <div className="flex items-center justify-center rounded-full bg-primary/15 p-1.5 ring-1 ring-ring">
                      <FaUser className="text-foreground" size={14} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

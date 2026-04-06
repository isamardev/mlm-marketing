"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { markSessionTabActive } from "@/lib/session-tab";

export default function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        markSessionTabActive();
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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl bg-background py-3 pl-4 pr-12 text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Enter admin password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-subtext transition hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <div className="text-red-500 text-sm text-center">{error}</div>}

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

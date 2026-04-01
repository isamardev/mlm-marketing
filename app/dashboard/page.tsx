"use client";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaUser, FaFacebook, FaTwitter, FaInstagram, FaYoutube, FaTelegramPlane, FaWhatsapp, FaCog, FaSignOutAlt, FaUserCircle } from "react-icons/fa";
import DepositButton from "@/components/DepositButton.jsx";
import { toast } from "react-toastify";
import WhatsAppButton from "@/components/WhatsAppButton";
import { RECEIVER_WALLET_ADDRESS, RECEIVER_WALLET_NETWORK, RECEIVER_WALLET_TOKEN } from "@/lib/receiver-wallet";

const COMPANY_ADMIN_EMAIL = "admin@example.com";

const toUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );

function WalletSection({ balance, userId, onHistoryRedirect }: { balance: number, userId: string, onHistoryRedirect?: () => void }) {
  const [depositAmount, setDepositAmount] = useState<string>("10");
  const [step, setStep] = useState<1 | 2>(1);
  const [uiMsg, setUiMsg] = useState<string>("");
  const autoPollRef = useRef<any>(null);

  useEffect(() => {
    if (step !== 2) {
      if (autoPollRef.current) {
        clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
      return;
    }
    const poll = async () => {
      try {
        const res = await fetch(`/api/scan-deposits?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
        const data = await res.json();
        if (res.ok && Number(data?.createdForUser || 0) > 0) {
          toast.success("Payment detected");
          // Refresh full dashboard data
          try {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("deposit:updated"));
            }
          } catch {}
          if (onHistoryRedirect) onHistoryRedirect();
          clearInterval(autoPollRef.current);
          autoPollRef.current = null;
        }
      } catch {
        // silent
      }
    };
    poll();
    autoPollRef.current = setInterval(poll, 15000);
    return () => {
      if (autoPollRef.current) {
        clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
    };
  }, [step, userId, onHistoryRedirect]);

  return (
    <div className="rounded-3xl bg-card p-4 sm:p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)]">
      <div className="grid gap-6 lg:grid-cols-[1fr_0.38fr]">
        {step === 1 ? (
          <div className="w-full">
            <div className="text-lg font-semibold">Deposit Funds</div>
            <div className="mt-1 text-xs text-subtext">Secure gateway payment</div>
            <div className="mt-4 grid gap-3 max-w-full lg:max-w-md">
              <label className="grid gap-1">
                <span className="text-xs text-subtext">Deposit Amount (USDT)</span>
                <input
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="10"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-subtext">Select Network</span>
                <select
                  disabled
                  className="h-10 w-full cursor-not-allowed rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring"
                  value="bep20"
                  onChange={() => {}}
                >
                  <option value="bep20">BEP20 (BSC)</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  const amt = Number(depositAmount);
                  if (!Number.isFinite(amt) || amt < 10) {
                    setUiMsg("Minimum deposit is 10 USDT");
                    toast.error("Minimum deposit is 10 USDT");
                    return;
                  }
                  setUiMsg("");
                  setStep(2);
                }}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-green-600 px-5 text-sm font-medium text-white shadow-sm ring-1 ring-green-600/20 transition hover:bg-green-700"
              >
                Proceed Payment
              </button>
              {uiMsg ? (
                <div className="rounded-2xl bg-muted p-3 text-xs text-subtext ring-1 ring-ring">{uiMsg}</div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="w-full">
            <div className="text-lg font-semibold">Payment Details</div>
            <div className="mt-1 text-xs text-subtext">Send payment to the fixed receiver wallet or use demo payment</div>
            <div className="mt-4 grid gap-3">
              <img
                alt="Deposit QR"
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                  RECEIVER_WALLET_ADDRESS,
                )}&size=180x180&margin=0`}
                className="mx-auto h-[160px] w-[160px] rounded-lg ring-1 ring-ring"
              />
              <div className="grid gap-2">
                <div className="text-xs font-medium text-subtext">Receiver Address</div>
                <div className="flex items-stretch gap-2">
                  <div className="flex-1 break-all rounded-2xl bg-background p-3 text-sm font-mono ring-1 ring-ring">
                    {RECEIVER_WALLET_ADDRESS}
                  </div>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(RECEIVER_WALLET_ADDRESS);
                          toast.success("Address copied");
                        } catch {
                          toast.error("Copy failed");
                        }
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-2xl bg-card px-3 text-xs font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
                      aria-label="Copy address"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-muted p-3 text-xs text-subtext ring-1 ring-ring">
                Real blockchain deposits on {RECEIVER_WALLET_NETWORK} are auto-detected for the matched sender wallet. For testing, use the demo payment button below.
              </div>
              <div className="mt-2">
                <DepositButton
                  amount={Number(depositAmount) || 10}
                  userId={userId}
                  fullWidth
                  label="Pay Demo"
                  onSuccess={onHistoryRedirect}
                />
              </div>
            </div>
          </div>
        )}
        <div className="rounded-2xl bg-muted p-4 ring-1 ring-ring">
          <div className="text-sm font-semibold">Deposit Summary</div>
          <div className="mt-2 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-subtext">Network</span>
              <span className="font-medium">{RECEIVER_WALLET_NETWORK}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-subtext">Amount</span>
              <span className="font-semibold">{Number(depositAmount) || 0} {RECEIVER_WALLET_TOKEN}</span>
            </div>
          </div>
          {step === 2 && (
            <div className="mt-4 rounded-xl bg-card p-3 text-center ring-1 ring-ring">
              <div className="text-xs text-subtext">Please deposit</div>
              <div className="mt-1 text-xl font-bold">{Number(depositAmount)} USDT</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WithdrawSection({ profile }: { profile: any }) {
  const [withdrawAmount, setWithdrawAmount] = useState<string>("10");
  const [withdrawAddress, setWithdrawAddress] = useState<string>(profile?.permanentWithdrawAddress || "");
  const [securityCode, setSecurityCode] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  // Update address if profile changes (e.g. after saving it in settings)
  useEffect(() => {
    if (profile?.permanentWithdrawAddress) {
      setWithdrawAddress(profile.permanentWithdrawAddress);
    }
  }, [profile?.permanentWithdrawAddress]);

  const onWithdraw = async () => {
    setMsg("");
    try {
      const amt = Number(withdrawAmount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setMsg("Invalid amount");
        toast.error("Invalid amount");
        return;
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(withdrawAddress)) {
        setMsg("Invalid USDT address");
        toast.error("Invalid USDT address");
        return;
      }
      if (!securityCode.trim()) {
        setMsg("Security Code is required");
        toast.error("Security Code is required");
        return;
      }
      const res = await fetch("/api/user/withdraw-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, address: withdrawAddress.trim(), securityCode: securityCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(typeof data?.error === "string" ? data.error : "Withdrawal request failed");
        toast.error(typeof data?.error === "string" ? data.error : "Withdrawal request failed");
        return;
      }
      setMsg("Withdrawal requested");
      toast.success("Withdrawal requested");
      setWithdrawAmount("10");
      // Don't clear address if it's permanent
      if (!profile?.permanentWithdrawAddress) {
        setWithdrawAddress("");
      }
      setSecurityCode("");
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("deposit:updated"));
        }
      } catch {}
    } catch {
      setMsg("Withdrawal request failed");
      toast.error("Withdrawal request failed");
    }
  };

  return (
    <div className="rounded-3xl bg-card p-4 sm:p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)]">
      <div className="text-lg font-semibold">Withdraw Funds</div>
      <div className="mt-1 text-xs text-subtext">Send USDT (BEP20) to your address</div>
      <div className="mt-4 grid gap-3 max-w-full lg:max-w-md">
        <label className="grid gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-subtext">Withdraw Amount (USDT)</span>
            <span className="text-xs font-medium text-primary">Balance: {toUSD(Number((profile as any)?.withdrawBalance ?? 0))}</span>
          </div>
          <input
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="10"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-subtext">USDT Address (BEP20)</span>
          <input
            value={withdrawAddress}
            onChange={(e) => setWithdrawAddress(e.target.value.trim())}
            readOnly={!!profile?.permanentWithdrawAddress}
            className={`h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30 ${profile?.permanentWithdrawAddress ? "cursor-not-allowed bg-muted opacity-80" : ""}`}
            placeholder="0x..."
          />
          {profile?.permanentWithdrawAddress && (
            <span className="mt-1 px-1 text-[10px] text-green-500 font-medium italic">✓ Permanent withdrawal address applied</span>
          )}
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-subtext">Security Code</span>
          <input
            type="password"
            value={securityCode}
            onChange={(e) => setSecurityCode(e.target.value.trim())}
            className="h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Your Security Code"
          />
        </label>
        <button
          type="button"
          onClick={onWithdraw}
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
        >
          Withdraw
        </button>
        {msg ? <div className="rounded-2xl bg-muted p-3 text-xs text-subtext ring-1 ring-ring">{msg}</div> : null}
      </div>
    </div>
  );
}

function MyProfileSection({ 
  profile, 
  onProfileUpdate, 
  tab 
}: { 
  profile: any, 
  onProfileUpdate?: (updatedData: any) => void,
  tab: "profile" | "security" | "withdrawAddress"
}) {
  const [uiMessage, setUiMessage] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingCode, setIsChangingCode] = useState(false);
  const [isUpdatingSecurityCode, setIsUpdatingSecurityCode] = useState(false);
  const [showSecurityCode, setShowSecurityCode] = useState(false);
  const [passwordForSecurityCode, setPasswordForSecurityCode] = useState("");
  const [retrievedSecurityCode, setRetrievedSecurityCode] = useState<string | null>(null);
  
  const [isSavingWithdrawAddress, setIsSavingWithdrawAddress] = useState(false);
  const [newWithdrawAddress, setNewWithdrawAddress] = useState("");

  const [profileData, setProfileData] = useState({
    username: profile?.username || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [securityCodeData, setSecurityCodeData] = useState({
    currentPassword: "",
    newSecurityCode: ""
  });

  // Reset show security code state when tab changes
  useEffect(() => {
    setShowSecurityCode(false);
    setIsChangingCode(false);
    setRetrievedSecurityCode(null);
    setPasswordForSecurityCode("");
    setUiMessage("");
    setNewWithdrawAddress("");
  }, [tab]);

  const handleWithdrawAddressSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^0x[a-fA-F0-9]{40}$/.test(newWithdrawAddress)) {
      setUiMessage("Invalid USDT (BEP20) address");
      toast.error("Invalid USDT (BEP20) address");
      return;
    }

    setIsSavingWithdrawAddress(true);
    setUiMessage("");

    try {
      const res = await fetch("/api/user/update-withdraw-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: newWithdrawAddress.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error || "Failed to save address";
        setUiMessage(errMsg);
        toast.error(errMsg);
        
        // If the API says it's already set, update the profile state with the returned address
        if (data.address && onProfileUpdate) {
          onProfileUpdate({ permanentWithdrawAddress: data.address });
        }
        
        setIsSavingWithdrawAddress(false);
        return;
      }

      toast.success("Withdrawal address saved permanently");
      if (onProfileUpdate) {
        onProfileUpdate({ permanentWithdrawAddress: newWithdrawAddress.trim() });
      }
      setIsSavingWithdrawAddress(false);
      // Refresh full dashboard data
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("deposit:updated"));
        }
      } catch {}
    } catch (error) {
      setUiMessage("Failed to save address");
      toast.error("Failed to save address");
      setIsSavingWithdrawAddress(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setUiMessage("");
    
    try {
      // 1. Update Username if changed
      if (profileData.username !== profile?.username) {
        const res = await fetch("/api/user/update-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: profileData.username }),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = data?.error || "Profile update failed";
          setUiMessage(errMsg);
          toast.error(errMsg);
          setIsUpdatingProfile(false);
          return;
        }
        // Update parent state immediately for navbar
        if (onProfileUpdate) {
          onProfileUpdate({ username: profileData.username });
        }
      }

      // 2. Update Password if provided
      if (profileData.newPassword) {
        if (profileData.newPassword !== profileData.confirmPassword) {
          setUiMessage("New passwords do not match");
          toast.error("New passwords do not match");
          setIsUpdatingProfile(false);
          return;
        }
        const res = await fetch("/api/user/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: profileData.currentPassword,
            newPassword: profileData.newPassword
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = data?.error || "Password change failed";
          setUiMessage(errMsg);
          toast.error(errMsg);
          setIsUpdatingProfile(false);
          return;
        }
      }
      
      const successMsg = "Profile updated successfully";
      setUiMessage(successMsg);
      toast.success(successMsg);
      setProfileData(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
      setIsEditingProfile(false);
      setIsUpdatingProfile(false);
      // Refresh full dashboard data
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("deposit:updated"));
        }
      } catch {}
    } catch (error) {
      setUiMessage("Update failed");
      toast.error("Update failed");
      setIsUpdatingProfile(false);
    }
  };

  const handleSecurityCodeUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSecurityCode(true);
    setUiMessage("");

    try {
      const res = await fetch("/api/user/update-security-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(securityCodeData),
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error || "Security code update failed";
        setUiMessage(errMsg);
        toast.error(errMsg);
        setIsUpdatingSecurityCode(false);
        return;
      }

      const successMsg = "Security code updated successfully";
      setUiMessage(successMsg);
      toast.success(successMsg);
      setSecurityCodeData({ currentPassword: "", newSecurityCode: "" });
      setIsChangingCode(false);
      setIsUpdatingSecurityCode(false);
      if (onProfileUpdate) {
        onProfileUpdate({ securityCode: "exists" });
      }
      // Refresh full dashboard data
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("deposit:updated"));
        }
      } catch {}
    } catch (error) {
      setUiMessage("Security code update failed");
      toast.error("Security code update failed");
      setIsUpdatingSecurityCode(false);
    }
  };

  const handleShowSecurityCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setUiMessage("");
    try {
      const res = await fetch("/api/user/show-security-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordForSecurityCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error || "Failed to show security code";
        setUiMessage(errMsg);
        toast.error(errMsg);
        return;
      }
      setRetrievedSecurityCode(data.securityCode);
      toast.success("Security code retrieved");
      setPasswordForSecurityCode("");
    } catch (error) {
      setUiMessage("Failed to show security code");
      toast.error("Failed to show security code");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-card p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)]">
        <div className="text-sm font-semibold">
          {tab === "profile" ? "Update Profile" : tab === "security" ? "Security Code" : "Withdrawal Address"}
        </div>
        
        {uiMessage && (
          <div className="mt-4 rounded-2xl bg-muted p-4 text-sm text-foreground ring-1 ring-ring">
            {uiMessage}
          </div>
        )}
        
        <div className="mt-6 grid gap-4">
          {tab === "withdrawAddress" && (
            <div className="rounded-2xl bg-muted p-4 ring-1 ring-ring">
              <div className="text-sm font-medium">Permanent Withdrawal Address</div>
              
              {profile?.permanentWithdrawAddress ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-subtext px-1">Current Saved Address</span>
                    <div className="flex items-center justify-between rounded-xl bg-card px-4 py-4 text-sm ring-1 ring-ring shadow-inner">
                      <span className="font-mono font-bold text-primary break-all">{profile.permanentWithdrawAddress}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-green-500/10 p-4 text-xs text-green-600 ring-1 ring-green-500/20">
                    <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>This address is permanently locked to your account for all future withdrawals.</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleWithdrawAddressSave} className="mt-4 space-y-3">
                  <div className="text-xs text-subtext mb-2">This address will be locked once saved and used for all your withdrawals.</div>
                  <label className="block text-[10px] uppercase tracking-wider text-subtext mb-1 px-1">USDT Address (BEP20)</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={newWithdrawAddress}
                    onChange={(e) => setNewWithdrawAddress(e.target.value.trim())}
                    className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                    required
                  />
                  <div className="rounded-xl bg-yellow-500/10 p-3 text-xs text-yellow-600 ring-1 ring-yellow-500/20 flex items-start gap-2">
                    <svg className="h-4 w-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Important: You can only set this address ONCE. Make sure it is a valid BEP20 USDT address.</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={isSavingWithdrawAddress}
                      className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-xs font-medium text-white ring-1 ring-primary/20 transition hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isSavingWithdrawAddress ? "Saving..." : "Save Address Permanently"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {tab === "profile" && (
            <div className="rounded-2xl bg-muted p-4 ring-1 ring-ring">
              <div className="text-sm font-medium">Account Settings</div>
              <form onSubmit={handleProfileUpdate} className="mt-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-subtext mb-1 px-1">Email</label>
                    <input
                      type="email"
                      value={profile?.email || ""}
                      readOnly
                      className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-subtext mb-1 px-1">Phone</label>
                    <input
                      type="tel"
                      value={profile?.phone || ""}
                      readOnly
                      className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-subtext mb-1 px-1">Name</label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={profileData.username}
                    onChange={(e) => setProfileData({...profileData, username: e.target.value})}
                    className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                    required
                  />
                </div>
                
                <div className="pt-2 border-t border-ring/30">
                  <label className="block text-[10px] uppercase tracking-wider text-subtext mb-1 px-1 text-primary font-bold">Change Password (Optional)</label>
                  <div className="space-y-2">
                    <input
                      type="password"
                      placeholder="Current Password (required to change password)"
                      value={profileData.currentPassword}
                      onChange={(e) => setProfileData({...profileData, currentPassword: e.target.value})}
                      className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                    />
                    <input
                      type="password"
                      placeholder="New Password"
                      value={profileData.newPassword}
                      onChange={(e) => setProfileData({...profileData, newPassword: e.target.value})}
                      className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                    />
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      value={profileData.confirmPassword}
                      onChange={(e) => setProfileData({...profileData, confirmPassword: e.target.value})}
                      className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-white ring-1 ring-primary/20 transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isUpdatingProfile ? "Updating..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {tab === "security" && (
            <>
              {/* Show/Update Security Code */}
              {isChangingCode ? (
                <div className="rounded-2xl bg-muted p-4 ring-1 ring-ring">
                  <div className="text-sm font-medium">Update Security Code</div>
                  <form onSubmit={handleSecurityCodeUpdate} className="mt-4 space-y-3">
                    <input
                      type="password"
                      placeholder="Account Password"
                      value={securityCodeData.currentPassword}
                      onChange={(e) => setSecurityCodeData({...securityCodeData, currentPassword: e.target.value})}
                      className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                      required
                    />
                    <input
                      type="text"
                      placeholder="New Security Code"
                      value={securityCodeData.newSecurityCode}
                      onChange={(e) => setSecurityCodeData({...securityCodeData, newSecurityCode: e.target.value})}
                      className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                      required
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isUpdatingSecurityCode}
                        className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-white ring-1 ring-primary/20 transition hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isUpdatingSecurityCode ? "Updating..." : "Update Code"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsChangingCode(false)}
                        className="inline-flex items-center justify-center rounded-full bg-card px-4 py-2 text-xs font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : !showSecurityCode ? (
                <div className="rounded-2xl bg-muted p-4 ring-1 ring-ring">
                  {profile?.securityCode ? (
                    <>
                      <div className="text-sm font-medium text-foreground">Security Code Set</div>
                      <div className="mt-2 text-xs text-subtext">You have already set your security code. It is required for withdrawals and P2P transfers.</div>
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => setShowSecurityCode(true)}
                          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-xs font-medium text-white ring-1 ring-primary/20 transition hover:bg-primary/90"
                        >
                          View Current Code
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-medium">Set Security Code</div>
                      <div className="mt-1 text-xs text-subtext">Used for P2P transfers and withdrawals</div>
                      <form onSubmit={handleSecurityCodeUpdate} className="mt-4 space-y-3">
                        <input
                          type="password"
                          placeholder="Account Password"
                          value={securityCodeData.currentPassword}
                          onChange={(e) => setSecurityCodeData({...securityCodeData, currentPassword: e.target.value})}
                          className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                          required
                        />
                        <input
                          type="text"
                          placeholder="New Security Code"
                          value={securityCodeData.newSecurityCode}
                          onChange={(e) => setSecurityCodeData({...securityCodeData, newSecurityCode: e.target.value})}
                          className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                          required
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isUpdatingSecurityCode}
                            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-white ring-1 ring-primary/20 transition hover:bg-primary/90 disabled:opacity-50"
                          >
                            {isUpdatingSecurityCode ? "Setting..." : "Set Code"}
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-muted p-4 ring-1 ring-ring">
                  <div className="text-sm font-medium">View Security Code</div>
                  {retrievedSecurityCode ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-ring">
                        <span className="text-subtext">Your Code:</span>
                        <span className="font-mono font-bold text-primary text-lg">{retrievedSecurityCode}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSecurityCode(false);
                            setRetrievedSecurityCode(null);
                          }}
                          className="flex-1 inline-flex items-center justify-center rounded-full bg-card px-4 py-2 text-xs font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsChangingCode(true);
                            setShowSecurityCode(false);
                            setRetrievedSecurityCode(null);
                          }}
                          className="flex-1 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-white ring-1 ring-primary/20 transition hover:bg-primary/90"
                        >
                          Change Security Code
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleShowSecurityCode} className="mt-4 space-y-3">
                      <input
                        type="password"
                        placeholder="Enter Account Password to View Code"
                        value={passwordForSecurityCode}
                        onChange={(e) => setPasswordForSecurityCode(e.target.value)}
                        className="w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-ring"
                        required
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-white ring-1 ring-primary/20 transition hover:bg-primary/90"
                        >
                          Show Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSecurityCode(false)}
                          className="inline-flex items-center justify-center rounded-full bg-card px-4 py-2 text-xs font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NetworkTree({ nodes, onCopyMessage }: { nodes: any[], onCopyMessage: (message: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320); // Lower default for mobile
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0) {
        setW(el.clientWidth);
      }
    };
    update();
    // Use a small delay to ensure container is rendered
    const timer = setTimeout(update, 100);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      clearTimeout(timer);
    };
  }, []);

  // Group nodes by depth
  const nodesByDepth = useMemo(() => {
    const grouped: Record<number, any[]> = {};
    nodes.forEach(node => {
      if (!grouped[node.depth]) {
        grouped[node.depth] = [];
      }
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
        node
      }));
      
      r.push(pts);
    }
    
    return r;
  }, [maxDepth, nodesByDepth, w]);

  const svgW = w;
  const svgH = padY + (maxDepth + 1) * rowH + 20;
  
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  
  // Create connections between nodes
  for (let depth = 0; depth < rows.length - 1; depth += 1) {
    const parentRow = rows[depth];
    const childRow = rows[depth + 1];
    
    parentRow.forEach(parent => {
      const children = childRow.filter(child => 
        child.node.referredById === parent.node.id
      );
      
      children.forEach(child => {
        lines.push({ 
          x1: parent.x, 
          y1: parent.y + iconSize / 2, 
          x2: child.x, 
          y2: child.y - iconSize / 2 
        });
      });
    });
  }

  return (
    <div ref={ref} className="relative mt-5 w-full overflow-hidden">
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
        {rows.flatMap((row, depth) =>
          row.map((pt, idx) => (
            <div
              key={`n-${depth}-${idx}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: pt.x, top: pt.y }}
              title={`${pt.node.username} - L${pt.node.depth}`}
            >
              <div className="flex flex-col items-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 ring-1 ring-ring">
                  <FaUser className="text-foreground" size={16} />
                </div>
                <div className="mt-1 text-xs font-medium text-foreground max-w-[80px] truncate">
                  {pt.node.email === COMPANY_ADMIN_EMAIL ? "Admin" : pt.node.username}
                </div>
                <div className="text-[10px] text-subtext">
                  L{pt.node.depth}
                </div>
                {(pt.node.email === COMPANY_ADMIN_EMAIL || pt.node.verified) ? (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const text = origin ? `${origin}/?ref=${pt.node.referrerCode}` : pt.node.referrerCode;
                      try {
                        await navigator.clipboard.writeText(text);
                        onCopyMessage(`Copied ${(pt.node.email === COMPANY_ADMIN_EMAIL ? "Admin" : pt.node.username)}'s referral link`);
                        toast.success("Referral link copied");
                      } catch {
                        onCopyMessage("Copy failed");
                        toast.error("Copy failed");
                      }
                    }}
                    className="mt-1 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-[10px] text-subtext ring-1 ring-ring transition hover:text-foreground"
                    title="Copy team member referral link"
                  >
                    <span className="truncate max-w-[120px] sm:max-w-[200px]">{pt.node.referrerCode}</span>
                    <span className="text-primary">Copy</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-1 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-[10px] text-subtext ring-1 ring-ring opacity-70"
                    title="Referral locked until verified"
                  >
                    <span className="truncate max-w-[120px] sm:max-w-[200px]">—</span>
                    <span className="text-subtext">Locked</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {maxDepth > 7 ? (
        <div className="mt-6 rounded-2xl bg-muted p-4 ring-1 ring-ring">
          <div className="text-xs text-subtext">
            Showing {nodes.length} team members across {maxDepth + 1} levels
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
    <div className="rounded-2xl bg-card p-4 sm:p-5 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] min-w-0">
      <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-subtext truncate">{label}</div>
      <div className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-foreground truncate">{value}</div>
      {hint ? <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-subtext truncate">{hint}</div> : null}
    </div>
  );
}

export default function UserDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [active, setActive] = useState<"home" | "network" | "wallet" | "settings" | "income" | "activation">("home");
  const [activating, setActivating] = useState(false);

  const onActivate = async () => {
    if (profile?.status === "active" || profile?.status === "admin") {
      toast.info("Account is already active");
      return;
    }
    setActivating(true);
    try {
      const res = await fetch("/api/user/activate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Activation failed");
        return;
      }
      toast.success("Account activated successfully!");
      // Refresh data
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("deposit:updated"));
        }
      } catch {}
    } catch {
      toast.error("Activation failed");
    } finally {
      setActivating(false);
    }
  };
  const [walletOpen, setWalletOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [walletTab, setWalletTab] = useState<
    "deposit" | "depositHistory" | "withdraw" | "withdrawHistory" | "p2pTransfer" | "p2pHistory" | "internalTransfer" | "commissions"
  >("deposit");
  const [profileTab, setProfileTab] = useState<"profile" | "security" | "withdrawAddress">("profile");
  const [level, setLevel] = useState(6);
  const maxLevel = 33;

  const [profile, setProfile] = useState<any>(null);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [referralGate, setReferralGate] = useState<any>(null);
  const [gateSecondsLeft, setGateSecondsLeft] = useState<number>(0);
  const [directReferrals, setDirectReferrals] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [recentDeposits, setRecentDeposits] = useState<any[]>([]);
  const [refStats, setRefStats] = useState<{ total: number; levels: Record<string, number> } | null>(null);
  const [teamNodes, setTeamNodes] = useState<any[] | null>(null);
  const [uplineNodes, setUplineNodes] = useState<any[] | null>(null);
  const [notifications, setNotifications] = useState<any[] | null>(null);
  const [unread, setUnread] = useState<number>(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [uiMessage, setUiMessage] = useState("");
  const [origin, setOrigin] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [openLevels, setOpenLevels] = useState<number[]>([]);
  const [totals, setTotals] = useState<{ deposits: number; withdrawals: number }>({ deposits: 0, withdrawals: 0 });
  const [p2pRecipient, setP2pRecipient] = useState("");
  const [p2pAmount, setP2pAmount] = useState("");
  const [p2pSecurityCode, setP2pSecurityCode] = useState("");
  const [p2pMsg, setP2pMsg] = useState("");
  const [p2pItems, setP2pItems] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);

  const [internalTransferAmount, setInternalTransferAmount] = useState("");
  const [internalTransferMsg, setInternalTransferMsg] = useState("");
  const [transferTarget, setTransferTarget] = useState<"withdraw" | "usdt">("withdraw");

  const onInternalTransfer = async () => {
    setInternalTransferMsg("");
    try {
      const amt = Number(internalTransferAmount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setInternalTransferMsg("Invalid amount");
        toast.error("Invalid amount");
        return;
      }
      if (!p2pSecurityCode.trim()) {
        setInternalTransferMsg("Security Code is required");
        toast.error("Security Code is required");
        return;
      }
      const res = await fetch("/api/user/internal-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amount: amt, 
          securityCode: p2pSecurityCode.trim(),
          target: transferTarget
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInternalTransferMsg(data?.error || "Transfer failed");
        toast.error(data?.error || "Transfer failed");
        return;
      }
      toast.success(`Transfer to ${transferTarget === "withdraw" ? "withdraw" : "USDT"} wallet successful`);
      setInternalTransferAmount("");
      setP2pSecurityCode("");
      // Refresh data
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("deposit:updated"));
        }
      } catch {}
    } catch {
      setInternalTransferMsg("Transfer failed");
      toast.error("Transfer failed");
    }
  };

  const onP2PTransfer = async () => {
    setP2pMsg("");
    try {
      const amt = Number(p2pAmount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setP2pMsg("Invalid amount");
        toast.error("Invalid amount");
        return;
      }
      if (!p2pRecipient.trim()) {
        setP2pMsg("Recipient is required");
        toast.error("Recipient is required");
        return;
      }
      if (!p2pSecurityCode.trim()) {
        setP2pMsg("Security Code is required");
        toast.error("Security Code is required");
        return;
      }
      const res = await fetch("/api/user/p2p-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: p2pRecipient.trim(), amount: amt, securityCode: p2pSecurityCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setP2pMsg(typeof data?.error === "string" ? data.error : "Transfer failed");
        toast.error(typeof data?.error === "string" ? data.error : "Transfer failed");
        return;
      }
      toast.success("Transfer successful");
      setP2pRecipient("");
      setP2pAmount("");
      setP2pSecurityCode("");
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("deposit:updated"));
        }
      } catch {}
      try {
        const hres = await fetch("/api/user/p2p-history", { cache: "no-store" });
        const h = await hres.json();
        if (hres.ok) setP2pItems(Array.isArray(h?.items) ? h.items : []);
      } catch {}
    } catch {
      setP2pMsg("Transfer failed");
      toast.error("Transfer failed");
    }
  };
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const todayEarnings = useMemo(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      return Number(
        (recentTransactions || [])
          .filter(
            (t: any) =>
              String(t?.type || "").toLowerCase() === "commission" &&
              String(t?.createdAt || "").slice(0, 10) === today,
          )
          .reduce((sum: number, t: any) => sum + Number(t?.amount || 0), 0)
          .toFixed(2),
      );
    } catch {
      return 0;
    }
  }, [recentTransactions]);

  const totalIncomeAllTime = useMemo(() => {
    try {
      return Number(
        (recentTransactions || [])
          .filter((t: any) => String(t?.type || "").toLowerCase() === "commission")
          .reduce((sum: number, t: any) => sum + Number(t?.amount || 0), 0)
          .toFixed(2),
      );
    } catch {
      return 0;
    }
  }, [recentTransactions]);
  const totalWithdrawAllTime = useMemo(() => {
    try {
      return Number(
        (recentTransactions || [])
          .filter((t: any) => String(t?.type || "").toLowerCase() === "withdrawal")
          .reduce((sum: number, t: any) => sum + Number(t?.amount || 0), 0)
          .toFixed(2),
      );
    } catch {
      return 0;
    }
  }, [recentTransactions]);

  useEffect(() => {
    const o = typeof window !== "undefined" ? window.location.origin : "";
    setOrigin(o);
  }, []);

  const refreshDashboardData = async () => {
    if (status === "loading" || !session?.user?.id) return;
    try {
      // 1. Core Dashboard Data (Balances, Transactions, Status)
      const res = await fetch("/api/user/dashboard", { cache: "no-store" });
      const dash = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          await signOut({ callbackUrl: "/" });
          return;
        }
        return;
      }
      if (dash?.profile) {
        setProfile(dash.profile);
        setCurrentLevel(Number(dash?.currentLevel ?? 0));
        setReferralGate(dash.referralGate ?? null);
        setGateSecondsLeft(Number(dash?.referralGate?.secondsLeft ?? 0));
        setDirectReferrals(dash.directReferrals ?? 0);
        setRecentTransactions(dash.recentTransactions ?? []);
        setRecentDeposits(dash.recentDeposits ?? []);
        setTotals({
          deposits: Number(dash?.depositTotal ?? 0),
          withdrawals: Number(dash?.withdrawalTotal ?? 0),
        });
      }

      // 2. Stats & Notifications (Quick fetches)
      const [statsRes, notiRes] = await Promise.all([
        fetch("/api/user/referral-stats", { cache: "no-store" }),
        fetch("/api/user/notifications", { cache: "no-store" }),
      ]);
      
      if (statsRes.ok) {
        const stats = await statsRes.json();
        if (stats?.levels) setRefStats(stats);
      }
      
      if (notiRes.ok) {
        const noti = await notiRes.json();
        if (Array.isArray(noti?.items)) {
          setNotifications(noti.items);
          setUnread(noti.unread ?? 0);
        }
      }

      // 3. Team/Upline Data (Fetch only if active or empty)
      if (!teamNodes || !uplineNodes || active === "network" || active === "home") {
        const [teamRes, uplineRes] = await Promise.all([
          fetch("/api/user/my-team", { cache: "no-store" }),
          fetch("/api/user/upline", { cache: "no-store" }),
        ]);
        if (teamRes.ok) {
          const team = await teamRes.json();
          if (team?.nodes) setTeamNodes(team.nodes);
        }
        if (uplineRes.ok) {
          const upline = await uplineRes.json();
          if (upline?.nodes) setUplineNodes(upline.nodes);
        }
      }

      // 4. Tab-specific data (Fetch if active)
      if (active === "wallet" && walletTab === "p2pHistory") {
        const res = await fetch("/api/user/p2p-history", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setP2pItems(Array.isArray(data?.items) ? data.items : []);
      }
      
      if ((active === "wallet" && walletTab === "commissions") || active === "income") {
        const res = await fetch("/api/user/commissions", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setCommissions(Array.isArray(data?.items) ? data.items : []);
      }
    } catch (err) {
      console.error("Dashboard refresh error:", err);
    }
  };

  useEffect(() => {
    if (status === "loading" || !session?.user?.id) return;
    
    refreshDashboardData();
    const interval = setInterval(refreshDashboardData, 3000); // Master poll every 3 seconds for near real-time feel
    
    const handler = () => refreshDashboardData();
    if (typeof window !== "undefined") {
      window.addEventListener("deposit:updated", handler);
      window.addEventListener("profile:updated", handler);
    }
    
    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("deposit:updated", handler);
        window.removeEventListener("profile:updated", handler);
      }
    };
  }, [session?.user?.id, status]);

  useEffect(() => {
    if (!referralGate || referralGate.state !== "unverified") return;
    setGateSecondsLeft(Number(referralGate.secondsLeft ?? 0));
    const id = setInterval(() => {
      setGateSecondsLeft((v) => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [referralGate?.state, referralGate?.expiresAt]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/user/p2p-history", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return;
        setP2pItems(Array.isArray(data?.items) ? data.items : []);
      } catch {}
    };
    if (active === "wallet" && walletTab === "p2pHistory") {
      load();
    }
  }, [active, walletTab]);

  useEffect(() => {
    const load = async () => {
      setCommissionsLoading(true);
      try {
        const res = await fetch("/api/user/commissions", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setCommissions(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        console.error("Failed to load commissions", e);
      } finally {
        setCommissionsLoading(false);
      }
    };
    if ((active === "wallet" && walletTab === "commissions") || active === "income") {
      load();
    }
  }, [active, walletTab]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.id) {
      router.replace("/");
      return;
    }
  }, [router, session?.user?.id, status]);

  const networkRows = useMemo(() => {
    const rows: { level: number; count: number }[] = [];
    for (let i = 1; i <= maxLevel; i += 1) {
      rows.push({ level: i, count: refStats?.levels?.[String(i)] ?? 0 });
    }
    return rows;
  }, [refStats]);

  const activeRow = networkRows[level - 1] ?? { level, count: 0 };
  const initials = useMemo(() => {
    const name = profile?.username ?? "";
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "U";
    const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "S";
    return `${a}${b}`.toUpperCase();
  }, [profile?.username]);
  const gateTime = useMemo(() => {
    const s = Math.max(0, Number(gateSecondsLeft || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, [gateSecondsLeft]);

  const handleMenuToggle = () => {
    const lg = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
    if (lg) {
      setSidebarCollapsed((v) => !v);
    } else {
      setMobileNavOpen(true);
    }
  };

  return (
    <div className="min-h-screen max-w-[100vw] overflow-x-hidden bg-transparent text-foreground">
      <div className="mx-auto max-w-7xl overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={handleMenuToggle}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-card shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] hover:bg-muted lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={handleMenuToggle}
              className="hidden h-10 w-10 items-center justify-center rounded-xl bg-card shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] hover:bg-muted lg:inline-flex"
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              {sidebarCollapsed ? "›" : "‹"}
            </button>
              <div className="flex min-w-0 items-center gap-3">
                <img src="/logo.svg" alt="Logo" className="h-7 w-auto rounded-md ring-1 ring-ring" />
              </div>
          </div>
          <div className="relative flex min-w-0 items-center gap-2" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-2xl p-1.5 transition hover:bg-muted"
            >
              <div className="min-w-0 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="max-w-[120px] truncate text-sm font-medium sm:max-w-[180px]">{profile?.username ?? "User"}</div>
                  {referralGate?.state === "unverified" ? (
                    <span className="hidden xs:inline-block rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                      UNVERIFIED {gateTime}
                    </span>
                  ) : referralGate?.state === "verified" ? (
                    <span className="hidden xs:inline-block rounded-full bg-green-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                      VERIFIED
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-[10px] sm:text-xs text-subtext">
                  {referralGate?.state === "unverified" ? "—" : profile?.referrerCode ?? "-"}
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20">
                {initials}
              </div>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl bg-card p-1 shadow-xl ring-1 ring-ring animate-in fade-in slide-in-from-top-2 duration-200">
                <button
                  type="button"
                  onClick={() => {
                    setActive("settings");
                    setUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  <FaUserCircle className="text-primary" size={18} />
                  My Profile
                </button>
                <div className="my-1 border-t border-ring/50" />
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium text-red-500 transition hover:bg-red-500/10"
                >
                  <FaSignOutAlt className="text-red-500" size={18} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {referralGate?.state === "unverified" ? (
          <div className="mt-4 rounded-2xl bg-red-500/15 p-4 ring-1 ring-red-500/25">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">UNVERIFIED</span>
                <span className="text-sm text-subtext">Deposit within 24 hours to verify your account</span>
              </div>
              <div className="text-sm font-semibold text-red-200">{gateTime}</div>
            </div>
          </div>
        ) : referralGate?.state === "verified" ? (
          <div className="mt-4 rounded-2xl bg-green-500/15 p-4 ring-1 ring-green-500/25">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">VERIFIED</span>
                <span className="text-sm text-subtext">Your referral verification is complete</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className={`mt-6 grid gap-6 w-full max-w-full overflow-hidden ${sidebarCollapsed ? "lg:grid-cols-[1fr]" : "lg:grid-cols-[260px_1fr]"}`}>
          {!sidebarCollapsed && (
          <aside className="hidden min-w-0 lg:block">
            <div className="rounded-3xl bg-card p-3 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)]">
              <div className="px-3 py-2 text-xs font-medium text-subtext">Menu</div>
              <div className="mt-1 grid gap-1">
                <button
                  type="button"
                  onClick={() => { setActive("home"); setWalletOpen(false); setProfileOpen(false); }}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    active === "home" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>Home</span>
                  {active === "home" ? <span className="text-primary">●</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => { setActive("network"); setWalletOpen(false); setProfileOpen(false); }}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    active === "network" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>My Network</span>
                  {active === "network" ? <span className="text-primary">●</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => { setActive("income"); setWalletOpen(false); setProfileOpen(false); }}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    active === "income" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>Income History</span>
                  {active === "income" ? <span className="text-primary">●</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => { setActive("activation"); setWalletOpen(false); setProfileOpen(false); }}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    active === "activation" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>Activation Account</span>
                  {active === "activation" ? <span className="text-primary">●</span> : null}
                </button>
                <div className="grid gap-1">
                  <button
                    type="button"
                    onClick={() => { setWalletOpen((v) => !v); setProfileOpen(false); }}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                      active === "wallet" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                    }`}
                    aria-expanded={walletOpen}
                  >
                    <span>Wallet</span>
                    <span className={`transition-transform ${walletOpen ? "rotate-90" : ""}`}>›</span>
                  </button>
                  <div className={`ml-2 grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ${walletOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="min-h-0 overflow-hidden rounded-2xl bg-background ring-1 ring-ring">
                      {[
                        { key: "deposit", label: "Deposit Funds" },
                        { key: "depositHistory", label: "Deposit History" },
                        { key: "withdraw", label: "Withdraw Funds" },
                        { key: "withdrawHistory", label: "Withdrawal History" },
                        { key: "p2pTransfer", label: "P2P Fund Transfer" },
                        { key: "internalTransfer", label: "Transfer to Withdraw Wallet" },
                        { key: "p2pHistory", label: "P2P History" },
                      ].map((i) => (
                        <button
                          key={i.key}
                          type="button"
                          onClick={() => { setActive("wallet"); setWalletTab(i.key as typeof walletTab); }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition ${
                            active === "wallet" && walletTab === (i.key as typeof walletTab)
                              ? "bg-muted text-foreground"
                              : "text-subtext hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <span>{i.label}</span>
                          {active === "wallet" && walletTab === (i.key as typeof walletTab) ? <span className="text-primary">●</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-1">
                  <button
                    type="button"
                    onClick={() => { setProfileOpen((v) => !v); setWalletOpen(false); }}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                      active === "settings" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                    }`}
                    aria-expanded={profileOpen}
                  >
                    <span>My Profile</span>
                    <span className={`transition-transform ${profileOpen ? "rotate-90" : ""}`}>›</span>
                  </button>
                  <div className={`ml-2 grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ${profileOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="min-h-0 overflow-hidden rounded-2xl bg-background ring-1 ring-ring">
                      {[
                        { key: "profile", label: "Update Profile" },
                        { key: "withdrawAddress", label: "Withdrawal Address" },
                        { key: "security", label: "Security Code" },
                      ].map((i) => (
                        <button
                          key={i.key}
                          type="button"
                          onClick={() => { setActive("settings"); setProfileTab(i.key as typeof profileTab); }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition ${
                            active === "settings" && profileTab === (i.key as typeof profileTab)
                              ? "bg-muted text-foreground"
                              : "text-subtext hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <span>{i.label}</span>
                          {active === "settings" && profileTab === (i.key as typeof profileTab) ? <span className="text-primary">●</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-card p-5 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)]">
              <div className="text-xs text-subtext">Referral Link</div>
              {referralGate?.state === "unverified" ? (
                <>
                  <div className="mt-2 min-w-0 break-all whitespace-normal rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                    Verify your account to unlock
                  </div>
                  <button
                    type="button"
                    disabled
                    className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gray-300 text-sm font-semibold text-gray-600 shadow-sm ring-1 ring-gray-300"
                  >
                    Verify to Unlock
                  </button>
                </>
              ) : (
                <>
                  <div className="mt-2 min-w-0 break-all whitespace-normal rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                    {origin ? `${origin}/?ref=${profile?.referrerCode ?? ""}` : profile?.referrerCode ?? "-"}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (profile?.status !== "admin" && directReferrals >= 2) {
                        setUiMessage("You can add only 2 direct referrals. To invite further, copy your team members’ referral links.");
                        setTimeout(() => setUiMessage(""), 3000);
                        return;
                      }
                      const text = origin ? `${origin}/?ref=${profile?.referrerCode ?? ""}` : profile?.referrerCode ?? "";
                      try {
                        await navigator.clipboard.writeText(text);
                        setLinkCopied(true);
                        toast.success("Invite link copied");
                        setTimeout(() => setLinkCopied(false), 1200);
                      } catch {
                        setUiMessage("Copy failed");
                        toast.error("Copy failed");
                        setTimeout(() => setUiMessage(""), 1200);
                      }
                    }}
                    disabled={profile?.status !== "admin" && directReferrals >= 2}
                    className={`mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl text-sm font-semibold shadow-sm ring-1 transition ${
                      profile?.status !== "admin" && directReferrals >= 2 
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed ring-gray-300" 
                        : linkCopied 
                        ? "bg-green-500 text-white ring-green-500/20"
                        : "bg-primary text-white ring-primary/20 hover:bg-primary/90"
                    }`}
                  >
                    {linkCopied ? "Link Copied" : (profile?.status !== "admin" && directReferrals >= 2) ? "Max Reached (2/2)" : "Copy Link"}
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-muted px-5 text-sm font-medium text-foreground ring-1 ring-ring transition hover:bg-secondary"
            >
              Logout
            </button>
          </aside>
          )}
          
          <div className="lg:hidden">
            <div className="min-w-0 rounded-3xl bg-card p-5 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)]">
              <div className="text-xs text-subtext">Referral Link</div>
              {referralGate?.state === "unverified" ? (
                <>
                  <div className="mt-2 break-all rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                    Verify your account to unlock
                  </div>
                  <button
                    type="button"
                    disabled
                    className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gray-300 text-sm font-semibold text-gray-600 shadow-sm ring-1 ring-gray-300"
                    aria-label="Referral link locked"
                  >
                    Verify to Unlock
                  </button>
                </>
              ) : (
                <>
                  <div className="mt-2 min-w-0 break-all whitespace-normal rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                    {origin ? `${origin}/?ref=${profile?.referrerCode ?? ""}` : profile?.referrerCode ?? "-"}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (profile?.status !== "admin" && directReferrals >= 2) {
                        setUiMessage("You can add only 2 direct referrals. To invite further, copy your team members’ referral links.");
                        setTimeout(() => setUiMessage(""), 3000);
                        return;
                      }
                      const text = origin ? `${origin}/?ref=${profile?.referrerCode ?? ""}` : profile?.referrerCode ?? "";
                      try {
                        await navigator.clipboard.writeText(text);
                        setLinkCopied(true);
                        toast.success("Invite link copied");
                        setTimeout(() => setLinkCopied(false), 1200);
                      } catch {
                        setUiMessage("Copy failed");
                        toast.error("Copy failed");
                        setTimeout(() => setUiMessage(""), 1200);
                      }
                    }}
                    disabled={profile?.status !== "admin" && directReferrals >= 2}
                    className={`mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl text-sm font-semibold shadow-sm ring-1 transition ${
                      profile?.status !== "admin" && directReferrals >= 2 
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed ring-gray-300" 
                        : linkCopied 
                        ? "bg-green-500 text-white ring-green-500/20"
                        : "bg-primary text-white ring-primary/20 hover:bg-primary/90"
                    }`}
                    aria-label="Copy referral link"
                  >
                    {linkCopied ? "Link Copied" : (profile?.status !== "admin" && directReferrals >= 2) ? "Max Reached (2/2)" : "Copy Link"}
                  </button>
                </>
              )}
            </div>
          </div>

          <main className="min-w-0 flex-1 space-y-6 overflow-hidden">
            {active === "home" && (
              <div className="space-y-6">
                <div className="rounded-3xl bg-card p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] sm:p-8 overflow-hidden">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm text-subtext">Welcome back</div>
                      <div className="mt-1 text-2xl font-semibold">{profile?.username ?? "User"}</div>
                      <div className="mt-2 max-w-2xl text-sm text-subtext">
                        {uiMessage ? uiMessage : "Live data enabled: dashboard, referrals, transactions, notifications."}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSupportOpen(true)}
                        className="inline-flex items-center justify-center rounded-full bg-card px-5 py-2 text-sm font-medium text-foreground shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] transition hover:bg-muted w-full sm:w-auto"
                      >
                        Support
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {[
                      { href: "https://facebook.com", icon: <FaFacebook size={22} />, name: "Facebook" },
                      { href: "https://twitter.com", icon: <FaTwitter size={22} />, name: "Twitter" },
                      { href: "https://instagram.com", icon: <FaInstagram size={22} />, name: "Instagram" },
                      { href: "https://youtube.com", icon: <FaYoutube size={22} />, name: "YouTube" },
                      { href: "https://t.me", icon: <FaTelegramPlane size={22} />, name: "Telegram" },
                      { href: "https://wa.me", icon: <FaWhatsapp size={22} />, name: "WhatsApp" },
                    ].map((s) => (
                      <a
                        key={s.name}
                        href={s.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-muted p-4 text-center ring-1 ring-ring transition hover:bg-background"
                        aria-label={s.name}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-ring text-foreground">
                          {s.icon}
                        </div>
                        <div className="text-xs text-subtext">{s.name}</div>
                      </a>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-3 grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  <StatCard label="Withdrawal wallet" value={toUSD(Number(profile?.balance ?? 0))} />
                  <StatCard label="USDT Wallet" value={toUSD(Number(profile?.usdtBalance ?? 0))} />
                  <StatCard label="Total Income" value={toUSD(totalIncomeAllTime)} />
                  <StatCard label="Daily Income" value={toUSD(todayEarnings)} />
                  <StatCard label="Total Team" value={String(refStats?.total ?? 0)} />
                  <StatCard label="Total Deposit" value={toUSD(totals.deposits)} />
                  <StatCard label="Total Withdraw" value={toUSD(totals.withdrawals)} />
                   <StatCard label="Level" value={`L${currentLevel}`} />
                    </div>
                </div>

                {teamNodes && (
                  <div className="grid gap-6 xl:grid-cols-1 w-full max-w-full overflow-hidden">
                    {uplineNodes && uplineNodes.length > 0 ? (
                      <div className="rounded-2xl bg-card p-5 ring-1 ring-ring overflow-hidden max-w-full shadow-[0_0_15px_rgba(1,163,151,0.15)] transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">My Upline</div>
                        </div>
                        <div className="mt-4">
                          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                            {uplineNodes.map((n: any, idx: number) => (
                              <div key={n.id} className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-sm ring-1 ring-ring">
                                  <span className="truncate font-medium text-foreground">{n.username}</span>
                                  <span className="max-w-[50%] truncate font-medium text-primary">ID: {n.referrerCode}</span>
                                </div>
                                {idx < uplineNodes.length - 1 && (
                                  <span className="hidden sm:inline text-xl text-subtext">→</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="hidden lg:block rounded-2xl bg-card p-5 ring-1 ring-ring">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <div className="text-sm font-semibold">My Team Tree</div>
                        <div className="text-xs text-subtext">{teamNodes.length} members</div>
                      </div>
                      <div className="mt-4 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
                        <div className="min-w-max">
                          <NetworkTree nodes={teamNodes} onCopyMessage={setUiMessage} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="rounded-2xl bg-card p-5 ring-1 ring-ring overflow-hidden max-w-full shadow-[0_0_15px_rgba(1,163,151,0.15)] transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">My Team List</div>
                        <div className="text-xs text-subtext">{teamNodes.length} members</div>
                      </div>
                      <div className="mt-4 max-h-[260px] overflow-auto rounded-2xl ring-1 ring-ring custom-scrollbar">
                        <div className="divide-y divide-[color:var(--ring)]">
                          {teamNodes.slice(0, 40).map((n: any) => (
                            <div key={n.id} className="flex min-w-0 flex-col justify-between gap-1 px-4 py-3 text-sm xs:flex-row xs:items-center xs:gap-3">
                              <div className="min-w-0 truncate">
                                <div className="truncate font-medium text-foreground">{n.email === COMPANY_ADMIN_EMAIL ? "Admin" : n.username}</div>
                                <div className="truncate text-[10px] sm:text-xs text-subtext">
                                  L{n.depth} · {(n.email === COMPANY_ADMIN_EMAIL || n.verified) ? n.referrerCode : "—"}
                                </div>
                              </div>
                              <div className="truncate text-[10px] sm:text-xs text-subtext">{n.email}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {active === "network" && teamNodes && (
              <div className="rounded-3xl bg-card p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-subtext">My Network</div>
                    <div className="mt-1 text-2xl font-semibold">Level-wise View</div>
                    <div className="mt-2 max-w-2xl text-sm text-subtext">
                      Expand a level to see user IDs. Showing up to L{maxLevel}.
                    </div>
                  </div>
                  <div className="text-xs text-subtext">{teamNodes.length} members</div>
                </div>
                <div className="mt-6">
                  {Array.from({ length: maxLevel + 1 }, (_, i) => i).map((lvl) => {
                    const members = teamNodes.filter((n: any) => Number(n.depth) === lvl);
                    const count = lvl === 0 ? 1 : (refStats?.levels?.[String(lvl)] ?? members.length);
                    const open = openLevels.includes(lvl);
                    return (
                      <div key={lvl} className="mb-3 rounded-2xl bg-muted ring-1 ring-ring">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenLevels((prev) => (prev.includes(lvl) ? prev.filter((x) => x !== lvl) : [...prev, lvl]))
                          }
                          className="flex w-full items-center justify-between px-5 py-4 text-left"
                          aria-expanded={open}
                        >
                          <span className="text-base font-medium text-foreground">Level {lvl}</span>
                          <span className="rounded-full bg-card px-3 py-1 text-sm text-subtext ring-1 ring-ring">
                            {count} {count === 1 ? "member" : "members"}
                          </span>
                        </button>
                        <div
                          className={`px-5 transition-[max-height,opacity] duration-300 ease-out ${
                            open ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="pb-4 text-sm text-subtext">
                            {members.length === 0 ? (
                              <div className="rounded-xl bg-card px-3 py-2 text-xs ring-1 ring-ring">No members at this level</div>
                            ) : (
                              members.slice(0, 200).map((n: any) => (
                                <div key={n.id} className="flex min-w-0 items-center justify-between gap-3 py-1">
                                  <span className="truncate font-medium text-foreground">{n.username ?? "-"}</span>
                                  {(n.email === COMPANY_ADMIN_EMAIL || n.verified) ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(String(n.referrerCode ?? ""));
                                          setUiMessage("Referral code copied");
                                          toast.success("Referral code copied");
                                          setTimeout(() => setUiMessage(""), 1200);
                                        } catch {
                                          setUiMessage("Copy failed");
                                          toast.error("Copy failed");
                                          setTimeout(() => setUiMessage(""), 1200);
                                        }
                                      }}
                                      className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs text-subtext ring-1 ring-ring transition hover:text-foreground"
                                      aria-label="Copy referral code"
                                    >
                                      <span className="max-w-[100px] truncate">{n.referrerCode ?? "-"}</span>
                                      <span className="text-primary">Copy</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled
                                      className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs text-subtext ring-1 ring-ring opacity-70"
                                      aria-label="Referral code locked"
                                    >
                                      <span>—</span>
                                      <span className="text-subtext">Locked</span>
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {active === "wallet" && walletTab === "deposit" && (
              <WalletSection 
                balance={profile?.balance ?? 0} 
                userId={profile?.id ?? ""}
                onHistoryRedirect={() => {
                  setWalletTab("depositHistory");
                }}
              />
            )}
            {active === "wallet" && walletTab === "depositHistory" && (
              <div className="rounded-3xl bg-card p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] overflow-hidden">
                <div className="text-sm font-semibold">Deposit History</div>
                <div className="mt-4 w-full overflow-x-auto rounded-2xl ring-1 ring-ring custom-scrollbar">
                  <div className="min-w-[500px]">
                    <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] gap-2 bg-muted px-4 py-3 text-xs font-medium text-subtext">
                      <div>Hash</div>
                      <div>Amount</div>
                      <div>Status</div>
                      <div>Date</div>
                    </div>
                    <div className="divide-y divide-[color:var(--ring)]">
                      {recentDeposits.map((t: any) => (
                        <div key={t.id} className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] gap-2 px-4 py-4 text-sm">
                          <div className="truncate font-mono text-[10px]">{t.txHash ?? "-"}</div>
                          <div className="font-medium text-foreground">{toUSD(Number(t.amount))}</div>
                          <div>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                              t.status === "confirmed" ? "bg-green-500/10 text-green-500 ring-green-500/20" :
                              t.status === "pending" ? "bg-yellow-500/10 text-yellow-500 ring-yellow-500/20" :
                              "bg-red-500/10 text-red-500 ring-red-500/20"
                            }`}>
                              {t.status}
                            </span>
                          </div>
                          <div className="text-subtext">{String(t.createdAt).slice(0, 10)}</div>
                        </div>
                      ))}
                      {recentDeposits.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-subtext">No deposits yet</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {active === "wallet" && walletTab === "withdraw" && <WithdrawSection profile={profile} />}
            {active === "wallet" && walletTab === "withdrawHistory" && (
              <div className="rounded-3xl bg-card p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] overflow-hidden">
                <div className="text-sm font-semibold">Withdrawal History</div>
                <div className="mt-4 w-full overflow-x-auto rounded-2xl ring-1 ring-ring custom-scrollbar">
                  <div className="min-w-[400px]">
                    <div className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 bg-muted px-4 py-3 text-xs font-medium text-subtext">
                      <div>Hash</div>
                      <div>Amount</div>
                      <div>Date</div>
                    </div>
                    <div className="divide-y divide-[color:var(--ring)]">
                      {recentTransactions
                        .filter((t: any) => String(t.type).toLowerCase() === "withdrawal")
                        .map((t: any) => (
                          <div key={t.id} className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2 px-4 py-4 text-sm">
                            <div className="truncate">{t.txHash ?? "-"}</div>
                            <div className="font-medium text-foreground">{String(t.amount)}</div>
                            <div className="text-subtext">{String(t.createdAt).slice(0, 10)}</div>
                          </div>
                        ))}
                      {recentTransactions.filter((t: any) => String(t.type).toLowerCase() === "withdrawal").length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-subtext">No withdrawals yet</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {active === "wallet" && walletTab === "p2pTransfer" && (
              <div className="rounded-3xl bg-card p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] overflow-hidden">
                <div className="text-sm font-semibold">P2P Fund Transfer</div>
                <div className="mt-1 text-xs text-subtext">Transfer USDT between members</div>
                <div className="mt-4 grid gap-3 sm:max-w-md">
                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">Recipient (Email / Referrer Code / Username)</span>
                    <input
                      value={p2pRecipient}
                      onChange={(e) => setP2pRecipient(e.target.value)}
                      className="h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="user@example.com or ABC123"
                    />
                  </label>
                  <label className="grid gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-subtext">Amount (USDT)</span>
                      <span className="text-xs font-medium text-primary">Balance: {toUSD(Number((profile as any)?.usdtBalance ?? 0))}</span>
                    </div>
                    <input
                      value={p2pAmount}
                      onChange={(e) => setP2pAmount(e.target.value)}
                      className="h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="10"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">Security Code</span>
                    <input
                      type="password"
                      value={p2pSecurityCode}
                      onChange={(e) => setP2pSecurityCode(e.target.value.trim())}
                      className="h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Your Security Code"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={onP2PTransfer}
                    className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
                  >
                    Send
                  </button>
                  {p2pMsg ? (
                    <div className="rounded-2xl bg-muted p-3 text-xs text-subtext ring-1 ring-ring">{p2pMsg}</div>
                  ) : null}
                </div>
              </div>
            )}
            {active === "wallet" && walletTab === "internalTransfer" && (
              <div className="rounded-3xl bg-card p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] overflow-hidden">
                <div className="text-sm font-semibold">Transfer Funds</div>
                <div className="mt-1 text-xs text-subtext">Transfer from Main Balance to other wallets</div>
                <div className="mt-4 grid gap-3 sm:max-w-md">
                  <div className="grid gap-2">
                    <span className="text-sm font-medium">Select Target Wallet</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTransferTarget("withdraw")}
                        className={`rounded-2xl px-4 py-2 text-sm font-medium transition ring-1 ${
                          transferTarget === "withdraw" ? "bg-primary text-white ring-primary" : "bg-card text-subtext ring-ring hover:bg-muted"
                        }`}
                      >
                        Withdraw Wallet
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferTarget("usdt")}
                        className={`rounded-2xl px-4 py-2 text-sm font-medium transition ring-1 ${
                          transferTarget === "usdt" ? "bg-primary text-white ring-primary" : "bg-card text-subtext ring-ring hover:bg-muted"
                        }`}
                      >
                        USDT Wallet (P2P)
                      </button>
                    </div>
                  </div>

                  <label className="grid gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-subtext">Amount to Transfer (USDT)</span>
                      <span className="text-xs font-medium text-primary">Balance: {toUSD(Number(profile?.balance ?? 0))}</span>
                    </div>
                    <input
                      value={internalTransferAmount}
                      onChange={(e) => setInternalTransferAmount(e.target.value)}
                      className="h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="10"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-subtext">Security Code</span>
                    <input
                      type="password"
                      value={p2pSecurityCode}
                      onChange={(e) => setP2pSecurityCode(e.target.value.trim())}
                      className="h-10 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Your Security Code"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={onInternalTransfer}
                    className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
                  >
                    Transfer Now
                  </button>
                  {internalTransferMsg ? (
                    <div className="rounded-2xl bg-muted p-3 text-xs text-subtext ring-1 ring-ring">{internalTransferMsg}</div>
                  ) : null}
                </div>
              </div>
            )}
            {active === "wallet" && walletTab === "p2pHistory" && (
              <div className="rounded-3xl bg-card p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] overflow-hidden">
                <div className="text-sm font-semibold">P2P History</div>
                <div className="mt-4 w-full overflow-x-auto rounded-2xl ring-1 ring-ring custom-scrollbar">
                  <div className="min-w-[500px]">
                    <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] gap-2 bg-muted px-4 py-3 text-xs font-medium text-subtext">
                      <div>Counterparty</div>
                      <div>Direction</div>
                      <div>Amount</div>
                      <div>Date</div>
                    </div>
                    <div className="divide-y divide-[color:var(--ring)]">
                      {p2pItems.map((t: any) => (
                        <div key={t.id} className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] gap-2 px-4 py-4 text-sm">
                          <div className="truncate">{t.counterparty || "-"}</div>
                          <div className="font-medium text-foreground capitalize">{t.direction}</div>
                          <div className="font-medium text-foreground">{Number(t.amount).toFixed(2)}</div>
                          <div className="text-subtext">{String(t.createdAt).slice(0, 10)}</div>
                        </div>
                      ))}
                      {p2pItems.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-subtext">No P2P transfers yet</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/user/p2p-history", { cache: "no-store" });
                        const data = await res.json();
                        if (res.ok) setP2pItems(Array.isArray(data?.items) ? data.items : []);
                      } catch {}
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-full bg-card px-4 text-xs font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            )}
            {active === "income" && (
              <div className="rounded-3xl bg-card p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] overflow-hidden">
                <div className="text-sm font-semibold">Income History</div>
                <div className="mt-1 text-xs text-subtext">Detailed breakdown of referral earnings</div>
                <div className="mt-4 w-full overflow-x-auto rounded-2xl ring-1 ring-ring custom-scrollbar">
                  <div className="min-w-[600px]">
                    <div className="grid grid-cols-[1.5fr_0.8fr_1fr_1fr] gap-2 bg-muted px-4 py-3 text-xs font-medium text-subtext">
                      <div>From User</div>
                      <div>Level</div>
                      <div>Amount</div>
                      <div>Date</div>
                    </div>
                    <div className="divide-y divide-[color:var(--ring)]">
                      {commissionsLoading ? (
                        <div className="px-4 py-6 text-center text-sm text-subtext">Loading history...</div>
                      ) : (
                        <>
                          {commissions.map((c: any) => (
                            <div key={c.id} className="grid grid-cols-[1.5fr_0.8fr_1fr_1fr] gap-2 px-4 py-4 text-sm hover:bg-muted/30 transition">
                              <div className="min-w-0">
                                <div className="font-medium text-foreground truncate">{c.fromUser}</div>
                                <div className="text-[10px] text-subtext truncate">{c.fromEmail}</div>
                              </div>
                              <div className="flex items-center">
                                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-primary/20">
                                  L{c.level}
                                </span>
                              </div>
                              <div className="font-bold text-foreground flex items-center">{toUSD(Number(c.amount))}</div>
                              <div className="text-subtext flex items-center">{new Date(c.date).toLocaleDateString()}</div>
                            </div>
                          ))}
                          {commissions.length === 0 && (
                            <div className="px-4 py-6 text-center text-sm text-subtext">No commission history found</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={async () => {
                      setCommissionsLoading(true);
                      try {
                        const res = await fetch("/api/user/commissions", { cache: "no-store" });
                        const data = await res.json();
                        if (res.ok) setCommissions(Array.isArray(data?.items) ? data.items : []);
                      } catch {} finally { setCommissionsLoading(false); }
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-full bg-card px-4 text-xs font-medium text-foreground ring-1 ring-ring transition hover:bg-muted"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            )}

            {active === "activation" && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-3xl bg-card p-6 shadow-[0_0_15px_rgba(1,163,151,0.15)] ring-1 ring-ring transition-all duration-300 hover:shadow-[0_0_20px_rgba(1,163,151,0.25)] overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-primary uppercase tracking-wider">Starter Plan</div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary ring-1 ring-primary/20">POPULAR</span>
                  </div>
                  {referralGate?.state === "unverified" && gateSecondsLeft > 0 && (
                    <div className="mt-4 rounded-2xl bg-yellow-500/10 p-3 ring-1 ring-yellow-500/20">
                      <div className="text-[10px] font-medium text-yellow-600 uppercase tracking-tight">Activation Deadline</div>
                      <div className="mt-1 flex items-center gap-2">
                        <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-bold text-yellow-700 font-mono">
                          {Math.floor(gateSecondsLeft / 3600)}h {Math.floor((gateSecondsLeft % 3600) / 60)}m {gateSecondsLeft % 60}s
                        </span>
                      </div>
                    </div>
                  )}
                  {referralGate?.state === "unverified" && gateSecondsLeft === 0 && (
                    <div className="mt-4 rounded-2xl bg-red-500/10 p-3 ring-1 ring-red-500/20">
                      <div className="text-[10px] font-medium text-red-600 uppercase tracking-tight">Status</div>
                      <div className="mt-1 flex items-center gap-2">
                        <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-bold text-red-700">PERIOD EXPIRED</span>
                      </div>
                    </div>
                  )}
                  <div className="mt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">$10</span>
                      <span className="text-xs text-subtext">/ one-time</span>
                    </div>
                  </div>
                  <div className="mt-6 space-y-3">
                    {[
                      "Lifetime Activation",
                      "Unlock 20 Levels Commission",
                      "Daily Payout Access",
                      "Priority Support",
                    ].map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-subtext">
                        <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </div>
                    ))}
                  </div>
                  <div className="mt-8">
                    {profile?.status === "active" || profile?.status === "admin" ? (
                      <div className="flex h-11 w-full items-center justify-center rounded-2xl bg-green-500/10 text-sm font-semibold text-green-500 ring-1 ring-green-500/20">
                        ALREADY ACTIVATED
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={onActivate}
                        disabled={activating}
                        className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-white shadow-lg shadow-primary/20 ring-1 ring-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50"
                      >
                        {activating ? (
                          <>
                            <svg className="mr-2 h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Activating...
                          </>
                        ) : (
                          "Activate Account"
                        )}
                      </button>
                    )}
                  </div>
                  <div className="mt-3 text-center text-[10px] text-subtext italic">
                    Note: $10 will be deducted from your main balance
                  </div>
                </div>
              </div>
            )}

            {active === "settings" && (
              <MyProfileSection 
                profile={profile} 
                onProfileUpdate={(updatedData) => setProfile((prev: any) => ({ ...prev, ...updatedData }))} 
                tab={profileTab}
              />
            )}
          </main>
        </div>
      </div>

      {supportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8" role="dialog" aria-modal="true" aria-label="Support">
          <button type="button" onClick={() => setSupportOpen(false)} className="absolute inset-0 bg-black/30" aria-label="Close" />
          <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-xl ring-1 ring-ring">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold">Support</div>
                <div className="mt-1 text-sm text-subtext">Submit payment or account related issues.</div>
              </div>
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground ring-1 ring-ring transition hover:bg-secondary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form
              className="mt-6 grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setUiMessage("");
                try {
                  const res = await fetch("/api/user/support", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subject: supportSubject, message: supportMessage }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    setUiMessage(typeof data?.error === "string" ? data.error : "Support failed");
                    toast.error("Support failed");
                    return;
                  }
                  setUiMessage("Ticket submitted");
                  toast.success("Ticket submitted");
                  setSupportSubject("");
                  setSupportMessage("");
                  setSupportOpen(false);
                } catch {
                  setUiMessage("Support failed");
                  toast.error("Support failed");
                }
              }}
            >
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Subject</span>
                <input
                  required
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  className="h-11 w-full rounded-2xl bg-background px-4 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Payment pending"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Message</span>
                <textarea
                  required
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  className="min-h-[120px] w-full rounded-2xl bg-background px-4 py-3 text-sm text-foreground ring-1 ring-ring outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Details..."
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-sm ring-1 ring-primary/20 transition hover:bg-primary/90"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      ) : null}

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
              <div className="grid gap-1">
                {[
                  { key: "home", label: "Home" },
                  { key: "network", label: "My Network" },
                  { key: "income", label: "Income History" },
                  { key: "activation", label: "Activation Account" },
                ].map((i) => (
                  <button
                    key={i.key}
                    type="button"
                    onClick={() => {
                      setActive(i.key as typeof active);
                      setMobileNavOpen(false);
                      setWalletOpen(false);
                      setProfileOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                      active === i.key ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>{i.label}</span>
                    {active === i.key ? <span className="text-primary">●</span> : null}
                  </button>
                ))}

                <div className="grid gap-1">
                  <button
                    type="button"
                    onClick={() => { setProfileOpen((v) => !v); setWalletOpen(false); }}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                      active === "settings" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>My Profile</span>
                    <span className={`transition-transform ${profileOpen ? "rotate-90" : ""}`}>›</span>
                  </button>
                  <div className={`ml-2 grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ${profileOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="min-h-0 overflow-hidden rounded-2xl bg-background ring-1 ring-ring">
                      {[
                        { key: "profile", label: "Update Profile" },
                        { key: "withdrawAddress", label: "Withdrawal Address" },
                        { key: "security", label: "Security Code" },
                      ].map((sub) => (
                        <button
                          key={sub.key}
                          type="button"
                          onClick={() => {
                            setActive("settings");
                            setProfileTab(sub.key as typeof profileTab);
                            setMobileNavOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition ${
                            active === "settings" && profileTab === sub.key
                              ? "bg-muted text-foreground"
                              : "text-subtext hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <span>{sub.label}</span>
                          {active === "settings" && profileTab === sub.key ? <span className="text-primary">●</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-1">
                  <button
                    type="button"
                    onClick={() => { setWalletOpen((v) => !v); setProfileOpen(false); }}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                      active === "wallet" ? "bg-muted text-foreground" : "text-subtext hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>Wallet</span>
                    <span className={`transition-transform ${walletOpen ? "rotate-90" : ""}`}>›</span>
                  </button>
                  <div className={`ml-2 grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ${walletOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="min-h-0 overflow-hidden rounded-2xl bg-background ring-1 ring-ring">
                      {[
                        { key: "deposit", label: "Deposit Funds" },
                        { key: "depositHistory", label: "Deposit History" },
                        { key: "withdraw", label: "Withdraw Funds" },
                        { key: "withdrawHistory", label: "Withdrawal History" },
                        { key: "p2pTransfer", label: "P2P Fund Transfer" },
                        { key: "internalTransfer", label: "Transfer to Withdraw Wallet" },
                        { key: "p2pHistory", label: "P2P History" },
                      ].map((sub) => (
                        <button
                          key={sub.key}
                          type="button"
                          onClick={() => {
                            setActive("wallet");
                            setWalletTab(sub.key as typeof walletTab);
                            setMobileNavOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition ${
                            active === "wallet" && walletTab === sub.key
                              ? "bg-muted text-foreground"
                              : "text-subtext hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <span>{sub.label}</span>
                          {active === "wallet" && walletTab === sub.key ? <span className="text-primary">●</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 pb-6">
              <div className="text-xs text-subtext">Referral Link</div>
              <div className="mt-2 min-w-0 break-all whitespace-normal rounded-2xl bg-muted px-4 py-3 text-sm text-foreground ring-1 ring-ring">
                {origin ? `${origin}/?ref=${profile?.referrerCode ?? ""}` : profile?.referrerCode ?? "-"}
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (profile?.status !== "admin" && directReferrals >= 2) {
                    toast.error("Max direct referrals reached");
                    return;
                  }
                  const text = origin ? `${origin}/?ref=${profile?.referrerCode ?? ""}` : profile?.referrerCode ?? "";
                  try {
                    await navigator.clipboard.writeText(text);
                    toast.success("Link copied");
                    setMobileNavOpen(false);
                  } catch {
                    toast.error("Copy failed");
                  }
                }}
                disabled={profile?.status !== "admin" && directReferrals >= 2}
                className={`mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl text-sm font-semibold shadow-sm ring-1 transition ${
                  profile?.status !== "admin" && directReferrals >= 2 
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed ring-gray-300" 
                    : "bg-primary text-white ring-primary/20 hover:bg-primary/90"
                }`}
              >
                {(profile?.status !== "admin" && directReferrals >= 2) ? "Max Reached (2/2)" : "Copy Link"}
              </button>

              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-red-600/10 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-600/20 transition hover:bg-red-600/20"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

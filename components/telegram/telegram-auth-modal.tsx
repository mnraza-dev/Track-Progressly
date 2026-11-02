"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  LoaderCircle,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  QrCode,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import {
  sendTelegramLoginCode,
  completeTelegramLogin,
  loginWithTelegramQrCode,
  getStoredTelegramCredentials,
  saveStoredTelegramCredentials,
  type TelegramUserInfo,
} from "@/lib/telegram/mtproto";

interface TelegramAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: (user: TelegramUserInfo) => void;
}

export function TelegramAuthModal({
  open,
  onOpenChange,
  onAuthenticated,
}: TelegramAuthModalProps) {
  const [authMethod, setAuthMethod] = useState<"qr" | "phone">("qr");
  const [step, setStep] = useState<"qr" | "phone" | "code" | "2fa" | "success">(
    "qr",
  );

  // QR Code State
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [qrLoading, setQrLoading] = useState<boolean>(true);
  const qrCancelledRef = useRef<boolean>(false);

  // Phone Login State
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const storedCreds = getStoredTelegramCredentials();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customApiId, setCustomApiId] = useState(String(storedCreds.apiId));
  const [customApiHash, setCustomApiHash] = useState(storedCreds.apiHash);

  // Start QR login flow when dialog opens in QR mode
  useEffect(() => {
    if (!open || authMethod !== "qr") {
      qrCancelledRef.current = true;
      return;
    }

    qrCancelledRef.current = false;
    setQrLoading(true);
    setError("");

    const parsedId = customApiId ? Number(customApiId) : undefined;
    const parsedHash = customApiHash ? customApiHash.trim() : undefined;

    loginWithTelegramQrCode(
      (url) => {
        if (!qrCancelledRef.current) {
          setQrCodeUrl(url);
          setQrLoading(false);
        }
      },
      parsedId,
      parsedHash,
    )
      .then((user) => {
        if (!qrCancelledRef.current) {
          setStep("success");
          setTimeout(() => {
            onAuthenticated(user);
            onOpenChange(false);
          }, 1200);
        }
      })
      .catch((err: any) => {
        if (!qrCancelledRef.current) {
          if (
            err?.message === "SESSION_PASSWORD_NEEDED" ||
            err?.errorMessage === "SESSION_PASSWORD_NEEDED"
          ) {
            setStep("2fa");
          } else {
            setError(
              err?.errorMessage ||
                err?.message ||
                "QR code session expired or failed. Click refresh to retry.",
            );
          }
          setQrLoading(false);
        }
      });

    return () => {
      qrCancelledRef.current = true;
    };
  }, [open, authMethod]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const parsedId = customApiId ? Number(customApiId) : undefined;
      const parsedHash = customApiHash ? customApiHash.trim() : undefined;

      if (parsedId && parsedHash) {
        saveStoredTelegramCredentials(parsedId, parsedHash);
      }

      const res = await sendTelegramLoginCode(
        phone.trim(),
        parsedId,
        parsedHash,
      );
      setPhoneCodeHash(res.phoneCodeHash);
      setStep("code");
    } catch (err: any) {
      setError(
        err?.errorMessage ||
          err?.message ||
          "Could not send code. Check the phone number.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await completeTelegramLogin({
        phoneNumber: phone.trim(),
        phoneCode: code.trim(),
        phoneCodeHash,
        password: password ? password.trim() : undefined,
      });

      setStep("success");
      setTimeout(() => {
        onAuthenticated(user);
        onOpenChange(false);
      }, 1200);
    } catch (err: any) {
      if (err?.message === "2FA_PASSWORD_NEEDED") {
        setStep("2fa");
      } else {
        setError(
          err?.errorMessage ||
            err?.message ||
            "Invalid code. Please check and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await completeTelegramLogin({
        phoneNumber: phone.trim(),
        phoneCode: code.trim(),
        phoneCodeHash,
        password: password.trim(),
      });

      setStep("success");
      setTimeout(() => {
        onAuthenticated(user);
        onOpenChange(false);
      }, 1200);
    } catch (err: any) {
      setError(
        err?.errorMessage ||
          err?.message ||
          "Incorrect 2FA password. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep(authMethod);
    setCode("");
    setPassword("");
    setError("");
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Send size={22} />
            <DialogTitle>Log in to Telegram</DialogTitle>
          </div>
          <DialogDescription>
            Connect your Telegram account to access your private and public
            channels, groups, and lessons.
          </DialogDescription>
        </DialogHeader>

        {/* Auth Method Selector */}
        {step !== "success" && step !== "2fa" && (
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1 text-xs">
            <button
              type="button"
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${
                authMethod === "qr"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setAuthMethod("qr");
                setStep("qr");
                setError("");
              }}
            >
              <QrCode size={14} />
              Quick QR Scan
            </button>
            <button
              type="button"
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${
                authMethod === "phone"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setAuthMethod("phone");
                setStep("phone");
                setError("");
              }}
            >
              <Smartphone size={14} />
              Phone Number
            </button>
          </div>
        )}

        {error && (
          <div
            className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* QR Code Login Mode */}
        {authMethod === "qr" && step === "qr" && (
          <div className="flex flex-col items-center space-y-4 py-2">
            <div className="relative flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-border bg-white p-3 shadow-sm">
              {qrLoading || !qrCodeUrl ? (
                <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
                  <LoaderCircle size={28} className="animate-spin text-primary" />
                  <span>Connecting to Telegram…</span>
                </div>
              ) : (
                <img
                  src={qrCodeUrl}
                  alt="Telegram QR Code"
                  className="h-full w-full object-contain"
                />
              )}
            </div>

            <div className="space-y-1.5 text-center text-xs">
              <p className="font-semibold text-foreground">
                Log in by QR Code
              </p>
              <ol className="space-y-1 text-muted-foreground">
                <li>1. Open the <strong>Telegram</strong> app on your phone</li>
                <li>
                  2. Go to <strong>Settings → Devices → Link Desktop Device</strong>
                </li>
                <li>3. Scan this QR code to log in</li>
              </ol>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQrLoading(true);
                setAuthMethod("qr");
                setStep("qr");
              }}
              disabled={qrLoading}
              className="gap-1.5 text-xs"
            >
              <RefreshCw size={12} className={qrLoading ? "animate-spin" : ""} />
              Refresh QR Code
            </Button>
          </div>
        )}

        {/* Phone Login Mode */}
        {authMethod === "phone" && step === "phone" && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="tg-phone" className="text-sm font-medium">
                Phone Number (with country code)
              </label>
              <Input
                id="tg-phone"
                type="tel"
                placeholder="+1 234 567 8900"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Telegram will send an official login code to your Telegram app.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || !phone.trim()}
            >
              {loading ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  Connecting to Telegram…
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send Login Code
                </>
              )}
            </Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="tg-code" className="text-sm font-medium">
                Telegram Verification Code
              </label>
              <Input
                id="tg-code"
                type="text"
                placeholder="12345"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={loading}
                autoFocus
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Enter the code sent to your Telegram app on phone number {phone}.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-1/3"
                onClick={handleReset}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="w-2/3 gap-2"
                disabled={loading || !code.trim()}
              >
                {loading ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <KeyRound size={16} />
                    Confirm Code
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {step === "2fa" && (
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="tg-pass" className="text-sm font-medium">
                Two-Step Verification Password
              </label>
              <Input
                id="tg-pass"
                type="password"
                placeholder="Your 2FA cloud password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Your Telegram account is protected with a 2FA cloud password.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || !password.trim()}
            >
              {loading ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  Verifying 2FA…
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Complete Login
                </>
              )}
            </Button>
          </form>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2
              size={48}
              className="animate-in zoom-in text-green-500"
            />
            <h3 className="mt-3 text-lg font-semibold">Connected Successfully</h3>
            <p className="text-sm text-muted-foreground">
              You can now browse and import your private and public Telegram channels.
            </p>
          </div>
        )}

        {/* Optional Advanced Settings */}
        {step !== "success" && (
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Advanced API Credentials (Optional)</span>
              {showAdvanced ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
            {showAdvanced && (
              <div className="mt-2 space-y-2 rounded-md border p-3 text-xs">
                <div>
                  <label className="font-medium">API ID</label>
                  <Input
                    type="number"
                    value={customApiId}
                    onChange={(e) => setCustomApiId(e.target.value)}
                    placeholder="e.g. 2496"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium">API Hash</label>
                  <Input
                    type="text"
                    value={customApiHash}
                    onChange={(e) => setCustomApiHash(e.target.value)}
                    placeholder="e.g. 8da85b0d5..."
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Defaults to official Telegram Web credentials. You can also use
                  custom credentials from my.telegram.org.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

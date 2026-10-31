import { promises as dns } from "dns";

// Free, local "is this a real mailbox domain?" checks. (Proof that the person OWNS the address comes from the
// verification code; these checks just reject obvious junk before we spend an email on it.)
let disposable: Set<string> | null = null;
const list = (): Set<string> => (disposable ??= new Set<string>(require("disposable-email-domains") as string[]));

/** True for throwaway-mail domains such as mailinator.com, including their subdomains. */
export function isDisposable(domain: string): boolean {
  const parts = domain.toLowerCase().split(".");
  for (let i = 0; i < parts.length - 1; i++) if (list().has(parts.slice(i).join("."))) return true;
  return false;
}

const resolver = new dns.Resolver({ timeout: 3000, tries: 2 });
const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA"]);

export type EmailVerdict = { ok: true } | { ok: false; reason: string };

export async function checkEmailDomain(email: string): Promise<EmailVerdict> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || !domain.includes(".")) return { ok: false, reason: "Enter a valid email address" };
  if (isDisposable(domain)) return { ok: false, reason: "Temporary or disposable email addresses are not allowed" };
  try {
    const mx = await resolver.resolveMx(domain);
    // A lone "." MX is the standard way for a domain to say "we accept no mail".
    if (mx.length > 0 && mx.some((m) => m.exchange && m.exchange !== ".")) return { ok: true };
    if (mx.length > 0) return { ok: false, reason: "That email domain does not accept mail" };
  } catch (e) {
    if (!NOT_FOUND.has((e as NodeJS.ErrnoException).code ?? "")) return { ok: true }; // DNS hiccup: don't block a real user
  }
  try { // no MX record: mail servers fall back to the domain's own address
    await resolver.resolve4(domain);
    return { ok: true };
  } catch (e) {
    if (NOT_FOUND.has((e as NodeJS.ErrnoException).code ?? "")) return { ok: false, reason: "That email domain does not exist" };
    return { ok: true };
  }
}

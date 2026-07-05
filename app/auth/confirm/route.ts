import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link landing. Supabase can deliver the login proof two ways
// depending on email-template/flow settings — handle both:
//   ?code=...                       (PKCE flow — default)
//   ?token_hash=...&type=email      (token-hash template)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(
    new URL("/login?error=link_invalid_or_expired", request.url)
  );
}

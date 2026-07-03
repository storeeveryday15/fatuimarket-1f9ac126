import { createFileRoute } from "@tanstack/react-router";

// Notify owner about an order event via Telegram + Email (Resend).
// Events: created | screenshot_uploaded | processing | completed | rejected
// Authentication: called from server-side after sensitive ops or
// fire-and-forget from client after creating a row that the caller owns.

type EventType = "created" | "screenshot_uploaded" | "processing" | "completed" | "rejected";

const SUBJECTS: Record<EventType, string> = {
  created: "New order received",
  screenshot_uploaded: "Payment screenshot uploaded",
  processing: "Order is being processed",
  completed: "Order completed",
  rejected: "Order rejected",
};

const CUSTOMER_INTRO: Record<EventType, string> = {
  created: "Thanks for your order at Fatui Market! We've received it and you'll get an update shortly.",
  screenshot_uploaded: "Thanks for uploading your payment screenshot. Our team will verify and process your order soon.",
  processing: "Good news — your order is now being processed and will be delivered shortly.",
  completed: "Your order is complete. Enjoy your top-up!",
  rejected: "Your order was rejected. Please review the admin notes on your dashboard or contact support.",
};

export const Route = createFileRoute("/api/public/notify-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require caller auth: Bearer token from Supabase session.
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        if (!token) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        let body: { order_code?: string; event?: EventType } = {};
        try { body = await request.json(); } catch { /* ignore */ }
        const code = body.order_code;
        const event: EventType = (body.event ?? "created") as EventType;
        if (!code || typeof code !== "string") {
          return Response.json({ ok: false, error: "missing order_code" }, { status: 400 });
        }
        if (!SUBJECTS[event]) {
          return Response.json({ ok: false, error: "invalid event" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Validate the caller
        const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userRes?.user) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        const callerId = userRes.user.id;

        // Check admin role
        const { data: adminRow } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId)
          .eq("role", "admin")
          .maybeSingle();
        const isAdmin = !!adminRow;
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("order_code, product_name, tier_label, amount_inr, amount_usd, currency, region, customer_email, game_id, status, created_at, admin_notes, user_id")
          .eq("order_code", code)
          .maybeSingle();
        if (!order) {
          return Response.json({ ok: false, error: "not found" }, { status: 404 });
        }

        // Authorize: caller must own the order or be admin.
        if (!isAdmin && order.user_id !== callerId) {
          return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
        }


        const amount = order.currency === "INR" ? `₹${order.amount_inr}` : `$${order.amount_usd}`;
        const subject = `${SUBJECTS[event]} — ${order.order_code}`;
        const lines = [
          `Order: ${order.order_code}`,
          `Product: ${order.product_name} — ${order.tier_label}`,
          `Amount: ${amount} (${order.currency})`,
          order.game_id ? `Game ID: ${order.game_id}` : "",
          order.customer_email ? `Email: ${order.customer_email}` : "",
          `Status: ${order.status}`,
          order.admin_notes ? `Notes: ${order.admin_notes}` : "",
        ].filter(Boolean);

        const ownerText = `🛒 [${event.toUpperCase()}]\n${subject}\n\n${lines.join("\n")}`;

        const results: Record<string, unknown> = { event };

        const tgToken = process.env.TELEGRAM_BOT_TOKEN;
        const tgChat = process.env.TELEGRAM_CHAT_ID;
        if (tgToken && tgChat) {
          try {
            const r = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ chat_id: tgChat, text: ownerText }),
            });
            results.telegram = r.ok ? "sent" : `failed:${r.status}`;
          } catch (e) {
            results.telegram = `error:${(e as Error).message}`;
          }
        } else {
          results.telegram = "skipped";
        }

        const resendKey = process.env.RESEND_API_KEY;
        const notifyEmail = process.env.ADMIN_EMAIL || process.env.NOTIFY_EMAIL || "fatuimarket@gmail.com";
        if (resendKey) {
          const ownerHtml = `<h2>${subject}</h2><pre style="font-family:ui-monospace,monospace;background:#f6f8fa;padding:12px;border-radius:8px">${lines.join("\n")}</pre>`;
          const send = async (to: string, subj: string, html: string) => {
            try {
              const r = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${resendKey}` },
                body: JSON.stringify({
                  from: "Fatui Market <onboarding@resend.dev>",
                  to: [to],
                  subject: subj,
                  html,
                }),
              });
              return r.ok ? "sent" : `failed:${r.status}`;
            } catch (e) { return `error:${(e as Error).message}`; }
          };
          results.email_owner = await send(notifyEmail, `[Fatui] ${subject}`, ownerHtml);
          if (order.customer_email) {
            const customerHtml = `
              <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
                <h2 style="margin:0 0 8px">${SUBJECTS[event]}</h2>
                <p style="color:#555">${CUSTOMER_INTRO[event]}</p>
                <div style="background:#f6f8fa;padding:14px;border-radius:10px;margin-top:12px">
                  <div><b>Order ID:</b> ${order.order_code}</div>
                  <div><b>Product:</b> ${order.product_name} — ${order.tier_label}</div>
                  <div><b>Amount:</b> ${amount}</div>
                  <div><b>Status:</b> ${order.status.replace(/_/g, " ")}</div>
                </div>
                ${order.admin_notes ? `<p><b>Admin notes:</b> ${order.admin_notes}</p>` : ""}
                <p style="color:#777;font-size:12px;margin-top:24px">— Fatui Market</p>
              </div>`;
            results.email_customer = await send(order.customer_email, subject, customerHtml);
          }
        } else {
          results.email = "skipped";
        }

        return Response.json({ ok: true, results });
      },
    },
  },
});

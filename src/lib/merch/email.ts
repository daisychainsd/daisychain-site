import { Resend } from "resend";
import { getOrderBySession } from "./orders";
import { orderLabel } from "./types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function alertMerchIssue(key: string, message: string) {
  console.error("Merch needs attention:", message);
  if (!process.env.RESEND_API_KEY) return;
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: "Daisy Chain Recordings <noreply@daisychainsd.com>",
    to: process.env.ALERT_EMAIL || "playerdave@daisychainsd.com",
    subject: "[ALERT] Merch needs attention", text: message,
  }, { idempotencyKey: `merch-alert-${key}` });
  if (error) throw new Error(error.message);
}

export async function confirmMerchOrder(sessionId: string) {
  const order = await getOrderBySession(sessionId);
  if (!order || !order.livemode || !order.email || order.confirmation_email_sent_at || !process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: "Daisy Chain Recordings <noreply@daisychainsd.com>", to: order.email,
    subject: `Order received — ${orderLabel(order)}`,
    text: `Thanks for your order.\n\n${orderLabel(order)}\n${order.items.map((i) => `${i.quantity} × ${i.title} / ${i.variant_title}`).join("\n")}\n\nTotal: ${new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency }).format(order.total_cents / 100)}\n\nQuestions? Reply to playerdave@daisychainsd.com.\n\nDaisy Chain Recordings`,
    replyTo: "playerdave@daisychainsd.com",
  }, { idempotencyKey: `merch-confirmation-${sessionId}` });
  if (error) throw new Error(`Order confirmation failed: ${error.message}`);
  const { error: saveError } = await createAdminClient().from("merch_orders")
    .update({ confirmation_email_sent_at: new Date().toISOString() }).eq("id", order.id);
  if (saveError) throw new Error(saveError.message);
}

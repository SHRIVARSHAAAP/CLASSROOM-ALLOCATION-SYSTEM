import { createHmac, timingSafeEqual } from "node:crypto";

export function whatsappPhone(value: string) {
  const phone = value.trim().replace(/[ ()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Use your WhatsApp number with country code, for example +91 followed by your 10-digit number.");
  return phone;
}
export function validWhatsappSignature(body: string, signature: string | null, secret: string) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export function templatePayload(phone: string, name: string, language: string, title: string, body: string) {
  return {
    messaging_product: "whatsapp", to: whatsappPhone(phone).slice(1), type: "template",
    template: { name, language: { code: language }, components: [
      { type: "body", parameters: [{ type: "text", text: (title + ": " + body).replace(/\s+/g, " ").slice(0, 900) }] },
    ] },
  };
}

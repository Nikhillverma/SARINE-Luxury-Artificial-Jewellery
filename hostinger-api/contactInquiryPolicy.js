const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\d\s.-]{7,24}$/;
function cleanText(value, maxLength) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}
export function validateContactInquiry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Enter your contact details and message.");
  const name = cleanText(input.name, 120).replace(/\s+/g, " ");
  const email = cleanText(input.email, 254).toLowerCase();
  const phone = cleanText(input.phone, 24);
  const subject = cleanText(input.subject, 160).replace(/\s+/g, " ");
  const rawMessage = String(input.message ?? "").replace(/\u0000/g, "").trim().replace(/\r\n?/g, "\n");
  if (rawMessage.length > 5000) throw new Error("Your message is too long.");
  const message = rawMessage;
  if (name.length < 2) throw new Error("Enter your full name.");
  if (!EMAIL_PATTERN.test(email)) throw new Error("Enter a valid email address.");
  if (phone && !PHONE_PATTERN.test(phone)) throw new Error("Enter a valid phone number, or leave it blank.");
  if (message.length < 10) throw new Error("Please enter a message of at least 10 characters.");
  return { name, email, phone: phone || null, subject: subject || null, message };
}
export function normalizeInquiryStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  return ["new", "reviewed", "closed"].includes(status) ? status : null;
}

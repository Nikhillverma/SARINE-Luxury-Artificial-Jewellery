const EMPTY_ANNOUNCEMENT = Object.freeze({ message: "", active: false, trustMessages: [] });

export function normalizeAnnouncementSettings(value) {
  let parsed = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { parsed = null; }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...EMPTY_ANNOUNCEMENT, trustMessages: [] };
  }
  const trustMessages = Array.isArray(parsed.trustMessages)
    ? parsed.trustMessages
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((item) => item.slice(0, 100))
    : [];
  return {
    message: typeof parsed.message === "string" ? parsed.message : "",
    active: parsed.active === true,
    trustMessages
  };
}

export function buildAnnouncementSettings(input, existingValue) {
  const existing = normalizeAnnouncementSettings(existingValue);
  const message = String(input?.message || "").trim();
  if (message.length > 300) throw new Error("Announcement must be 300 characters or fewer.");

  let trustMessages = existing.trustMessages;
  if (Object.prototype.hasOwnProperty.call(input || {}, "trustMessages")) {
    if (!Array.isArray(input.trustMessages)) {
      throw new Error("Trust messages must be provided as a list.");
    }
    if (input.trustMessages.length > 3 || input.trustMessages.some(
      (item) => typeof item !== "string" || item.trim().length > 100
    )) {
      throw new Error("Enter up to three trust messages, each 100 characters or fewer.");
    }
    trustMessages = input.trustMessages.map((item) => item.trim()).filter(Boolean);
  }

  return { message, active: input?.active === true, trustMessages };
}

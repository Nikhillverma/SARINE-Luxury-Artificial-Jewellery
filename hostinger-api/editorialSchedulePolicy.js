const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function validUtc(value, label) {
  if (typeof value !== "string" || !ISO_UTC.test(value)) {
    throw Object.assign(new Error(label + " must be a valid UTC date and time."), { status: 400 });
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw Object.assign(new Error(label + " must be a valid UTC date and time."), { status: 400 });
  }
  return date;
}

export function createEditorialSchedule(input, draft, published, now = new Date()) {
  const startsAt = validUtc(input?.startsAtUtc, "Start date");
  const endsAt = input?.endsAtUtc ? validUtc(input.endsAtUtc, "End date") : null;
  if (startsAt.getTime() <= now.getTime()) {
    throw Object.assign(new Error("Choose a future publication date and time."), { status: 400 });
  }
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw Object.assign(new Error("Expiry date and time must be later than publication."), { status: 400 });
  }
  return {
    startsAtUtc: startsAt.toISOString(),
    endsAtUtc: endsAt?.toISOString() || null,
    content: draft,
    previousPublished: published
  };
}

export function normalizeEditorialSchedule(value) {
  if (!value || typeof value !== "object") return null;
  try {
    const startsAt = validUtc(value.startsAtUtc, "Start date");
    const endsAt = value.endsAtUtc ? validUtc(value.endsAtUtc, "End date") : null;
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) return null;
    if (!value.content || typeof value.content !== "object" || !value.previousPublished || typeof value.previousPublished !== "object") return null;
    return {
      startsAtUtc: startsAt.toISOString(),
      endsAtUtc: endsAt?.toISOString() || null,
      content: value.content,
      previousPublished: value.previousPublished
    };
  } catch {
    return null;
  }
}

export function getEditorialScheduleStatus(schedule, now = new Date()) {
  if (!schedule) return "none";
  const current = now.getTime();
  if (current < new Date(schedule.startsAtUtc).getTime()) return "scheduled";
  if (schedule.endsAtUtc && current >= new Date(schedule.endsAtUtc).getTime()) return "expired";
  return "published";
}

export function getEffectiveEditorial(record, now = new Date()) {
  if (!record.schedule) return record.published;
  const status = getEditorialScheduleStatus(record.schedule, now);
  if (status === "published") return record.schedule.content;
  if (status === "expired") return record.schedule.previousPublished;
  return record.published;
}

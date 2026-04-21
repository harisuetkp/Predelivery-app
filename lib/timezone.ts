// Puerto Rico uses Atlantic Standard Time (AST)
// UTC-4 year-round, NO Daylight Saving Time
// IANA: America/Puerto_Rico
// DO NOT use America/New_York - applies DST
// DO NOT use 'Eastern' - wrong in winter months

export const PR_TIMEZONE = 'America/Puerto_Rico'
export const PR_LOCALE = 'es-PR'

// Format a date/time for display in PR time
export function formatPRDateTime(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(PR_LOCALE, {
    timeZone: PR_TIMEZONE,
    ...options
  }).format(new Date(date))
}

// Format date only
export function formatPRDate(date: string | Date): string {
  return formatPRDateTime(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Format short date (e.g., "13 abr 2026")
export function formatPRDateShort(date: string | Date): string {
  return formatPRDateTime(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Format time only
export function formatPRTime(date: string | Date): string {
  return formatPRDateTime(date, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Format date + time together
export function formatPRDateTimeFull(date: string | Date): string {
  return formatPRDateTime(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Get current PR time as Date object
export function getPRNow(): Date {
  return new Date(
    new Date().toLocaleString('en-US', {
      timeZone: PR_TIMEZONE
    })
  )
}

// Convert a date string to PR timezone Date
export function toPRDate(date: string | Date): Date {
  return new Date(
    new Date(date).toLocaleString('en-US', {
      timeZone: PR_TIMEZONE
    })
  )
}

// Format relative time (e.g., "hace 5 minutos")
export function formatPRRelativeTime(date: string | Date): string {
  const now = getPRNow()
  const then = toPRDate(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'ahora'
  if (diffMins < 60) return `hace ${diffMins} min`
  if (diffHours < 24) return `hace ${diffHours}h`
  if (diffDays < 7) return `hace ${diffDays}d`
  return formatPRDateShort(date)
}

// Format weekday + date (e.g., "domingo, 13 de abril")
export function formatPRWeekdayDate(date: string | Date): string {
  return formatPRDateTime(date, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

// Format for order timestamps (compact: "13 abr, 7:00 PM")
export function formatPROrderTimestamp(date: string | Date): string {
  return formatPRDateTime(date, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

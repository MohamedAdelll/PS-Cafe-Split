export function calcPersonCost(person, intervals, now) {
  if (!person.joined_at) return 0
  let total = 0
  const personEnd = person.left_at || now
  for (const iv of intervals) {
    const ivEnd = iv.ended_at || now
    const overlapStart = Math.max(iv.started_at, person.joined_at)
    const overlapEnd   = Math.min(ivEnd, personEnd)
    if (overlapEnd > overlapStart) {
      const durMs = overlapEnd - overlapStart
      const ratePerPerson = iv.rate_per_hour / iv.people_count
      total += ratePerPerson * (durMs / 3_600_000)
    }
  }
  return total
}

export function fmtEGP(val) {
  return 'EGP ' + val.toFixed(2)
}

export function fmtDuration(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export function fmtClock(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  return [h, m % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':')
}

export function initials(name) {
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const COLORS = ['#0070d1','#7c3aed','#db2777','#d97706','#059669','#dc2626','#0891b2','#65a30d']
export function avatarColor(name) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % COLORS.length
  return COLORS[h]
}

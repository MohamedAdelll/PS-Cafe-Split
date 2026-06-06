import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import s from './HomeView.module.css'

export default function HomeView() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('create')
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function createGroup() {
    const r = parseFloat(rate)
    if (!name.trim() || isNaN(r) || r <= 0) return setError('Enter a valid name and hourly rate.')
    setLoading(true); setError('')
    try {
      const g = await api.createGroup(name.trim(), r)
      navigate(`/group/${g.id}`)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function joinGroup() {
    const code = joinCode.trim()
    if (!code) return setError('Enter a group code.')
    setLoading(true); setError('')
    try {
      await api.getGroup(code)
      navigate(`/group/${code}`)
    } catch { setError('Group not found. Check the code.') }
    setLoading(false)
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.logo}>🎮</div>
        <div>
          <h1 className={s.title}>PS Café Split</h1>
          <p className={s.sub}>fair billing for your squad</p>
        </div>
      </div>

      <div className={s.tabs}>
        {['create','join'].map(t => (
          <button key={t} className={s.tab + (tab === t ? ' ' + s.active : '')} onClick={() => { setTab(t); setError('') }}>
            {t === 'create' ? 'New Group' : 'Join Group'}
          </button>
        ))}
      </div>

      <div className={s.card}>
        {tab === 'create' ? (
          <>
            <label className={s.label}>Group name</label>
            <input className={s.input} placeholder="e.g. Ahmed's Squad" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createGroup()} />
            <label className={s.label} style={{ marginTop: 14 }}>Hourly rate (EGP / hr)</label>
            <input className={s.input} type="number" placeholder="e.g. 60" value={rate} onChange={e => setRate(e.target.value)} onKeyDown={e => e.key === 'Enter' && createGroup()} />
            <button className={s.btnPrimary} onClick={createGroup} disabled={loading} style={{ marginTop: 16, width: '100%' }}>
              {loading ? 'Creating…' : 'Create Group →'}
            </button>
          </>
        ) : (
          <>
            <label className={s.label}>Group code</label>
            <input className={s.input} placeholder="Paste the code your friend shared" value={joinCode} onChange={e => setJoinCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && joinGroup()} />
            <button className={s.btnPrimary} onClick={joinGroup} disabled={loading} style={{ marginTop: 14, width: '100%' }}>
              {loading ? 'Looking up…' : 'Open Group →'}
            </button>
          </>
        )}
        {error && <p className={s.error}>{error}</p>}
      </div>

      <p className={s.hint}>
        Share your group code with anyone — they can join from any device.
      </p>
    </div>
  )
}

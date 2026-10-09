import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen,
  Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, CloudSun, CreditCard,
  Flower2, Heart, LayoutDashboard, ListTodo, Menu, Moon, MoreHorizontal,
  Plus, Search, Settings2, ShieldCheck, Sparkles, Target, Wind, X
} from 'lucide-react'

type Section = 'Today' | 'Planner' | 'Goals' | 'Wellbeing' | 'Finance' | 'Reviews' | 'Anxiety Tracker' | 'Breathe & Focus'
type Task = { id: number; title: string; time: string; category: string; done: boolean; scope?: 'today' | 'planner'; date?: string }
type CalendarEvent = { id: number; title: string; date: string; time: string; reminderMinutes: number; notifiedKey?: string }
type DailyRecord = { date: string; tasksTotal: number; tasksCompleted: number; mood: string; energy: number; stress: number; reflection: string; updatedAt: string }
const nav: { name: Section; icon: typeof LayoutDashboard }[] = [
  { name: 'Today', icon: LayoutDashboard }, { name: 'Planner', icon: ListTodo },
  { name: 'Goals', icon: Target }, { name: 'Wellbeing', icon: Heart },
  { name: 'Finance', icon: CreditCard }, { name: 'Reviews', icon: BookOpen },
]
const extras: { name: Section; icon: typeof Wind }[] = [
  { name: 'Anxiety Tracker', icon: Activity }, { name: 'Breathe & Focus', icon: Wind },
]
const initialTasks: Task[] = [
  { id: 1, title: 'A gentle start — water & breakfast', time: '09:00', category: 'Personal', done: true },
  { id: 2, title: 'Choose the one thing that matters', time: '10:00', category: 'Focus', done: false },
  { id: 3, title: 'Take a short walk outside', time: '12:30', category: 'Wellbeing', done: false },
  { id: 4, title: 'Review today’s spending', time: '17:00', category: 'Finance', done: false },
]
function tehranDateTimeToDate(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  let timestamp = targetAsUtc
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  // Resolve the requested Tehran wall-clock time to an absolute instant, independent of device timezone.
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]))
    const representedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
    timestamp += targetAsUtc - representedAsUtc
  }
  return new Date(timestamp)
}
const tehranDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' }).formatToParts(date)
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
function normalizeTasks(tasks: Task[]): Task[] {
  const today = tehranDateKey()
  return tasks.map(task => ({ ...task, scope: task.scope ?? 'today', date: task.date ?? today }))
}
const STORAGE_KEY = 'personal-os:v1'
type SavedState = { tasks: Task[]; events?: CalendarEvent[]; mood: string; energy: number; stress: number; reflection: string; goal: string; financeNote: string; reflections: Record<string, string>; history?: Record<string, DailyRecord>; finance: { income: string; essentials: string; commitments: string } }
function loadSavedState(): Partial<SavedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Partial<SavedState> : {}
  } catch { return {} }
}

export default function App() {
  const [section, setSection] = useState<Section>('Today')
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const [tasks, setTasks] = useState<Task[]>(() => normalizeTasks(loadSavedState().tasks ?? initialTasks))
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadSavedState().events ?? [])
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState(() => tehranDateKey())
  const [eventTime, setEventTime] = useState('09:00')
  const [eventReminder, setEventReminder] = useState(10)
  const [notificationsAllowed, setNotificationsAllowed] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted')
  const [newTask, setNewTask] = useState('')
  const [planDate, setPlanDate] = useState(() => tehranDateKey())
  const [adding, setAdding] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [mood, setMood] = useState(() => loadSavedState().mood ?? 'Okay')
  const [energy, setEnergy] = useState(() => loadSavedState().energy ?? 3)
  const [stress, setStress] = useState(() => loadSavedState().stress ?? 3)
  const [reflection, setReflection] = useState(() => loadSavedState().reflection ?? '')
  const [goal, setGoal] = useState(() => loadSavedState().goal ?? '')
  const [financeNote, setFinanceNote] = useState(() => loadSavedState().financeNote ?? '')
  const [reflections, setReflections] = useState<Record<string, string>>(() => loadSavedState().reflections ?? {})
  const [history, setHistory] = useState<Record<string, DailyRecord>>(() => loadSavedState().history ?? {})
  const [breathing, setBreathing] = useState(false)
  const [notice, setNotice] = useState('')
  const [finance, setFinance] = useState(() => loadSavedState().finance ?? { income: '0', essentials: '0', commitments: '0' })
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [cloudPanel, setCloudPanel] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [cloudMessage, setCloudMessage] = useState('')
  const [cloudReady, setCloudReady] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, events, mood, energy, stress, reflection, goal, financeNote, reflections, history, finance } satisfies SavedState)) }
    catch { /* Storage may be unavailable in private browsing; the app remains usable for this session. */ }
  }, [tasks, events, mood, energy, stress, reflection, goal, financeNote, reflections, history, finance])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(open => !open)
      }
      if (event.key === 'Escape') { setSearchOpen(false); setCloudPanel(false) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => { if (alive) setUser(data.session?.user ?? null) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) { setUser(session?.user ?? null); setCloudReady(false) }
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !user) { setCloudReady(false); return }
    let alive = true
    setCloudReady(false)
    supabase.from('user_workspace').select('data').eq('user_id', user.id).maybeSingle().then(({ data, error }) => {
      if (!alive) return
      if (error) setCloudMessage('Cloud data could not be loaded. Local data remains available.')
      else if (data?.data) {
        const saved = data.data as Partial<SavedState>
        if (saved.tasks) setTasks(normalizeTasks(saved.tasks))
        if (saved.events) setEvents(saved.events)
        if (saved.mood) setMood(saved.mood)
        if (saved.energy !== undefined) setEnergy(saved.energy)
        if (saved.stress !== undefined) setStress(saved.stress)
        if (saved.reflection !== undefined) setReflection(saved.reflection)
        if (saved.goal !== undefined) setGoal(saved.goal)
        if (saved.financeNote !== undefined) setFinanceNote(saved.financeNote)
        if (saved.reflections) setReflections(saved.reflections)
        if (saved.history) setHistory(saved.history)
        if (saved.finance) setFinance(saved.finance)
      }
      setCloudReady(true)
    })
    return () => { alive = false }
  }, [user?.id])

  useEffect(() => {
    const client = supabase
    if (!client || !user || !cloudReady) return
    const timer = window.setTimeout(async () => {
      const payload = { tasks, events, mood, energy, stress, reflection, goal, financeNote, reflections, history, finance }
      const { error } = await client.from('user_workspace').upsert({ user_id: user.id, data: payload }, { onConflict: 'user_id' })
      setCloudMessage(error ? 'Cloud sync issue. Your data is still saved on this device.' : 'Synced securely to your private account.')
    }, 650)
    return () => window.clearTimeout(timer)
  }, [user?.id, cloudReady, tasks, events, mood, energy, stress, reflection, goal, financeNote, reflections, history, finance])

  async function sendSignInLink() {
    if (!supabase) return
    if (!email.trim()) { setCloudMessage('Enter your email address first.'); return }
    const redirectUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectUrl } })
    setCloudMessage(error ? error.message : 'Sign-in link sent. Open the email on this device to connect your account.')
  }

  const todayKey = tehranDateKey(clock)
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Tehran' }).format(clock), [clock])
  const todayTasks = tasks.filter(t => (t.scope ?? 'today') === 'today' && (t.date ?? todayKey) === todayKey)
  const completed = todayTasks.filter(t => t.done).length
  useEffect(() => {
    const record: DailyRecord = { date: todayKey, tasksTotal: todayTasks.length, tasksCompleted: completed, mood, energy, stress, reflection: reflections[todayKey] ?? reflection, updatedAt: new Date().toISOString() }
    setHistory(previous => {
      const old = previous[todayKey]
      const same = old && old.tasksTotal === record.tasksTotal && old.tasksCompleted === record.tasksCompleted && old.mood === record.mood && old.energy === record.energy && old.stress === record.stress && old.reflection === record.reflection
      return same ? previous : { ...previous, [todayKey]: record }
    })
  }, [todayKey, todayTasks.length, completed, mood, energy, stress, reflection, reflections])
  const recentRecords = useMemo(() => Object.values(history).sort((a, b) => b.date.localeCompare(a.date)), [history])
  const weekRecords = useMemo(() => {
    const end = new Date(`${todayKey}T12:00:00Z`)
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(end); d.setUTCDate(d.getUTCDate() - index)
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
      return history[key]
    }).filter((record): record is DailyRecord => Boolean(record))
  }, [history, todayKey])
  const weekTaskTotal = weekRecords.reduce((sum, record) => sum + record.tasksTotal, 0)
  const weekTaskDone = weekRecords.reduce((sum, record) => sum + record.tasksCompleted, 0)
  const averageEnergy = weekRecords.length ? (weekRecords.reduce((sum, record) => sum + record.energy, 0) / weekRecords.length).toFixed(1) : '—'
  const averageStress = weekRecords.length ? (weekRecords.reduce((sum, record) => sum + record.stress, 0) / weekRecords.length).toFixed(1) : '—'
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const searchResults = normalizedQuery ? [
    ...tasks.filter(t => `${t.title} ${t.category} ${t.time} ${t.date ?? ''}`.toLowerCase().includes(normalizedQuery)).map(t => ({ title: t.title, detail: `${t.scope === 'planner' ? 'Planner' : 'Today'} · ${t.category}`, section: (t.scope === 'planner' ? 'Planner' : 'Today') as Section })),
    ...([{ title: 'Goals & intentions', text: goal, section: 'Goals' as Section }, { title: 'Finance note', text: financeNote, section: 'Finance' as Section }, { title: 'Daily reflection', text: reflections[todayKey] ?? reflection, section: 'Reviews' as Section }].filter(item => item.text.toLowerCase().includes(normalizedQuery)).map(item => ({ title: item.title, detail: item.text.slice(0, 90), section: item.section })))
  ].slice(0, 8) : []
  const greeting = useMemo(() => {
    const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Tehran' }).format(clock))
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  }, [clock])

  function addTask() {
    if (!newTask.trim()) return
    setTasks(old => [...old, { id: Date.now(), title: newTask.trim(), time: 'Anytime', category: 'Personal', done: false, scope: section === 'Planner' ? 'planner' : 'today', date: section === 'Planner' ? planDate : todayKey }])
    setNewTask(''); setAdding(false)
  }
  async function enableNotifications() {
    if (!('Notification' in window)) { notify('This browser does not support system notifications. Try opening the app in Chrome.'); return }
    try {
      const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
      setNotificationsAllowed(permission === 'granted')
      if (permission !== 'granted') {
        notify(permission === 'denied' ? 'Notifications are blocked for this site. Open browser site settings and allow notifications.' : 'Notification permission was not granted.')
        return
      }
      const test = new Notification('Personal OS notifications are working', { body: 'You will receive reminders while this app is open.', tag: 'personal-os-notification-test' })
      test.onclick = () => { window.focus(); test.close() }
      notify('Test notification sent. If it did not appear, check this site’s notification permission and your device notification settings.')
    } catch (error) {
      notify(error instanceof Error ? `Could not send notification: ${error.message}` : 'Could not send notification. Check browser and device notification settings.')
    }
  }
  function addCalendarEvent() {
    if (!eventTitle.trim()) { notify('Add a title for this event first.'); return }
    const event: CalendarEvent = { id: Date.now(), title: eventTitle.trim(), date: eventDate, time: eventTime, reminderMinutes: eventReminder }
    setEvents(old => [...old, event].sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)))
    setEventTitle('')
    notify('Calendar event saved using Tehran time. Keep Personal OS open for its reminder.')
  }
  const notifiedEvents = useRef<Set<string>>(new Set())
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date()
      events.forEach(event => {
        const dueAt = tehranDateTimeToDate(event.date, event.time)
        const remindAt = new Date(dueAt.getTime() - event.reminderMinutes * 60_000)
        const reminderKey = `${event.id}-${event.date}T${event.time}`
        const lateWindowEnd = new Date(dueAt.getTime() + 15 * 60_000)
        if (now >= remindAt && now <= lateWindowEnd && event.notifiedKey !== `${event.date}T${event.time}` && !notifiedEvents.current.has(reminderKey)) {
          notifiedEvents.current.add(reminderKey)
          const body = `Scheduled for ${event.time} Tehran time · ${event.date}`
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              const notification = new Notification(event.title, { body, tag: `personal-os-${event.id}` })
              notification.onclick = () => { window.focus(); notification.close() }
            } else {
              setNotice(`Reminder: ${event.title} · ${event.time}`)
            }
          } catch {
            setNotice(`Reminder: ${event.title} · ${event.time}. Check browser notification permissions.`)
          }
          setEvents(current => current.map(item => item.id === event.id ? { ...item, notifiedKey: `${event.date}T${event.time}` } : item))
        }
      })
    }
    checkReminders()
    const timer = window.setInterval(checkReminders, 5_000)
    return () => window.clearInterval(timer)
  }, [events])
  function selectSection(name: Section) {
    setSection(name); setMobileMenu(false); setNotice('')
  }
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3200) }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={21}/></div><div><strong>personal<span>.</span>os</strong><small>YOUR SPACE, YOUR PACE</small></div><button className="icon-btn close-menu" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18}/></button></div>
      <button className="workspace" onClick={() => notify('Personal space · Settings will be available in a later step')}><div className="avatar">M</div><div><b>My personal space</b><small>Private workspace</small></div><ChevronDown size={15}/></button>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(item => <button key={item.name} className={`nav-item ${section === item.name ? 'active' : ''}`} onClick={() => selectSection(item.name)}><item.icon size={18}/><span>{item.name}</span>{item.name === 'Today' && <span className="nav-count">{todayTasks.filter(t => !t.done).length}</span>}</button>)}</nav>
      <div className="nav-label tools-label">PERSONAL TOOLS</div>
      <nav>{extras.map(item => <button key={item.name} className={`nav-item ${section === item.name ? 'active' : ''}`} onClick={() => selectSection(item.name)}><item.icon size={18}/><span>{item.name}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="calm-card"><div className="calm-icon"><Flower2 size={19}/></div><b>A little reminder</b><p>You don’t have to do everything. Just the next kind thing.</p><span>ONE STEP AT A TIME</span></div><button className="nav-item" onClick={() => notify('Settings will be added in a later step')}><Settings2 size={18}/><span>Settings</span></button><div className="profile"><div className="avatar">M</div><div><b>My profile</b><small>Personal account</small></div><MoreHorizontal size={19}/></div></div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation"/>}
    <main className="main">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="crumb">My space <span>/</span> <b>{section}</b></div></div><div className="top-actions"><button className="search-button" onClick={() => { setSearchOpen(true); setSearchQuery('') }}><Search size={16}/><span>Search anything</span><kbd>⌘ K</kbd></button><button className="icon-btn" onClick={() => notify('You’re all caught up')} aria-label="Notifications"><Bell size={18}/><i/></button><button className="top-avatar cloud-avatar" onClick={() => setCloudPanel(v => !v)} aria-label="Cloud sync account">{user ? '✓' : 'M'}</button></div></header>
      <div className="page-content">
        {searchOpen && <div className="search-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSearchOpen(false) }}><section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search your personal workspace"><div className="search-input-row"><Search size={18}/><input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tasks, goals, notes…"/><button className="icon-btn" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={17}/></button></div>{!normalizedQuery ? <p className="search-helper">Search your tasks, saved intentions, finance notes and today’s reflection.</p> : searchResults.length ? <div className="search-results">{searchResults.map((result, index) => <button key={`${result.section}-${result.title}-${index}`} className="search-result" onClick={() => { selectSection(result.section); setSearchOpen(false); setSearchQuery('') }}><span><b>{result.title}</b><small>{result.detail}</small></span><ArrowRight size={15}/></button>)}</div> : <div className="search-empty">No matches found. Try another word.</div>}<div className="search-foot"><span>PERSONAL OS SEARCH</span><kbd>ESC</kbd><span>to close</span></div></section></div>}
        {notice && <div className="notice"><CheckCircle2 size={16}/>{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
        {cloudPanel && <section className="panel generic-panel cloud-panel">
          <div className="panel-heading"><div><h3>Private cloud sync</h3><p>{user ? `Connected as ${user.email ?? 'your account'}` : 'Use a secure email link to sync your personal workspace.'}</p></div><button className="icon-btn" onClick={() => setCloudPanel(false)} aria-label="Close cloud sync"><X size={16}/></button></div>
          {!supabase ? <p className="muted">Cloud sync needs the app’s Supabase environment settings before it can connect.</p> : user ? <div className="cloud-actions"><p className="muted">Your workspace is protected by account-level database policies.</p><button className="soft-button" onClick={async () => { await supabase?.auth.signOut(); setUser(null); setCloudMessage('Signed out. Local data remains on this device.') }}>Sign out</button></div> : <form className="add-task cloud-login" onSubmit={e => { e.preventDefault(); void sendSignInLink() }}><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address" autoComplete="email" required/><button type="submit">Send secure link</button></form>}
          {cloudMessage && <p className="cloud-message">{cloudMessage}</p>}
        </section>}

        {section === 'Today' && <>
          <div className="welcome-row"><div><div className="eyebrow"><CloudSun size={15}/> {dateLabel}</div><h1>{greeting}, <span>let’s take it gently.</span></h1><p className="subtitle">A little clarity. A little progress. Room to breathe.</p></div><button className="soft-button" onClick={() => selectSection('Reviews')}><BookOpen size={16}/> Daily reflection <ArrowRight size={15}/></button></div>
          <div className="hero-grid"><section className="hero-card"><div className="hero-glow glow-one"/><div className="hero-glow glow-two"/><div className="hero-content"><div className="hero-pill"><Sparkles size={13}/> YOUR DAILY RESET</div><h2>Today, intentionally.</h2><p>Make space for what matters.<br/>Let the rest be lighter.</p><button className="hero-button" onClick={() => document.getElementById('task-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>See my priorities <ArrowRight size={15}/></button></div><div className="hero-art"><div className="orb orb-a"/><div className="orb orb-b"/><div className="orb orb-c"/><div className="art-ring ring-a"/><div className="art-ring ring-b"/><div className="art-spark spark-a">✳</div><div className="art-spark spark-b">✧</div></div><div className="hero-footer"><span><span className="status-dot"/> YOUR DAY, YOUR PACE</span><span>01 / A FRESH PAGE</span></div></section>
            <section className="progress-card"><div className="card-topline"><div><span className="eyebrow">DAILY MOMENTUM</span><h3>A good start</h3></div><div className="round-icon lilac"><Target size={19}/></div></div><div className="progress-number">{completed}<span> / {todayTasks.length}</span></div><p className="muted">small things taken care of</p><div className="progress-track"><div style={{width: todayTasks.length ? `${completed / todayTasks.length * 100}%` : '0%'}}/></div><div className="progress-bottom"><span>{todayTasks.length ? Math.round(completed/todayTasks.length*100) : 0}% complete</span><span>{todayTasks.length - completed} to go</span></div><div className="progress-note"><Flower2 size={17}/><span>Progress is progress, even when it’s quiet.</span></div></section></div>
          <div className="section-heading"><div><h2>Your day, at a glance</h2><p>Only tasks assigned to today appear in this list.</p></div><button className="text-button" onClick={() => selectSection('Planner')}>Open planner <ArrowRight size={15}/></button></div>
          <div className="dashboard-grid"><section className="panel task-panel" id="task-list"><div className="panel-heading"><div><h3>Today’s priorities</h3><p>{todayTasks.length} tasks · {completed} completed</p></div><button className="add-btn" onClick={() => setAdding(!adding)}><Plus size={16}/> Add task</button></div>{adding && <form className="add-task" onSubmit={e => {e.preventDefault();addTask()}}><input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="What would you like to do?" autoFocus/><button type="submit" aria-label="Save task"><Check size={17}/></button></form>}<div className="task-list">{todayTasks.map((task, i) => <div className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id}><button className={`task-check ${task.done ? 'checked' : ''}`} onClick={() => setTasks(old => old.map(t => t.id === task.id ? {...t, done: !t.done} : t))} aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}>{task.done && <Check size={13}/>}</button><div className="task-main"><b>{task.title}</b><span>{task.category}</span></div><div className="task-time"><Clock3 size={13}/>{task.time}</div><button className="row-more" aria-label="Remove task" onClick={() => setTasks(old => old.filter(t => t.id !== task.id))}><X size={14}/></button></div>)}{todayTasks.length === 0 && <div className="empty-state">A clean slate. Add one small task to begin.</div>}</div><button className="panel-footer" onClick={() => selectSection('Planner')}>View all tasks <ArrowRight size={14}/></button></section>
            <div className="right-stack"><section className="panel mood-panel"><div className="panel-heading"><div><h3>How are you feeling?</h3><p>Just a moment to check in.</p></div><div className="round-icon peach"><Heart size={18}/></div></div><div className="mood-options">{[['Low','☁'],['Okay','◒'],['Good','☀'],['Great','✳']].map(([label,emoji]) => <button key={label} onClick={() => setMood(label)} className={`mood-option ${mood === label ? 'mood-selected' : ''}`}><span>{emoji}</span><small>{label}</small></button>)}</div><div className="mood-saved"><span className="mood-dot"/>{mood === 'Okay' ? 'It’s okay to be where you are.' : `Noted: feeling ${mood.toLowerCase()} today.`}</div></section><section className="quote-card"><div className="quote-mark">“</div><p>You are allowed to move at the speed of your own healing.</p><span>A GENTLE REMINDER</span><div className="quote-flower">✳</div></section></div></div>
          <div className="bottom-grid"><button className="mini-card" onClick={() => selectSection('Goals')}><div className="mini-icon lilac"><Target size={18}/></div><div><b>Goals & intentions</b><span>Small steps add up</span></div><ArrowUpRight size={16}/></button><button className="mini-card" onClick={() => selectSection('Breathe & Focus')}><div className="mini-icon mint"><Wind size={18}/></div><div><b>Breathe & focus</b><span>Pause for a moment</span></div><ArrowUpRight size={16}/></button><button className="mini-card" onClick={() => selectSection('Finance')}><div className="mini-icon peach"><CreditCard size={18}/></div><div><b>Money overview</b><span>Awareness, not pressure</span></div><ArrowUpRight size={16}/></button></div>
        </>}
        {section === 'Planner' && <><PageTitle eyebrow="MAKE ROOM FOR WHAT MATTERS" title="Your planner" sub="Plan with intention, leave room for life."/><section className="panel generic-panel"><div className="panel-heading"><div><h3>Calendar reminders</h3><p>Create an event with a date, time and notification lead time.</p></div><button className="soft-button" onClick={() => void enableNotifications()}><Bell size={15}/>{notificationsAllowed ? 'Notifications enabled' : 'Enable notifications'}</button></div><form className="event-form" onSubmit={e => {e.preventDefault();addCalendarEvent()}}><input value={eventTitle} onChange={e=>setEventTitle(e.target.value)} placeholder="Event title (e.g. doctor appointment)" aria-label="Event title" required/><div className="event-fields"><label>Date<input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} required/></label><label>Time<input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} required/></label><label>Remind me<select value={eventReminder} onChange={e=>setEventReminder(Number(e.target.value))}><option value={0}>At event time</option><option value={5}>5 minutes before</option><option value={10}>10 minutes before</option><option value={15}>15 minutes before</option><option value={30}>30 minutes before</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option></select></label><button type="submit" className="primary-button"><Plus size={15}/> Save event</button></div></form><p className="scope-hint">Important: reminders run while Personal OS is open. System notifications require permission; this static version cannot reliably notify you when the app is fully closed.</p><div className="event-list">{events.filter(e=>`${e.date}T${e.time}` >= `${todayKey}T00:00`).map(event=><div className="event-row" key={event.id}><div className="event-date"><b>{new Date(`${event.date}T12:00:00`).toLocaleDateString('en',{month:'short',day:'numeric'})}</b><span>{event.time}</span></div><div className="event-info"><b>{event.title}</b><small>{event.reminderMinutes === 0 ? 'Reminder at event time' : event.reminderMinutes < 60 ? `${event.reminderMinutes} minutes before` : event.reminderMinutes === 1440 ? '1 day before' : `${event.reminderMinutes/60} hour${event.reminderMinutes === 60 ? '' : 's'} before`}</small></div><button className="row-more" aria-label="Delete event" onClick={()=>setEvents(old=>old.filter(e=>e.id!==event.id))}><X size={15}/></button></div>)}{events.filter(e=>`${e.date}T${e.time}` >= `${todayKey}T00:00`).length===0 && <div className="empty-state">No upcoming events yet. Add an appointment or anything you need to remember.</div>}</div></section><section className="panel generic-panel"><div className="panel-heading"><div><h3>Planned tasks</h3><p>{tasks.filter(t => (t.scope ?? 'today') === 'planner').length} planned items · {tasks.filter(t => (t.scope ?? 'today') === 'planner' && t.done).length} completed</p><p className="scope-hint">These tasks stay separate from Today’s priorities.</p></div><button className="add-btn" onClick={() => setAdding(!adding)}><Plus size={16}/> Add task</button></div>{adding && <form className="add-task" onSubmit={e => {e.preventDefault();addTask()}}><input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Write a task…" autoFocus/><input aria-label="Planned date" type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} /><button type="submit"><Check size={17}/></button></form>}{tasks.filter(t => (t.scope ?? 'today') === 'planner').map(t => <div className={`task-row ${t.done ? 'task-done' : ''}`} key={t.id}><button className={`task-check ${t.done?'checked':''}`} onClick={() => setTasks(old=>old.map(x=>x.id===t.id?{...x,done:!x.done}:x))}>{t.done&&<Check size={13}/>}</button><div className="task-main"><b>{t.title}</b><span>{t.category} · {t.date ?? 'No date set'}</span></div><div className="task-time"><Clock3 size={13}/>{t.time}</div><button className="row-more" aria-label="Remove task" onClick={() => setTasks(old => old.filter(x => x.id !== t.id))}><X size={14}/></button></div>)}{tasks.filter(t => (t.scope ?? 'today') === 'planner').length === 0 && <div className="empty-state">Your planner is clear. Add a task you want to plan ahead.</div>}</section></>}
        {section === 'Goals' && <><PageTitle eyebrow="A DIRECTION, NOT A DEADLINE" title="Goals & intentions" sub="Meaningful progress, without the pressure."/><div className="three-cards"><InfoCard icon={<Target/>} title="This season" text="What would make the next few months feel meaningful?" tone="lilac"/><InfoCard icon={<Heart/>} title="For my wellbeing" text="A small habit that supports your body and mind." tone="peach"/><InfoCard icon={<Sparkles/>} title="One next step" text="Turn an intention into something you can do today." tone="mint"/></div><section className="panel generic-panel"><h3>My intention</h3><textarea value={goal} onChange={e=>setGoal(e.target.value)} placeholder="What matters to me right now?"/><button className="primary-button" onClick={()=>notify('Intention saved on this device')}>Save intention</button></section></>}
        {section === 'Wellbeing' && <><PageTitle eyebrow="CARE WITHOUT KEEPING SCORE" title="Wellbeing" sub="A gentle check-in, not another thing to perfect."/><div className="wellbeing-grid"><section className="panel generic-panel"><div className="round-icon peach"><Heart/></div><h3>How is your energy?</h3><p className="muted">Choose what feels closest today.</p><input className="range" type="range" min="1" max="10" value={energy} onChange={e=>setEnergy(+e.target.value)}/><div className="range-labels"><span>Running low</span><b>{energy}/10</b><span>Plenty of energy</span></div></section><section className="panel generic-panel"><div className="round-icon mint"><Moon/></div><h3>What would support you?</h3><p className="muted">You can choose just one.</p><div className="support-list">{['A proper meal','A short walk','A little rest','Talk to someone','A calmer evening'].map(s=><button key={s} onClick={()=>notify(`Gentle reminder: ${s.toLowerCase()}`)}><CheckCircle2 size={16}/>{s}<ArrowRight size={14}/></button>)}</div></section></div></>}
        {section === 'Finance' && <><PageTitle eyebrow="CLARITY, NOT JUDGEMENT" title="Money overview" sub="A simple snapshot. Your numbers stay yours."/><div className="finance-note"><ShieldCheck size={17}/> Sample values start at zero. Nothing is connected to a bank.</div><div className="finance-grid">{([['Monthly income','income',ArrowUpRight],['Essential costs','essentials',ArrowDownRight],['Debt & commitments','commitments',CreditCard]] as const).map(([label,key,Icon])=><section className="panel finance-card" key={key}><div className="finance-card-top"><span>{label}</span><Icon size={17}/></div><label><span>Amount (your currency)</span><input value={finance[key]} inputMode="decimal" onChange={e=>setFinance(old=>({...old,[key]:e.target.value}))}/></label><small>Saved on this device</small></section>)}</div><section className="panel generic-panel"><h3>One money question</h3><p className="muted">What is the most useful financial decision you can make this week?</p><textarea value={financeNote} onChange={e=>setFinanceNote(e.target.value)} placeholder="Write a note to yourself…"/></section></>}
        {section === 'Reviews' && <><PageTitle eyebrow="NOTICE, LEARN, RESET" title="Daily reflection" sub="A few honest lines are more than enough."/><div className="three-cards"><InfoCard icon={<CheckCircle2/>} title="Tasks completed" text={`${weekTaskDone} of ${weekTaskTotal} tasks recorded over ${weekRecords.length} day${weekRecords.length === 1 ? '' : 's'} in the last 7 days.`} tone="lilac"/><InfoCard icon={<Heart/>} title="Average energy" text={`${averageEnergy}${averageEnergy !== '—' ? ' / 10' : ''} across recorded days.`} tone="peach"/><InfoCard icon={<Activity/>} title="Average stress" text={`${averageStress}${averageStress !== '—' ? ' / 10' : ''} across recorded days.`} tone="mint"/></div><section className="panel generic-panel"><h3>Look back with kindness</h3><p className="muted">What went well, even in a small way?</p><textarea value={reflections[todayKey] ?? ''} onChange={e=>setReflections(old=>({...old,[todayKey]:e.target.value}))} placeholder="Today, I’m glad that…"/><div className="reflection-prompts"><button onClick={()=>setReflections(old=>({...old,[todayKey]:(old[todayKey] ?? '')+'\nOne thing I handled well: '}))}>One thing I handled well</button><button onClick={()=>setReflections(old=>({...old,[todayKey]:(old[todayKey] ?? '')+'\nSomething I can let go of: '}))}>Something to let go of</button><button onClick={()=>setReflections(old=>({...old,[todayKey]:(old[todayKey] ?? '')+'\nTomorrow, I’ll start with: '}))}>A gentle start tomorrow</button></div><button className="primary-button" onClick={()=>{ setHistory(old=>({...old,[todayKey]:{date:todayKey,tasksTotal:todayTasks.length,tasksCompleted:completed,mood,energy,stress,reflection:reflections[todayKey] ?? '',updatedAt:new Date().toISOString()}})); notify('Today’s review saved to your history') }}>Save today’s review</button></section><section className="panel generic-panel"><div className="panel-heading"><div><h3>Recent daily history</h3><p>Your past days stay saved separately.</p></div><span className="eyebrow">LAST 7 DAYS</span></div>{weekRecords.length ? weekRecords.map(record=><div className="task-row" key={record.date}><div className="round-icon lilac"><BookOpen size={16}/></div><div className="task-main"><b>{new Intl.DateTimeFormat('en',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${record.date}T12:00:00Z`))}</b><span>{record.tasksCompleted}/{record.tasksTotal} tasks · Mood: {record.mood} · Energy {record.energy}/10 · Stress {record.stress}/10</span>{record.reflection && <small>{record.reflection}</small>}</div></div>) : <div className="empty-state">Your daily history will appear here as you check in and save reviews.</div>}{recentRecords.length > 7 && <p className="scope-hint">{recentRecords.length} days preserved in total. This panel shows the most recent week.</p>}</section></> }
        {section === 'Anxiety Tracker' && <><PageTitle eyebrow="OPTIONAL · NON-DIAGNOSTIC" title="Anxiety check-in" sub="Notice what is present without judging or forcing change."/><div className="safety-note"><Heart size={18}/><span>This is a personal reflection tool, not a diagnosis or a replacement for professional care. Skip anything that doesn’t feel helpful.</span></div><section className="panel generic-panel"><h3>How intense does stress feel right now?</h3><input className="range" type="range" min="0" max="10" value={stress} onChange={e=>setStress(+e.target.value)}/><div className="range-labels"><span>Calm</span><b>{stress}/10</b><span>Very intense</span></div><h3 className="spaced-heading">What do you notice?</h3><div className="reflection-prompts">{['Racing thoughts','Tension','Restlessness','Fast heartbeat','Hard to focus','Nothing specific'].map(x=><button key={x} onClick={()=>notify(`Noted for now: ${x}`)}>{x}</button>)}</div><p className="muted safety-copy">You don’t need to fight the feeling. If symptoms are new, severe, or medically concerning, seek appropriate medical help.</p></section></>}
        {section === 'Breathe & Focus' && <><PageTitle eyebrow="A SMALL PAUSE" title="Breathe & focus" sub="No need to breathe deeply or hold your breath. Let your breathing stay comfortable."/><section className="panel breathe-panel"><div className={`breath-orb ${breathing?'breath-active':''}`}><div className="breath-orb-inner"><Wind size={30}/><span>{breathing?'Breathe gently':'A moment for you'}</span></div></div><p className="muted">{breathing?'Follow a comfortable, natural rhythm. Stop whenever you like.':'Start a gentle visual pause whenever it feels right.'}</p><button className="primary-button" onClick={()=>setBreathing(v=>!v)}>{breathing?'End pause':'Begin a gentle pause'} {breathing?<X size={16}/>:<ArrowRight size={16}/>}</button><div className="breath-footnote"><ShieldCheck size={15}/> No forced holds · No rapid breathing · Stop at any time</div></section></>}
        <footer className="page-footer"><span>PERSONAL OS <i>·</i> MADE FOR YOUR REAL LIFE</span><span><ShieldCheck size={13}/> {user && cloudReady ? 'Private cloud sync enabled' : 'Device save enabled · Cloud sync optional'}</span></footer>
      </div>
    </main>
  </div>
}

function PageTitle({eyebrow,title,sub}:{eyebrow:string;title:string;sub:string}) { return <div className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="subtitle">{sub}</p></div> }
function InfoCard({icon,title,text,tone}:{icon:React.ReactNode;title:string;text:string;tone:string}) { return <section className="panel info-card"><div className={`round-icon ${tone}`}>{icon}</div><h3>{title}</h3><p>{text}</p></section> }

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen,
  Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, CloudSun, CreditCard,
  Flower2, Heart, LayoutDashboard, ListTodo, Menu, Moon, MoreHorizontal,
  Plus, Search, Settings2, ShieldCheck, Sparkles, Target, Wind, X, UserRound, Camera, LockKeyhole, Mail
} from 'lucide-react'

type Section = 'Today' | 'Planner' | 'Goals' | 'Wellbeing' | 'Finance' | 'Reviews' | 'Anxiety Tracker' | 'Breathe & Focus' | 'Settings'
type Task = { id: number; title: string; time: string; category: string; done: boolean; scope?: 'today' | 'planner'; date?: string }
type CalendarEvent = { id: number; title: string; date: string; time: string; reminderMinutes: number; notifiedKey?: string }
type DailyRecord = { date: string; tasksTotal: number; tasksCompleted: number; mood: string; energy: number; stress: number; reflection: string; updatedAt: string }
type MoneyTransaction = { id: number; title: string; amount: string; type: 'income' | 'expense'; date: string }
type PersonalGoal = { id: number; title: string; targetDate: string; done: boolean; createdAt: string }
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
type SavedState = { tasks: Task[]; events?: CalendarEvent[]; mood: string; energy: number; stress: number; reflection: string; goal: string; financeNote: string; reflections: Record<string, string>; history?: Record<string, DailyRecord>; finance: { income: string; essentials: string; commitments: string }; transactions?: MoneyTransaction[]; goals?: PersonalGoal[] }
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
  const [goals, setGoals] = useState<PersonalGoal[]>(() => loadSavedState().goals ?? [])
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalDate, setNewGoalDate] = useState('')
  const [financeNote, setFinanceNote] = useState(() => loadSavedState().financeNote ?? '')
  const [reflections, setReflections] = useState<Record<string, string>>(() => loadSavedState().reflections ?? {})
  const [history, setHistory] = useState<Record<string, DailyRecord>>(() => loadSavedState().history ?? {})
  const [breathing, setBreathing] = useState(false)
  const [notice, setNotice] = useState('')
  const [finance, setFinance] = useState(() => loadSavedState().finance ?? { income: '0', essentials: '0', commitments: '0' })
  const [transactions, setTransactions] = useState<MoneyTransaction[]>(() => loadSavedState().transactions ?? [])
  const [transactionTitle, setTransactionTitle] = useState('')
  const [transactionAmount, setTransactionAmount] = useState('')
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense')
  const [transactionDate, setTransactionDate] = useState(() => tehranDateKey())
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: Record<string, unknown> } | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profileAvatar, setProfileAvatar] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [settingsPassword, setSettingsPassword] = useState('')
  const [settingsPasswordConfirm, setSettingsPasswordConfirm] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset' | 'update'>('signin')
  const [cloudPanel, setCloudPanel] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [cloudMessage, setCloudMessage] = useState('')
  const [cloudReady, setCloudReady] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, events, mood, energy, stress, reflection, goal, financeNote, reflections, history, finance, transactions, goals } satisfies SavedState)) }
    catch { /* Storage may be unavailable in private browsing; the app remains usable for this session. */ }
  }, [tasks, events, mood, energy, stress, reflection, goal, financeNote, reflections, history, finance, transactions, goals])

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      setUser(session?.user ?? null)
      setCloudReady(false)
      if (event === 'PASSWORD_RECOVERY') { setAuthMode('update'); setCloudPanel(true); setCloudMessage('Choose a new password for your account.') }
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!user) { setProfileName(''); setProfileAvatar(''); setNewEmail(''); return }
    setProfileName(typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '')
    setProfileAvatar(typeof user.user_metadata?.avatar_data === 'string' ? user.user_metadata.avatar_data : '')
    setNewEmail(user.email ?? '')
  }, [user?.id, user?.email, user?.user_metadata?.full_name, user?.user_metadata?.avatar_data])

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
        if (saved.history) setHistory(local => ({ ...local, ...saved.history }))
        if (saved.finance) setFinance(saved.finance)
        if (saved.transactions) setTransactions(saved.transactions)
        if (saved.goals) setGoals(saved.goals)
      }
      setCloudReady(true)
    })
    return () => { alive = false }
  }, [user?.id])

  useEffect(() => {
    const client = supabase
    if (!client || !user || !cloudReady) return
    const timer = window.setTimeout(async () => {
      const payload = { tasks, events, mood, energy, stress, reflection, goal, financeNote, reflections, history, finance, transactions, goals }
      const { error } = await client.from('user_workspace').upsert({ user_id: user.id, data: payload }, { onConflict: 'user_id' })
      setCloudMessage(error ? 'Cloud sync issue. Your data is still saved on this device.' : 'Synced securely to your private account.')
    }, 650)
    return () => window.clearTimeout(timer)
  }, [user?.id, cloudReady, tasks, events, mood, energy, stress, reflection, goal, financeNote, reflections, history, finance, transactions, goals])

  async function handleAuthSubmit() {
    if (!supabase || profileSaving) return
    const cleanEmail = email.trim().toLowerCase()
    if (authMode !== 'update' && !cleanEmail) { setCloudMessage('Enter your email address first.'); return }
    if (authMode !== 'reset' && password.length < 8) { setCloudMessage('Use a password with at least 8 characters.'); return }
    setProfileSaving(true)
    setCloudMessage('')
    try {
      if (authMode === 'reset') {
        const redirectUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: redirectUrl })
        if (error) {
          const message = error.message.toLowerCase()
          setCloudMessage(message.includes('rate limit') ? 'Email sending is temporarily limited by the authentication service. Please wait before requesting another link; repeated attempts will not help. No SMTP setup is required just to wait for this limit to clear.' : `Could not send password reset email: ${error.message}`)
        } else setCloudMessage('Password reset email requested. Open the link on this device, then choose a new password.')
        return
      }
      if (authMode === 'update') {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) { setCloudMessage(`Could not update password: ${error.message}`); return }
        setCloudMessage('Password updated successfully. You can now sign in with it.')
        setAuthMode('signin')
        setPassword('')
        return
      }
      if (authMode === 'signup') {
        const redirectUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password, options: { emailRedirectTo: redirectUrl } })
        if (error) {
          const message = error.message.toLowerCase()
          setCloudMessage(message.includes('rate limit') ? 'Email sending is temporarily limited. Wait before trying again; creating or deleting accounts does not clear this limit.' : message.includes('already registered') || message.includes('already exists') ? 'This email may already have an account. Try Sign in or Forgot password instead of creating another account.' : `Could not create account: ${error.message}`)
        } else setCloudMessage(data.session ? 'Account created and signed in.' : 'Account request created. Check your inbox for confirmation before signing in.')
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      if (error) {
        const message = error.message.toLowerCase()
        setCloudMessage(message.includes('invalid login credentials') ? 'Email or password is incorrect. If you originally used an email sign-in link, use Forgot password to set a password.' : `Could not sign in: ${error.message}`)
      } else setCloudMessage('Signed in successfully. Loading your private workspace…')
    } catch (error) {
      setCloudMessage(error instanceof Error ? `Request failed: ${error.message}` : 'The request failed. Please try again.')
    } finally {
      setProfileSaving(false)
    }
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
  const recentRecords = useMemo(() => {
    const records = { ...history }
    // Always surface today's live check-in, even before the next persistence effect runs.
    if (!records[todayKey]) records[todayKey] = { date: todayKey, tasksTotal: todayTasks.length, tasksCompleted: completed, mood, energy, stress, reflection: reflections[todayKey] ?? reflection, updatedAt: new Date().toISOString() }
    return Object.values(records).sort((a, b) => b.date.localeCompare(a.date))
  }, [history, todayKey, todayTasks.length, completed, mood, energy, stress, reflections, reflection])
  const weekRecords = useMemo(() => {
    const end = new Date(`${todayKey}T12:00:00Z`)
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(end); d.setUTCDate(d.getUTCDate() - index)
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
      return history[key]
    }).filter((record): record is DailyRecord => Boolean(record))
  }, [history, todayKey])
  const weekTimeline = useMemo(() => { const end = new Date(`${todayKey}T12:00:00Z`); return Array.from({ length: 7 }, (_, index) => { const d = new Date(end); d.setUTCDate(d.getUTCDate() - (6 - index)); const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`; const record = key === todayKey ? (history[key] ?? { date:key, tasksTotal:todayTasks.length, tasksCompleted:completed, mood, energy, stress, reflection:reflections[key] ?? reflection, updatedAt:new Date().toISOString() }) : history[key]; return { key, record: record ?? null, label: new Intl.DateTimeFormat('en',{weekday:'short',timeZone:'UTC'}).format(new Date(`${key}T12:00:00Z`)) } }) }, [history, todayKey, todayTasks.length, completed, mood, energy, stress, reflections, reflection])
  const weekTaskTotal = weekRecords.reduce((sum, record) => sum + record.tasksTotal, 0)
  const weekTaskDone = weekRecords.reduce((sum, record) => sum + record.tasksCompleted, 0)
  const averageEnergy = weekRecords.length ? (weekRecords.reduce((sum, record) => sum + record.energy, 0) / weekRecords.length).toFixed(1) : '—'
  const averageStress = weekRecords.length ? (weekRecords.reduce((sum, record) => sum + record.stress, 0) / weekRecords.length).toFixed(1) : '—'
  const weeklyReportText = useMemo(() => {
    const lines = [
      `Personal OS — Weekly Review (${weekTimeline[0]?.key ?? todayKey} to ${todayKey})`,
      `Recorded days: ${weekRecords.length}/7`,
      `Tasks completed: ${weekTaskDone}/${weekTaskTotal}`,
      `Average energy: ${averageEnergy}${averageEnergy !== '—' ? '/10' : ''}`,
      `Average stress: ${averageStress}${averageStress !== '—' ? '/10' : ''}`,
      '',
      'Daily check-ins:'
    ];
    weekTimeline.forEach(day => {
      if (!day.record) { lines.push(`- ${day.key}: No saved check-in`); return; }
      lines.push(`- ${day.key}: Tasks ${day.record.tasksCompleted}/${day.record.tasksTotal}; Mood ${day.record.mood}; Energy ${day.record.energy}/10; Stress ${day.record.stress}/10${day.record.reflection ? `; Reflection: ${day.record.reflection.replace(/\s+/g, ' ').trim()}` : ''}`);
    });
    return lines.join('\n');
  }, [weekTimeline, todayKey, weekRecords.length, weekTaskDone, weekTaskTotal, averageEnergy, averageStress]);
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

  if (!user || authMode === 'update') {
    return <main className="login-screen">
      <div className="login-glow login-glow-one"/>
      <div className="login-glow login-glow-two"/>
      <section className="login-card">
        <div className="login-brand">
          <div className="login-mark"><Sparkles size={18}/></div>
          <span>personal<span className="login-brand-accent">.os</span></span>
        </div>
        <div className="login-heading">
          <span className="login-eyebrow">{authMode === 'reset' ? 'ACCOUNT RECOVERY' : authMode === 'update' ? 'SECURE YOUR ACCOUNT' : 'YOUR SPACE, YOUR PACE'}</span>
          <h1>{authMode === 'reset' ? 'Reset password' : authMode === 'update' ? 'Choose a new password' : authMode === 'signup' ? 'Create account' : 'Welcome back'}</h1>
          <p>{authMode === 'reset' ? 'We’ll send you a secure reset link.' : authMode === 'update' ? 'Set a new password for your account.' : authMode === 'signup' ? 'Create your private workspace.' : 'Sign in to your personal space.'}</p>
        </div>
        {!supabase && <p className="login-message login-error">Sign-in is unavailable because authentication is not configured.</p>}
        <form className="login-form" onSubmit={e=>{e.preventDefault();void handleAuthSubmit()}}>
          {authMode !== 'update' && <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required autoFocus/></label>}
          {authMode !== 'reset' && <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={authMode === 'update' ? 'New password (8+ characters)' : 'Enter your password'} autoComplete={authMode === 'update' ? 'new-password' : 'current-password'} minLength={8} required autoFocus={authMode==='update'}/></label>}
          {authMode === 'signin' && <button type="button" className="login-forgot" onClick={()=>{setAuthMode('reset');setCloudMessage('')}}>Forgot password?</button>}
          <button className="login-submit" type="submit" disabled={profileSaving || !supabase}>{profileSaving ? 'Please wait…' : authMode === 'reset' ? 'Send reset link' : authMode === 'update' ? 'Save new password' : 'Sign in'}<ArrowRight size={15}/></button>
        </form>
        {cloudMessage && <p className={`login-message ${/could not|incorrect|failed|unavailable|error|temporarily|limited|not configured/i.test(cloudMessage)?'login-error':'login-success'}`} role="status">{cloudMessage}</p>}
        {authMode === 'signin' && <button className="login-back" onClick={()=>{setAuthMode('signup');setCloudMessage('');setPassword('')}}>Create account</button>}{authMode !== 'signin' && authMode !== 'update' && <button className="login-back" onClick={()=>{setAuthMode('signin');setCloudMessage('');setPassword('')}}>Back to sign in</button>}
        <div className="login-footer"><span className="login-footer-dot"/> PRIVATE PERSONAL WORKSPACE</div>
      </section>
    </main>
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={21}/></div><div><strong>personal<span>.</span>os</strong><small>YOUR SPACE, YOUR PACE</small></div><button className="icon-btn close-menu" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18}/></button></div>
      <button className="workspace" onClick={() => notify('Personal space · Settings will be available in a later step')}><div className="avatar">M</div><div><b>My personal space</b><small>Private workspace</small></div><ChevronDown size={15}/></button>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(item => <button key={item.name} className={`nav-item ${section === item.name ? 'active' : ''}`} onClick={() => selectSection(item.name)}><item.icon size={18}/><span>{item.name}</span>{item.name === 'Today' && <span className="nav-count">{todayTasks.filter(t => !t.done).length}</span>}</button>)}</nav>
      <div className="nav-label tools-label">PERSONAL TOOLS</div>
      <nav>{extras.map(item => <button key={item.name} className={`nav-item ${section === item.name ? 'active' : ''}`} onClick={() => selectSection(item.name)}><item.icon size={18}/><span>{item.name}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="calm-card"><div className="calm-icon"><Flower2 size={19}/></div><b>A little reminder</b><p>You don’t have to do everything. Just the next kind thing.</p><span>ONE STEP AT A TIME</span></div><button className={`nav-item ${section === 'Settings' ? 'active' : ''}`} onClick={() => selectSection('Settings')}><Settings2 size={18}/><span>Settings</span></button><button className="profile profile-button" onClick={() => user ? selectSection('Settings') : setCloudPanel(v => !v)}><div className="avatar">{user && profileAvatar ? <img src={profileAvatar} alt=""/> : (profileName || user?.email || 'M').slice(0,1).toUpperCase()}</div><div><b>{user ? profileName || user.email || 'My profile' : 'My profile'}</b><small>{user ? 'Account settings' : 'Sign in to sync'}</small></div><MoreHorizontal size={19}/></button></div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation"/>}
    <main className="main">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="crumb">My space <span>/</span> <b>{section}</b></div></div><div className="top-actions"><button className="search-button" onClick={() => { setSearchOpen(true); setSearchQuery('') }}><Search size={16}/><span>Search anything</span><kbd>⌘ K</kbd></button><button className="icon-btn" onClick={() => notify('You’re all caught up')} aria-label="Notifications"><Bell size={18}/><i/></button>{!user && <button className="soft-button sign-in-trigger" onClick={() => setCloudPanel(v => !v)}>Sign in</button>}<button className="top-avatar cloud-avatar" onClick={() => user ? selectSection('Settings') : setCloudPanel(v => !v)} aria-label={user ? 'Open account settings' : 'Sign in'}>{user && profileAvatar ? <img src={profileAvatar} alt=""/> : user ? (profileName || user.email || 'M').slice(0,1).toUpperCase() : 'M'}</button></div></header>
      <div className="page-content">
        {searchOpen && <div className="search-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSearchOpen(false) }}><section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search your personal workspace"><div className="search-input-row"><Search size={18}/><input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tasks, goals, notes…"/><button className="icon-btn" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={17}/></button></div>{!normalizedQuery ? <p className="search-helper">Search your tasks, saved intentions, finance notes and today’s reflection.</p> : searchResults.length ? <div className="search-results">{searchResults.map((result, index) => <button key={`${result.section}-${result.title}-${index}`} className="search-result" onClick={() => { selectSection(result.section); setSearchOpen(false); setSearchQuery('') }}><span><b>{result.title}</b><small>{result.detail}</small></span><ArrowRight size={15}/></button>)}</div> : <div className="search-empty">No matches found. Try another word.</div>}<div className="search-foot"><span>PERSONAL OS SEARCH</span><kbd>ESC</kbd><span>to close</span></div></section></div>}
        {notice && <div className="notice"><CheckCircle2 size={16}/>{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
        {cloudPanel && <section className="panel generic-panel cloud-panel">
          <div className="panel-heading"><div><h3>{user ? 'Your account' : authMode === 'signup' ? 'Create your account' : authMode === 'reset' ? 'Reset your password' : authMode === 'update' ? 'Choose a new password' : 'Sign in to your account'}</h3><p>{user ? `Connected as ${user.email ?? 'your account'}` : authMode === 'reset' ? 'We’ll email you a secure password reset link.' : authMode === 'update' ? 'Set a new password to use on this and other devices.' : 'Sign in with the email you used on your phone and your password.'}</p></div><button className="icon-btn" onClick={() => setCloudPanel(false)} aria-label="Close account panel"><X size={16}/></button></div>
          {!supabase ? <p className="muted">Cloud sync needs the app’s Supabase environment settings before it can connect.</p> : user && authMode !== 'update' ? <div className="cloud-actions"><p className="muted">Your workspace is protected by account-level database policies.</p><button className="soft-button" onClick={async () => { await supabase?.auth.signOut(); setUser(null); setAuthMode('signin'); setPassword(''); setCloudMessage('Signed out. Local data remains on this device.') }}>Sign out</button></div> : <form className="add-task cloud-login" onSubmit={e => { e.preventDefault(); void handleAuthSubmit() }}>
            {authMode !== 'update' && <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" required/>}
            {authMode !== 'reset' && <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={authMode === 'update' ? 'New password (at least 8 characters)' : 'Password (at least 8 characters)'} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required/>}
            <button type="submit" disabled={profileSaving}>{profileSaving ? 'Please wait…' : authMode === 'signup' ? 'Create account' : authMode === 'reset' ? 'Send reset link' : authMode === 'update' ? 'Save new password' : 'Sign in'}</button>
          </form>}
          {!user && authMode === 'signin' && <div className="auth-links"><button onClick={() => { setAuthMode('reset'); setCloudMessage('') }}>Forgot password?</button><button onClick={() => { setAuthMode('signup'); setCloudMessage('') }}>Create account</button></div>}
          {!user && authMode !== 'signin' && authMode !== 'update' && <div className="auth-links"><button onClick={() => { setAuthMode('signin'); setCloudMessage(''); setPassword('') }}>Back to sign in</button></div>}
          {cloudMessage && <p className="cloud-message">{cloudMessage}</p>}
        </section>}

        {section === 'Today' && <>
          <div className="welcome-row"><div><div className="eyebrow"><CloudSun size={15}/> {dateLabel}</div><h1>{greeting}, <span>let’s take it gently.</span></h1><p className="subtitle">A little clarity. A little progress. Room to breathe.</p></div><button className="soft-button" onClick={() => selectSection('Reviews')}><BookOpen size={16}/> Daily reflection <ArrowRight size={15}/></button></div>
          <div className="hero-grid"><section className="hero-card"><div className="hero-glow glow-one"/><div className="hero-glow glow-two"/><div className="hero-content"><div className="hero-pill"><Sparkles size={13}/> YOUR DAILY RESET</div><h2>Today, intentionally.</h2><p>Make space for what matters.<br/>Let the rest be lighter.</p><button className="hero-button" onClick={() => document.getElementById('task-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>See my priorities <ArrowRight size={15}/></button></div><div className="hero-art"><div className="orb orb-a"/><div className="orb orb-b"/><div className="orb orb-c"/><div className="art-ring ring-a"/><div className="art-ring ring-b"/><div className="art-spark spark-a">✳</div><div className="art-spark spark-b">✧</div></div><div className="hero-footer"><span><span className="status-dot"/> YOUR DAY, YOUR PACE</span><span>01 / A FRESH PAGE</span></div></section>
            <section className="progress-card"><div className="card-topline"><div><span className="eyebrow">DAILY MOMENTUM</span><h3>A good start</h3></div><div className="round-icon lilac"><Target size={19}/></div></div><div className="progress-number">{completed}<span> / {todayTasks.length}</span></div><p className="muted">small things taken care of</p><div className="progress-track"><div style={{width: todayTasks.length ? `${completed / todayTasks.length * 100}%` : '0%'}}/></div><div className="progress-bottom"><span>{todayTasks.length ? Math.round(completed/todayTasks.length*100) : 0}% complete</span><span>{todayTasks.length - completed} to go</span></div><div className="progress-note"><Flower2 size={17}/><span>Progress is progress, even when it’s quiet.</span></div></section></div>
          <div className="section-heading"><div><h2>Your day, at a glance</h2><p>Only tasks assigned to today appear in this list.</p></div><button className="text-button" onClick={() => selectSection('Planner')}>Open planner <ArrowRight size={15}/></button></div>
          <div className="dashboard-grid"><section className="panel task-panel" id="task-list"><div className="panel-heading"><div><h3>Today’s priorities</h3><p>{todayTasks.length} tasks · {completed} completed</p></div><button className="add-btn" onClick={() => setAdding(!adding)}><Plus size={16}/> Add task</button></div>{adding && <form className="add-task" onSubmit={e => {e.preventDefault();addTask()}}><input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="What would you like to do?" autoFocus/><button type="submit" aria-label="Save task"><Check size={17}/></button></form>}<div className="task-list">{todayTasks.map((task, i) => <div className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id}><button className={`task-check ${task.done ? 'checked' : ''}`} onClick={() => setTasks(old => old.map(t => t.id === task.id ? {...t, done: !t.done} : t))} aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}>{task.done && <Check size={13}/>}</button><div className="task-main"><b>{task.title}</b><span>{task.category}</span></div><div className="task-time"><Clock3 size={13}/>{task.time}</div><button className="row-more" aria-label="Remove task" onClick={() => setTasks(old => old.filter(t => t.id !== task.id))}><X size={14}/></button></div>)}{todayTasks.length === 0 && <div className="empty-state">A clean slate. Add one small task to begin.</div>}</div><button className="panel-footer" onClick={() => selectSection('Planner')}>View all tasks <ArrowRight size={14}/></button></section>
            <div className="right-stack"><section className="panel mood-panel"><div className="panel-heading"><div><h3>How are you feeling?</h3><p>Just a moment to check in.</p></div><div className="round-icon peach"><Heart size={18}/></div></div><div className="mood-options">{[['Low','☁'],['Okay','◒'],['Good','☀'],['Great','✳']].map(([label,emoji]) => <button key={label} onClick={() => { setMood(label); setHistory(previous => ({ ...previous, [todayKey]: { date: todayKey, tasksTotal: todayTasks.length, tasksCompleted: completed, mood: label, energy, stress, reflection: reflections[todayKey] ?? reflection, updatedAt: new Date().toISOString() } })); notify(`Mood saved: ${label}`) }} className={`mood-option ${mood === label ? 'mood-selected' : ''}`}><span>{emoji}</span><small>{label}</small></button>)}</div><div className="mood-saved"><span className="mood-dot"/>{mood === 'Okay' ? 'It’s okay to be where you are.' : `Noted: feeling ${mood.toLowerCase()} today.`}</div></section><section className="quote-card"><div className="quote-mark">“</div><p>You are allowed to move at the speed of your own healing.</p><span>A GENTLE REMINDER</span><div className="quote-flower">✳</div></section></div></div>
          <div className="bottom-grid"><button className="mini-card" onClick={() => selectSection('Goals')}><div className="mini-icon lilac"><Target size={18}/></div><div><b>Goals & intentions</b><span>Small steps add up</span></div><ArrowUpRight size={16}/></button><button className="mini-card" onClick={() => selectSection('Breathe & Focus')}><div className="mini-icon mint"><Wind size={18}/></div><div><b>Breathe & focus</b><span>Pause for a moment</span></div><ArrowUpRight size={16}/></button><button className="mini-card" onClick={() => selectSection('Finance')}><div className="mini-icon peach"><CreditCard size={18}/></div><div><b>Money overview</b><span>Awareness, not pressure</span></div><ArrowUpRight size={16}/></button></div>
        </>}
        {section === 'Planner' && <><PageTitle eyebrow="MAKE ROOM FOR WHAT MATTERS" title="Your planner" sub="Plan with intention, leave room for life."/><section className="panel generic-panel"><div className="panel-heading"><div><h3>Calendar reminders</h3><p>Create an event with a date, time and notification lead time.</p></div><button className="soft-button" onClick={() => void enableNotifications()}><Bell size={15}/>{notificationsAllowed ? 'Notifications enabled' : 'Enable notifications'}</button></div><form className="event-form" onSubmit={e => {e.preventDefault();addCalendarEvent()}}><input value={eventTitle} onChange={e=>setEventTitle(e.target.value)} placeholder="Event title (e.g. doctor appointment)" aria-label="Event title" required/><div className="event-fields"><label>Date<input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} required/></label><label>Time<input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} required/></label><label>Remind me<select value={eventReminder} onChange={e=>setEventReminder(Number(e.target.value))}><option value={0}>At event time</option><option value={5}>5 minutes before</option><option value={10}>10 minutes before</option><option value={15}>15 minutes before</option><option value={30}>30 minutes before</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option></select></label><button type="submit" className="primary-button"><Plus size={15}/> Save event</button></div></form><p className="scope-hint">Important: reminders run while Personal OS is open. System notifications require permission; this static version cannot reliably notify you when the app is fully closed.</p><div className="event-list">{events.filter(e=>`${e.date}T${e.time}` >= `${todayKey}T00:00`).map(event=><div className="event-row" key={event.id}><div className="event-date"><b>{new Date(`${event.date}T12:00:00`).toLocaleDateString('en',{month:'short',day:'numeric'})}</b><span>{event.time}</span></div><div className="event-info"><b>{event.title}</b><small>{event.reminderMinutes === 0 ? 'Reminder at event time' : event.reminderMinutes < 60 ? `${event.reminderMinutes} minutes before` : event.reminderMinutes === 1440 ? '1 day before' : `${event.reminderMinutes/60} hour${event.reminderMinutes === 60 ? '' : 's'} before`}</small></div><button className="row-more" aria-label="Delete event" onClick={()=>setEvents(old=>old.filter(e=>e.id!==event.id))}><X size={15}/></button></div>)}{events.filter(e=>`${e.date}T${e.time}` >= `${todayKey}T00:00`).length===0 && <div className="empty-state">No upcoming events yet. Add an appointment or anything you need to remember.</div>}</div></section><section className="panel generic-panel"><div className="panel-heading"><div><h3>Planned tasks</h3><p>{tasks.filter(t => (t.scope ?? 'today') === 'planner').length} planned items · {tasks.filter(t => (t.scope ?? 'today') === 'planner' && t.done).length} completed</p><p className="scope-hint">These tasks stay separate from Today’s priorities.</p><label className="planner-date-filter">Show planned tasks for <input aria-label="Filter planned tasks by date" type="date" value={planDate} onChange={e=>setPlanDate(e.target.value)} /></label></div><button className="add-btn" onClick={() => setAdding(!adding)}><Plus size={16}/> Add task</button></div>{adding && <form className="add-task" onSubmit={e => {e.preventDefault();addTask()}}><input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Write a task…" autoFocus/><input aria-label="Planned date" type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} /><button type="submit"><Check size={17}/></button></form>}{tasks.filter(t => (t.scope ?? 'today') === 'planner' && (t.date ?? todayKey) === planDate).map(t => <div className={`task-row ${t.done ? 'task-done' : ''}`} key={t.id}><button className={`task-check ${t.done?'checked':''}`} onClick={() => setTasks(old=>old.map(x=>x.id===t.id?{...x,done:!x.done}:x))}>{t.done&&<Check size={13}/>}</button><div className="task-main"><b>{t.title}</b><span>{t.category} · {t.date ?? 'No date set'}</span></div><div className="task-time"><Clock3 size={13}/>{t.time}</div><button className="row-more" aria-label="Remove task" onClick={() => setTasks(old => old.filter(x => x.id !== t.id))}><X size={14}/></button></div>)}{tasks.filter(t => (t.scope ?? 'today') === 'planner' && (t.date ?? todayKey) === planDate).length === 0 && <div className="empty-state">No planned tasks for this date. Choose another date or add a task.</div>}</section></>}
        {section === 'Goals' && <><PageTitle eyebrow="A DIRECTION, NOT A DEADLINE" title="Goals & intentions" sub="Meaningful progress, without the pressure."/><div className="three-cards"><InfoCard icon={<Target/>} title="Active goals" text={`${goals.filter(item=>!item.done).length} goals in progress.`} tone="lilac"/><InfoCard icon={<CheckCircle2/>} title="Completed" text={`${goals.filter(item=>item.done).length} goals completed.`} tone="mint"/><InfoCard icon={<Sparkles/>} title="Next step" text="Keep each goal clear, realistic and personal." tone="peach"/></div><section className="panel generic-panel"><h3>Add a goal</h3><form className="goal-form" onSubmit={e=>{e.preventDefault();const title=newGoalTitle.trim();if(!title)return;setGoals(old=>[{id:Date.now(),title,targetDate:newGoalDate,done:false,createdAt:tehranDateKey()},...old]);setNewGoalTitle('');setNewGoalDate('');notify('Goal saved.')}}><label>Goal<input value={newGoalTitle} onChange={e=>setNewGoalTitle(e.target.value)} placeholder="e.g. Walk regularly" maxLength={140} required/></label><label>Target date (optional)<input type="date" value={newGoalDate} onChange={e=>setNewGoalDate(e.target.value)}/></label><button className="primary-button" type="submit"><Plus size={15}/> Add goal</button></form></section><section className="panel generic-panel"><div className="panel-heading"><div><h3>Your goals</h3><p>Mark goals complete as you make progress.</p></div><span className="eyebrow">{goals.length} TOTAL</span></div>{goals.length ? <div className="goal-list">{goals.map(item=><div className={`goal-row ${item.done?'goal-complete':''}`} key={item.id}><button className={`task-check ${item.done?'checked':''}`} aria-label={item.done?'Mark goal active':'Mark goal complete'} onClick={()=>setGoals(old=>old.map(g=>g.id===item.id?{...g,done:!g.done}:g))}>{item.done?<Check size={13}/>:null}</button><div className="goal-main"><b>{item.title}</b><span>{item.done?'Completed':item.targetDate?`Target: ${item.targetDate}`:'No target date'} · Added {item.createdAt}</span></div><button type="button" className="row-more" aria-label={`Delete goal ${item.title}`} onClick={()=>{if(window.confirm('Delete this goal?'))setGoals(old=>old.filter(g=>g.id!==item.id))}}><X size={15}/></button></div>)}</div>:<div className="empty-state">No goals yet. Add one above to get started.</div>}</section><section className="panel generic-panel"><h3>My broader intention</h3><textarea value={goal} onChange={e=>setGoal(e.target.value)} placeholder="What matters to me right now?"/><button className="primary-button" onClick={()=>notify('Intention saved automatically')}>Save intention</button></section></>}
        {section === 'Wellbeing' && <><PageTitle eyebrow="CARE WITHOUT KEEPING SCORE" title="Wellbeing" sub="A gentle check-in, not another thing to perfect."/><div className="wellbeing-grid"><section className="panel generic-panel"><div className="round-icon peach"><Heart/></div><h3>How is your energy?</h3><p className="muted">Choose what feels closest today.</p><input className="range" type="range" min="1" max="10" value={energy} onChange={e=>setEnergy(+e.target.value)}/><div className="range-labels"><span>Running low</span><b>{energy}/10</b><span>Plenty of energy</span></div></section><section className="panel generic-panel"><div className="round-icon mint"><Moon/></div><h3>What would support you?</h3><p className="muted">You can choose just one.</p><div className="support-list">{['A proper meal','A short walk','A little rest','Talk to someone','A calmer evening'].map(s=><button key={s} onClick={()=>notify(`Gentle reminder: ${s.toLowerCase()}`)}><CheckCircle2 size={16}/>{s}<ArrowRight size={14}/></button>)}</div></section></div></>}
        {section === 'Finance' && <><PageTitle eyebrow="CLARITY, NOT JUDGEMENT" title="Money overview" sub="A simple snapshot. Your numbers stay yours."/><div className="finance-note"><ShieldCheck size={17}/> Sample values start at zero. Nothing is connected to a bank.</div><div className="finance-grid">{([['Monthly income','income',ArrowUpRight],['Essential costs','essentials',ArrowDownRight],['Debt & commitments','commitments',CreditCard]] as const).map(([label,key,Icon])=><section className="panel finance-card" key={key}><div className="finance-card-top"><span>{label}</span><Icon size={17}/></div><label><span>Amount (your currency)</span><input value={finance[key]} inputMode="decimal" onChange={e=>setFinance(old=>({...old,[key]:e.target.value}))}/></label><small>Saved automatically</small></section>)}</div><div className="finance-summary-grid"><section className="panel finance-summary"><span>Recorded income</span><strong>{transactions.filter(t=>t.type==='income').reduce((sum,t)=>sum+(Number(t.amount)||0),0).toLocaleString()}</strong><small>From transactions below</small></section><section className="panel finance-summary"><span>Recorded expenses</span><strong>{transactions.filter(t=>t.type==='expense').reduce((sum,t)=>sum+(Number(t.amount)||0),0).toLocaleString()}</strong><small>From transactions below</small></section><section className="panel finance-summary"><span>Net recorded cash</span><strong>{(transactions.reduce((sum,t)=>sum+(t.type==='income'?1:-1)*(Number(t.amount)||0),0)).toLocaleString()}</strong><small>Income minus expenses</small></section></div><section className="panel generic-panel finance-entry"><div className="panel-heading"><div><h3>Add a transaction</h3><p>Record money in or money out. No bank connection required.</p></div></div><form className="finance-form" onSubmit={e=>{e.preventDefault();const amount=Number(transactionAmount);if(!transactionTitle.trim()||!transactionAmount.trim()||!Number.isFinite(amount)||amount<=0){notify('Enter a description and a valid amount greater than zero.');return}setTransactions(old=>[{id:Date.now(),title:transactionTitle.trim(),amount:String(amount),type:transactionType,date:transactionDate},...old]);setTransactionTitle('');setTransactionAmount('');notify('Transaction saved.')}}><label>Description<input value={transactionTitle} onChange={e=>setTransactionTitle(e.target.value)} placeholder="e.g. Groceries, salary" required maxLength={100}/></label><label>Amount<input value={transactionAmount} onChange={e=>setTransactionAmount(e.target.value)} inputMode="decimal" type="number" min="0.01" step="0.01" placeholder="0.00" required/></label><label>Type<select value={transactionType} onChange={e=>setTransactionType(e.target.value as 'income'|'expense')}><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Date<input type="date" value={transactionDate} onChange={e=>setTransactionDate(e.target.value)} required/></label><button className="primary-button" type="submit"><Plus size={15}/> Save transaction</button></form></section><section className="panel generic-panel"><div className="panel-heading"><div><h3>Transactions</h3><p>Your manually recorded money activity.</p></div><span className="eyebrow">{transactions.length} RECORDS</span></div>{transactions.length ? <div className="finance-transactions">{transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).map(item=><div className="finance-transaction" key={item.id}><div className={`finance-transaction-icon ${item.type}`}>{item.type==='income'?<ArrowDownRight size={17}/>:<ArrowUpRight size={17}/>}</div><div className="finance-transaction-main"><b>{item.title}</b><span>{item.date} · {item.type==='income'?'Income':'Expense'}</span></div><strong className={item.type==='income'?'money-in':'money-out'}>{item.type==='income'?'+':'−'}{Number(item.amount).toLocaleString()}</strong><button type="button" className="row-more" aria-label={`Delete ${item.title}`} title="Delete transaction" onClick={()=>{if(window.confirm('Delete this transaction?'))setTransactions(old=>old.filter(t=>t.id!==item.id))}}><X size={15}/></button></div>)}</div> : <div className="empty-state">No transactions yet. Add your first income or expense above.</div>}</section><section className="panel generic-panel"><h3>One money question</h3><p className="muted">What is the most useful financial decision you can make this week?</p><textarea value={financeNote} onChange={e=>setFinanceNote(e.target.value)} placeholder="Write a note to yourself…"/></section></>}
        {section === 'Reviews' && <><PageTitle eyebrow="NOTICE, LEARN, RESET" title="Daily reflection" sub="A few honest lines are more than enough."/><div className="three-cards"><InfoCard icon={<CheckCircle2/>} title="Tasks completed" text={`${weekTaskDone} of ${weekTaskTotal} tasks recorded over ${weekRecords.length} day${weekRecords.length === 1 ? '' : 's'} in the last 7 days.`} tone="lilac"/><InfoCard icon={<Heart/>} title="Average energy" text={`${averageEnergy}${averageEnergy !== '—' ? ' / 10' : ''} across recorded days.`} tone="peach"/><InfoCard icon={<Activity/>} title="Average stress" text={`${averageStress}${averageStress !== '—' ? ' / 10' : ''} across recorded days.`} tone="mint"/></div><section className="panel generic-panel"><div className="panel-heading"><div><h3>Your last 7 days</h3><p>Only days with saved check-ins show values; missing days remain clearly marked.</p></div><button className="secondary-button report-copy" onClick={async()=>{try{await navigator.clipboard.writeText(weeklyReportText);notify("Weekly report copied. You can paste it into JARVIS OS.");}catch{notify("Could not copy automatically. Check clipboard permission and try again.");}}}><BookOpen size={14}/> Copy weekly report</button></div><div className="trend-grid"><div className="trend-panel"><div className="trend-title">Energy <span>out of 10</span></div><div className="trend-bars">{weekTimeline.map(day=><div className="trend-column" key={`energy-${day.key}`}><div className="trend-bar-area">{day.record ? <div className="trend-bar energy-bar" style={{height:`${Math.max(4,day.record.energy*10)}%`}} title={`${day.key}: energy ${day.record.energy}/10`}/> : <div className="trend-missing" title={`${day.key}: no check-in`}>—</div>}</div><small>{day.label}</small></div>)}</div></div><div className="trend-panel"><div className="trend-title">Stress <span>out of 10</span></div><div className="trend-bars">{weekTimeline.map(day=><div className="trend-column" key={`stress-${day.key}`}><div className="trend-bar-area">{day.record ? <div className="trend-bar stress-bar" style={{height:`${Math.max(4,day.record.stress*10)}%`}} title={`${day.key}: stress ${day.record.stress}/10`}/> : <div className="trend-missing" title={`${day.key}: no check-in`}>—</div>}</div><small>{day.label}</small></div>)}</div></div></div><div className="trend-legend"><span><i className="legend-energy"/> Energy</span><span><i className="legend-stress"/> Stress</span><span>— No saved check-in</span></div></section><section className="panel generic-panel"><h3>Look back with kindness</h3><p className="muted">What went well, even in a small way?</p><textarea value={reflections[todayKey] ?? ''} onChange={e=>setReflections(old=>({...old,[todayKey]:e.target.value}))} placeholder="Today, I’m glad that…"/><div className="reflection-prompts"><button onClick={()=>setReflections(old=>({...old,[todayKey]:(old[todayKey] ?? '')+'\nOne thing I handled well: '}))}>One thing I handled well</button><button onClick={()=>setReflections(old=>({...old,[todayKey]:(old[todayKey] ?? '')+'\nSomething I can let go of: '}))}>Something to let go of</button><button onClick={()=>setReflections(old=>({...old,[todayKey]:(old[todayKey] ?? '')+'\nTomorrow, I’ll start with: '}))}>A gentle start tomorrow</button></div><button className="primary-button" onClick={async()=>{ const savedReflection = reflections[todayKey] ?? ''; const record: DailyRecord = {date:todayKey,tasksTotal:todayTasks.length,tasksCompleted:completed,mood,energy,stress,reflection:savedReflection,updatedAt:new Date().toISOString()}; const nextHistory = {...history,[todayKey]:record}; setHistory(nextHistory); try { localStorage.setItem(STORAGE_KEY, JSON.stringify({tasks,events,mood,energy,stress,reflection,goal,financeNote,reflections,history:nextHistory,finance,transactions,goals} satisfies SavedState)); } catch { /* Keep the in-memory review available if device storage is unavailable. */ } if (supabase && user && cloudReady) { const {error} = await supabase.from('user_workspace').upsert({user_id:user.id,data:{tasks,events,mood,energy,stress,reflection,goal,financeNote,reflections,history:nextHistory,finance,transactions,goals}},{onConflict:'user_id'}); if(error) { notify('Review saved on this device, but cloud sync failed.'); return } } notify('Today’s review saved to history.') }}>Save today’s review</button></section><section className="panel generic-panel"><div className="panel-heading"><div><h3>Recent daily history</h3><p>Your past days stay saved separately.</p></div><span className="eyebrow">LAST 7 DAYS</span></div>{recentRecords.length ? recentRecords.map(record=><div className="task-row" key={record.date}><div className="round-icon lilac"><BookOpen size={16}/></div><div className="task-main"><b>{new Intl.DateTimeFormat('en',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${record.date}T12:00:00Z`))}</b><span>{record.tasksCompleted}/{record.tasksTotal} tasks · Mood: {record.mood} · Energy {record.energy}/10 · Stress {record.stress}/10</span>{record.reflection && <small>{record.reflection}</small>}</div></div>) : <div className="empty-state">No saved reviews yet. Write a reflection and press “Save today’s review” to create your first record.</div>}</section></> }

        {section === 'Settings' && <>
          <PageTitle eyebrow="YOUR ACCOUNT, YOUR CONTROL" title="Settings" sub="Manage your profile, sign-in details and account security."/>
          <section className="panel generic-panel backup-panel"><div className="settings-section-title"><div className="round-icon lilac"><ShieldCheck size={19}/></div><div><h3>Data backup & recovery</h3><p className="muted">Download a copy of your Personal OS data or restore it from a backup file.</p></div></div><p className="scope-hint">Backups may contain personal reflections and financial records. Keep the file somewhere private. Restoring replaces the data currently stored in this browser.</p><div className="backup-actions"><button className="secondary-button" onClick={()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)throw new Error('No saved data was found on this device.');const parsed=JSON.parse(raw);const blob=new Blob([JSON.stringify({app:'Personal OS',formatVersion:1,exportedAt:new Date().toISOString(),data:parsed},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='personal-os-backup-'+tehranDateKey()+'.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);notify('Backup file created. Store it somewhere private.')}catch(err){notify(err instanceof Error?err.message:'Could not create backup.')}}}><ArrowDownRight size={15}/> Export backup</button><label className="secondary-button backup-import"><ArrowUpRight size={15}/> Restore backup<input type="file" accept="application/json,.json" onChange={async e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(!file)return;if(file.size>5*1024*1024){notify('Backup file is too large (maximum 5 MB).');return}try{const parsed=JSON.parse(await file.text());const data=parsed?.app==='Personal OS'&&parsed?.formatVersion===1?parsed.data:parsed;if(!data||!Array.isArray(data.tasks)||typeof data.mood!=='string'||typeof data.energy!=='number'||typeof data.stress!=='number'||typeof data.reflections!=='object'||!data.finance||typeof data.finance!=='object'){notify('This file does not look like a valid Personal OS backup.');return}if(!window.confirm('Restore this backup? Current data in this browser will be replaced. Export a backup first if you may need the current data.'))return;const safe={tasks:normalizeTasks(data.tasks),events:Array.isArray(data.events)?data.events:[],mood:data.mood,energy:data.energy,stress:data.stress,reflection:typeof data.reflection==='string'?data.reflection:'',goal:typeof data.goal==='string'?data.goal:'',financeNote:typeof data.financeNote==='string'?data.financeNote:'',reflections:data.reflections,history:data.history&&typeof data.history==='object'?data.history:{},finance:data.finance,transactions:Array.isArray(data.transactions)?data.transactions:[],goals:Array.isArray(data.goals)?data.goals:[]};localStorage.setItem(STORAGE_KEY,JSON.stringify(safe));setTasks(safe.tasks);setEvents(safe.events);setMood(safe.mood);setEnergy(safe.energy);setStress(safe.stress);setReflection(safe.reflection);setGoal(safe.goal);setFinanceNote(safe.financeNote);setReflections(safe.reflections);setHistory(safe.history);setFinance(safe.finance);setTransactions(safe.transactions);setGoals(safe.goals);notify('Backup restored on this device. If signed in, cloud sync will follow.')}catch(err){notify(err instanceof Error?err.message:'Could not read this backup file.')}}}/></label></div></section>
          {!user && <section className="panel generic-panel"><h3>Sign in to manage your account</h3><p className="muted">Sign in first to change your email, password or profile photo.</p><button className="primary-button" onClick={() => {setCloudPanel(true);setAuthMode('signin');setCloudMessage('')}}>Open sign in <ArrowRight size={15}/></button></section>}
          {user && supabase && <>
            <section className="panel generic-panel"><div className="settings-section-title"><div className="round-icon lilac"><UserRound size={19}/></div><div><h3>Profile</h3><p className="muted">Your name and profile picture.</p></div></div>
              <div className="profile-editor"><div className="profile-photo-large">{profileAvatar ? <img src={profileAvatar} alt="Profile"/> : <span>{(profileName || user.email || 'M').slice(0,1).toUpperCase()}</span>}</div>
              <label className="secondary-button photo-upload"><Camera size={15}/> Choose photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(!file)return;if(file.size>8*1024*1024){notify('Choose a photo smaller than 8 MB.');return}try{const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not read photo.'));reader.onload=()=>resolve(String(reader.result));reader.readAsDataURL(file)});const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Could not open photo.'));image.src=data});const canvas=document.createElement('canvas');const scale=Math.min(1,256/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing unavailable.');ctx.drawImage(img,0,0,canvas.width,canvas.height);const compressed=canvas.toDataURL('image/jpeg',0.7);if(compressed.length>45000){notify('This photo is still too large for a profile image. Choose a simpler or smaller image.');return}setProfileAvatar(compressed);notify('Photo selected. Save profile to apply it.')}catch(err){notify(err instanceof Error?err.message:'Photo could not be processed.')}}}/></label>{profileAvatar && <button type="button" className="text-button remove-photo" onClick={()=>setProfileAvatar('')}>Remove photo</button>}</div>
              <form className="settings-form" onSubmit={async e=>{e.preventDefault();if(!supabase||profileSaving)return;setProfileSaving(true);try{const {error}=await supabase.auth.updateUser({data:{full_name:profileName.trim(),avatar_data:profileAvatar}});if(error){notify('Profile update failed: '+error.message);return}const {data,error:refreshError}=await supabase.auth.getUser();if(refreshError){notify('Profile saved, but could not refresh account details. Reload the page to verify.');return}if(data.user)setUser(data.user);notify('Profile saved successfully.')}catch(err){notify(err instanceof Error?err.message:'Profile update failed. Please try again.')}finally{setProfileSaving(false)}}}><label>Display name<input value={profileName} onChange={e=>setProfileName(e.target.value)} maxLength={80} placeholder="Your name"/></label><button className="primary-button" disabled={profileSaving}>{profileSaving?'Saving…':'Save profile'}</button></form>
            </section>
            <section className="panel generic-panel"><div className="settings-section-title"><div className="round-icon mint"><Mail size={18}/></div><div><h3>Email address</h3><p className="muted">Changing email may require confirmation in your inbox.</p></div></div>
              <form className="settings-form" onSubmit={async e=>{e.preventDefault();if(!supabase||profileSaving)return;const clean=newEmail.trim().toLowerCase();if(!clean||clean===user.email?.toLowerCase()){notify('Enter a different email address.');return}setProfileSaving(true);try{const {error}=await supabase.auth.updateUser({email:clean});if(error){notify(error.message.toLowerCase().includes('rate limit')?'Email sending is temporarily limited. Wait before requesting another confirmation email.':'Email change failed: '+error.message);return}notify('Email change requested. Confirm the new address using the email sent by Supabase; your account will keep the old address until confirmation.')}catch(err){notify(err instanceof Error?err.message:'Email change failed. Please try again.')}finally{setProfileSaving(false)}}}><label>Current email<input value={user.email??''} readOnly/></label><label>New email<input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} required autoComplete="email"/></label><button className="secondary-button" disabled={profileSaving}>{profileSaving?'Saving…':'Change email'}</button></form>
            </section>
            <section className="panel generic-panel"><div className="settings-section-title"><div className="round-icon peach"><LockKeyhole size={18}/></div><div><h3>Password & security</h3><p className="muted">If you originally signed in with an email link and never created a password, use the email setup option below.</p></div></div>
              <form className="settings-form" onSubmit={async e=>{e.preventDefault();if(!supabase)return;if(settingsPassword.length<8){notify('Password must be at least 8 characters.');return}if(settingsPassword!==settingsPasswordConfirm){notify('The passwords do not match.');return}setProfileSaving(true);try{const {error}=await supabase.auth.updateUser({password:settingsPassword});if(error){notify('Password change failed: '+error.message);return}setSettingsPassword('');setSettingsPasswordConfirm('');notify('Password changed successfully.')}catch(err){notify(err instanceof Error?err.message:'Password change failed. Please try again.')}finally{setProfileSaving(false)}}}><label>New password<input type="password" value={settingsPassword} onChange={e=>setSettingsPassword(e.target.value)} minLength={8} required autoComplete="new-password"/></label><label>Confirm password<input type="password" value={settingsPasswordConfirm} onChange={e=>setSettingsPasswordConfirm(e.target.value)} minLength={8} required autoComplete="new-password"/></label><button className="secondary-button" disabled={profileSaving}>{profileSaving?'Updating…':'Update password'}</button></form>
              <div className="settings-recovery"><p className="muted">Can’t set a password because this account was created with a magic link? We’ll send a secure link to your current email so you can create or reset the password.</p><button className="secondary-button" disabled={profileSaving} onClick={async()=>{if(!supabase||!user.email)return;setProfileSaving(true);try{const redirectTo=new URL(import.meta.env.BASE_URL,window.location.origin).toString();const {error}=await supabase.auth.resetPasswordForEmail(user.email,{redirectTo});if(error){notify('Password setup email failed: '+error.message);return}notify('Password setup link sent to '+user.email+'. Open the email on this device, then save your new password.')}catch(err){notify(err instanceof Error?err.message:'Could not send password setup email.')}finally{setProfileSaving(false)}}}>Email me a password setup link</button></div>
            </section>
            <section className="panel generic-panel settings-signout"><div><h3>Sign out</h3><p className="muted">Disconnect this device from your private workspace.</p></div><button className="secondary-button" onClick={async()=>{if(!supabase)return;const {error}=await supabase.auth.signOut();if(error){notify('Sign out failed: '+error.message);return}setUser(null);setCloudReady(false);setCloudPanel(false);notify('Signed out. Local data remains on this device.')}}>Sign out</button></section>
          </>}
        </>}
        {section === 'Anxiety Tracker' && <><PageTitle eyebrow="OPTIONAL · NON-DIAGNOSTIC" title="Anxiety check-in" sub="Notice what is present without judging or forcing change."/><div className="safety-note"><Heart size={18}/><span>This is a personal reflection tool, not a diagnosis or a replacement for professional care. Skip anything that doesn’t feel helpful.</span></div><section className="panel generic-panel"><h3>How intense does stress feel right now?</h3><input className="range" type="range" min="0" max="10" value={stress} onChange={e=>setStress(+e.target.value)}/><div className="range-labels"><span>Calm</span><b>{stress}/10</b><span>Very intense</span></div><h3 className="spaced-heading">What do you notice?</h3><div className="reflection-prompts">{['Racing thoughts','Tension','Restlessness','Fast heartbeat','Hard to focus','Nothing specific'].map(x=><button key={x} onClick={()=>notify(`Noted for now: ${x}`)}>{x}</button>)}</div><p className="muted safety-copy">You don’t need to fight the feeling. If symptoms are new, severe, or medically concerning, seek appropriate medical help.</p></section></>}
        {section === 'Breathe & Focus' && <><PageTitle eyebrow="A SMALL PAUSE" title="Breathe & focus" sub="No need to breathe deeply or hold your breath. Let your breathing stay comfortable."/><section className="panel breathe-panel"><div className={`breath-orb ${breathing?'breath-active':''}`}><div className="breath-orb-inner"><Wind size={30}/><span>{breathing?'Breathe gently':'A moment for you'}</span></div></div><p className="muted">{breathing?'Follow a comfortable, natural rhythm. Stop whenever you like.':'Start a gentle visual pause whenever it feels right.'}</p><button className="primary-button" onClick={()=>setBreathing(v=>!v)}>{breathing?'End pause':'Begin a gentle pause'} {breathing?<X size={16}/>:<ArrowRight size={16}/>}</button><div className="breath-footnote"><ShieldCheck size={15}/> No forced holds · No rapid breathing · Stop at any time</div></section></>}
        <footer className="page-footer"><span>PERSONAL OS <i>·</i> MADE FOR YOUR REAL LIFE</span><span><ShieldCheck size={13}/> {user && cloudReady ? 'Private cloud sync enabled' : 'Device save enabled · Cloud sync optional'}</span></footer>
      </div>
    </main>
  </div>
}

function PageTitle({eyebrow,title,sub}:{eyebrow:string;title:string;sub:string}) { return <div className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="subtitle">{sub}</p></div> }
function InfoCard({icon,title,text,tone}:{icon:React.ReactNode;title:string;text:string;tone:string}) { return <section className="panel info-card"><div className={`round-icon ${tone}`}>{icon}</div><h3>{title}</h3><p>{text}</p></section> }
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen,
  Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, CloudSun, CreditCard,
  Flower2, Heart, LayoutDashboard, ListTodo, Menu, Moon, MoreHorizontal,
  Plus, Search, Settings2, ShieldCheck, Sparkles, Target, Wind, X
} from 'lucide-react'

type Section = 'Today' | 'Planner' | 'Goals' | 'Wellbeing' | 'Finance' | 'Reviews' | 'Anxiety Tracker' | 'Breathe & Focus'
type Task = { id: number; title: string; time: string; category: string; done: boolean; scope?: 'today' | 'planner'; date?: string }
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
const tehranDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' }).format(date)
const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Tehran' }).format(new Date())
function normalizeTasks(tasks: Task[]): Task[] {
  const today = tehranDateKey()
  return tasks.map(task => ({ ...task, scope: task.scope ?? 'today', date: task.date ?? today }))
}
const STORAGE_KEY = 'personal-os:v1'
type SavedState = { tasks: Task[]; mood: string; energy: number; stress: number; reflection: string; goal: string; financeNote: string; reflections: Record<string, string>; finance: { income: string; essentials: string; commitments: string } }
function loadSavedState(): Partial<SavedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Partial<SavedState> : {}
  } catch { return {} }
}

export default function App() {
  const [section, setSection] = useState<Section>('Today')
  const [tasks, setTasks] = useState<Task[]>(() => normalizeTasks(loadSavedState().tasks ?? initialTasks))
  const [newTask, setNewTask] = useState('')
  const [adding, setAdding] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [mood, setMood] = useState(() => loadSavedState().mood ?? 'Okay')
  const [energy, setEnergy] = useState(() => loadSavedState().energy ?? 3)
  const [stress, setStress] = useState(() => loadSavedState().stress ?? 3)
  const [reflection, setReflection] = useState(() => loadSavedState().reflection ?? '')\n  const [goal, setGoal] = useState(() => loadSavedState().goal ?? '')\n  const [financeNote, setFinanceNote] = useState(() => loadSavedState().financeNote ?? '')\n  const [reflections, setReflections] = useState<Record<string, string>>(() => loadSavedState().reflections ?? {})
  const [breathing, setBreathing] = useState(false)
  const [notice, setNotice] = useState('')
  const [finance, setFinance] = useState(() => loadSavedState().finance ?? { income: '0', essentials: '0', commitments: '0' })
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [cloudPanel, setCloudPanel] = useState(false)
  const [cloudMessage, setCloudMessage] = useState('')
  const [cloudReady, setCloudReady] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, mood, energy, stress, reflection, goal, financeNote, reflections, finance } satisfies SavedState)) }
    catch { /* Storage may be unavailable in private browsing; the app remains usable for this session. */ }
  }, [tasks, mood, energy, stress, reflection, goal, financeNote, reflections, finance])

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
        if (saved.mood) setMood(saved.mood)
        if (saved.energy !== undefined) setEnergy(saved.energy)
        if (saved.stress !== undefined) setStress(saved.stress)
        if (saved.reflection !== undefined) setReflection(saved.reflection)\n        if (saved.goal !== undefined) setGoal(saved.goal)\n        if (saved.financeNote !== undefined) setFinanceNote(saved.financeNote)\n        if (saved.reflections) setReflections(saved.reflections)
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
      const payload = { tasks, mood, energy, stress, reflection, goal, financeNote, reflections, finance }
      const { error } = await client.from('user_workspace').upsert({ user_id: user.id, data: payload }, { onConflict: 'user_id' })
      setCloudMessage(error ? 'Cloud sync issue. Your data is still saved on this device.' : 'Synced securely to your private account.')
    }, 650)
    return () => window.clearTimeout(timer)
  }, [user?.id, cloudReady, tasks, mood, energy, stress, reflection, goal, financeNote, reflections, finance])

  async function sendSignInLink() {
    if (!supabase) return
    if (!email.trim()) { setCloudMessage('Enter your email address first.'); return }
    const redirectUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectUrl } })
    setCloudMessage(error ? error.message : 'Sign-in link sent. Open the email on this device to connect your account.')
  }

  const todayKey = tehranDateKey()
  const todayTasks = tasks.filter(t => (t.scope ?? 'today') === 'today' && (t.date ?? todayKey) === todayKey)
  const completed = todayTasks.filter(t => t.done).length
  const greeting = useMemo(() => {
    const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Tehran' }).format(new Date()))
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  }, [])

  function addTask() {
    if (!newTask.trim()) return
    setTasks(old => [...old, { id: Date.now(), title: newTask.trim(), time: 'Anytime', category: 'Personal', done: false, scope: section === 'Planner' ? 'planner' : 'today', date: section === 'Planner' ? undefined : todayKey }])
    setNewTask(''); setAdding(false)
  }
  function selectSection(name: Section) {
    setSection(name); setMobileMenu(false); setNotice('')
  }
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3200) }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={21}/></div><div><strong>personal<span>.</span>os</strong><small>YOUR SPACE, YOUR PACE</small></div><button className="icon-btn close-menu" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18}/></button></div>
      <button className="workspace" onClick={() => notify('Personal space · Settings will be available in a later step')}><div className="avatar">M</div><div><b>My personal space</b><small>Private workspace</small></div><ChevronDown size={15}/></button>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(item => <button key={item.name} className={`nav-item ${section === item.name ? 'active' : ''}`} onClick={() => selectSection(item.name)}><item.icon size={18}/><span>{item.name}</span>{item.name === 'Today' && <span className="nav-count">{tasks.filter(t => !t.done).length}</span>}</button>)}</nav>
      <div className="nav-label tools-label">PERSONAL TOOLS</div>
      <nav>{extras.map(item => <button key={item.name} className={`nav-item ${section === item.name ? 'active' : ''}`} onClick={() => selectSection(item.name)}><item.icon size={18}/><span>{item.name}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="calm-card"><div className="calm-icon"><Flower2 size={19}/></div><b>A little reminder</b><p>You don’t have to do everything. Just the next kind thing.</p><span>ONE STEP AT A TIME</span></div><button className="nav-item" onClick={() => notify('Settings will be added in a later step')}><Settings2 size={18}/><span>Settings</span></button><div className="profile"><div className="avatar">M</div><div><b>My profile</b><small>Personal account</small></div><MoreHorizontal size={19}/></div></div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation"/>}
    <main className="main">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="crumb">My space <span>/</span> <b>{section}</b></div></div><div className="top-actions"><button className="search-button" onClick={() => notify('Search will be available in a later step')}><Search size={16}/><span>Search anything</span><kbd>⌘ K</kbd></button><button className="icon-btn" onClick={() => notify('You’re all caught up')} aria-label="Notifications"><Bell size={18}/><i/></button><button className="top-avatar cloud-avatar" onClick={() => setCloudPanel(v => !v)} aria-label="Cloud sync account">{user ? '✓' : 'M'}</button></div></header>
      <div className="page-content">
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
          <div className="section-heading"><div><h2>Your day, at a glance</h2><p>Keep it kind. Keep it realistic.</p></div><button className="text-button" onClick={() => selectSection('Planner')}>Open planner <ArrowRight size={15}/></button></div>
          <div className="dashboard-grid"><section className="panel task-panel" id="task-list"><div className="panel-heading"><div><h3>Today’s priorities</h3><p>A short list is enough.</p></div><button className="add-btn" onClick={() => setAdding(!adding)}><Plus size={16}/> Add task</button></div>{adding && <form className="add-task" onSubmit={e => {e.preventDefault();addTask()}}><input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="What would you like to do?" autoFocus/><button type="submit" aria-label="Save task"><Check size={17}/></button></form>}<div className="task-list">{todayTasks.map((task, i) => <div className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id}><button className={`task-check ${task.done ? 'checked' : ''}`} onClick={() => setTasks(old => old.map(t => t.id === task.id ? {...t, done: !t.done} : t))} aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}>{task.done && <Check size={13}/>}</button><div className="task-main"><b>{task.title}</b><span>{task.category}</span></div><div className="task-time"><Clock3 size={13}/>{task.time}</div><button className="row-more" aria-label="Remove task" onClick={() => setTasks(old => old.filter(t => t.id !== task.id))}><X size={14}/></button></div>)}{todayTasks.length === 0 && <div className="empty-state">A clean slate. Add one small task to begin.</div>}</div><button className="panel-footer" onClick={() => selectSection('Planner')}>View all tasks <ArrowRight size={14}/></button></section>
            <div className="right-stack"><section className="panel mood-panel"><div className="panel-heading"><div><h3>How are you feeling?</h3><p>Just a moment to check in.</p></div><div className="round-icon peach"><Heart size={18}/></div></div><div className="mood-options">{[['Low','☁'],['Okay','◒'],['Good','☀'],['Great','✳']].map(([label,emoji]) => <button key={label} onClick={() => setMood(label)} className={`mood-option ${mood === label ? 'mood-selected' : ''}`}><span>{emoji}</span><small>{label}</small></button>)}</div><div className="mood-saved"><span className="mood-dot"/>{mood === 'Okay' ? 'It’s okay to be where you are.' : `Noted: feeling ${mood.toLowerCase()} today.`}</div></section><section className="quote-card"><div className="quote-mark">“</div><p>You are allowed to move at the speed of your own healing.</p><span>A GENTLE REMINDER</span><div className="quote-flower">✳</div></section></div></div>
          <div className="bottom-grid"><button className="mini-card" onClick={() => selectSection('Goals')}><div className="mini-icon lilac"><Target size={18}/></div><div><b>Goals & intentions</b><span>Small steps add up</span></div><ArrowUpRight size={16}/></button><button className="mini-card" onClick={() => selectSection('Breathe & Focus')}><div className="mini-icon mint"><Wind size={18}/></div><div><b>Breathe & focus</b><span>Pause for a moment</span></div><ArrowUpRight size={16}/></button><button className="mini-card" onClick={() => selectSection('Finance')}><div className="mini-icon peach"><CreditCard size={18}/></div><div><b>Money overview</b><span>Awareness, not pressure</span></div><ArrowUpRight size={16}/></button></div>
        </>}
        {section === 'Planner' && <><PageTitle eyebrow="MAKE ROOM FOR WHAT MATTERS" title="Your planner" sub="Plan with intention, leave room for life."/><section className="panel generic-panel"><div className="panel-heading"><div><h3>Task list</h3><p>{tasks.filter(t => (t.scope ?? 'today') === 'planner').length} planned items · {tasks.filter(t => (t.scope ?? 'today') === 'planner' && t.done).length} completed</p></div><button className="add-btn" onClick={() => setAdding(!adding)}><Plus size={16}/> Add task</button></div>{adding && <form className="add-task" onSubmit={e => {e.preventDefault();addTask()}}><input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Write a task…" autoFocus/><button type="submit"><Check size={17}/></button></form>}{tasks.filter(t => (t.scope ?? 'today') === 'planner').map(t => <div className={`task-row ${t.done ? 'task-done' : ''}`} key={t.id}><button className={`task-check ${t.done?'checked':''}`} onClick={() => setTasks(old=>old.map(x=>x.id===t.id?{...x,done:!x.done}:x))}>{t.done&&<Check size={13}/>}</button><div className="task-main"><b>{t.title}</b><span>{t.category}</span></div><div className="task-time"><Clock3 size={13}/>{t.time}</div><button className="row-more" aria-label="Remove task" onClick={() => setTasks(old => old.filter(x => x.id !== t.id))}><X size={14}/></button></div>)}{tasks.filter(t => (t.scope ?? 'today') === 'planner').length === 0 && <div className="empty-state">Your planner is clear. Add a task you want to plan ahead.</div>}</section></>}
        {section === 'Goals' && <><PageTitle eyebrow="A DIRECTION, NOT A DEADLINE" title="Goals & intentions" sub="Meaningful progress, without the pressure."/><div className="three-cards"><InfoCard icon={<Target/>} title="This season" text="What would make the next few months feel meaningful?" tone="lilac"/><InfoCard icon={<Heart/>} title="For my wellbeing" text="A small habit that supports your body and mind." tone="peach"/><InfoCard icon={<Sparkles/>} title="One next step" text="Turn an intention into something you can do today." tone="mint"/></div><section className="panel generic-panel"><h3>My intention</h3><textarea value={goal} onChange={e=>setGoal(e.target.value)} placeholder="What matters to me right now?"/><button className="primary-button" onClick={()=>notify('Intention saved on this device')}>Save intention</button></section></>}
        {section === 'Wellbeing' && <><PageTitle eyebrow="CARE WITHOUT KEEPING SCORE" title="Wellbeing" sub="A gentle check-in, not another thing to perfect."/><div className="wellbeing-grid"><section className="panel generic-panel"><div className="round-icon peach"><Heart/></div><h3>How is your energy?</h3><p className="muted">Choose what feels closest today.</p><input className="range" type="range" min="1" max="10" value={energy} onChange={e=>setEnergy(+e.target.value)}/><div className="range-labels"><span>Running low</span><b>{energy}/10</b><span>Plenty of energy</span></div></section><section className="panel generic-panel"><div className="round-icon mint"><Moon/></div><h3>What would support you?</h3><p className="muted">You can choose just one.</p><div className="support-list">{['A proper meal','A short walk','A little rest','Talk to someone','A calmer evening'].map(s=><button key={s} onClick={()=>notify(`Gentle reminder: ${s.toLowerCase()}`)}><CheckCircle2 size={16}/>{s}<ArrowRight size={14}/></button>)}</div></section></div></>}
        {section === 'Finance' && <><PageTitle eyebrow="CLARITY, NOT JUDGEMENT" title="Money overview" sub="A simple snapshot. Your numbers stay yours."/><div className="finance-note"><ShieldCheck size={17}/> Sample values start at zero. Nothing is connected to a bank.</div><div className="finance-grid">{([['Monthly income','income',ArrowUpRight],['Essential costs','essentials',ArrowDownRight],['Debt & commitments','commitments',CreditCard]] as const).map(([label,key,Icon])=><section className="panel finance-card" key={key}><div className="finance-card-top"><span>{label}</span><Icon size={17}/></div><label><span>Amount (your currency)</span><input value={finance[key]} inputMode="decimal" onChange={e=>setFinance(old=>({...old,[key]:e.target.value}))}/></label><small>Saved on this device</small></section>)}</div><section className="panel generic-panel"><h3>One money question</h3><p className="muted">What is the most useful financial decision you can make this week?</p><textarea value={financeNote} onChange={e=>setFinanceNote(e.target.value)} placeholder="Write a note to yourself…"/></section></>}
        {section === 'Reviews' && <><PageTitle eyebrow="NOTICE, LEARN, RESET" title="Daily reflection" sub="A few honest lines are more than enough."/><section className="panel generic-panel"><h3>Look back with kindness</h3><p className="muted">What went well, even in a small way?</p><textarea value={reflections[todayKey] ?? ''} onChange={e=>setReflections(old=>({...old,[todayKey]:e.target.value}))} placeholder="Today, I’m glad that…"/><div className="reflection-prompts"><button onClick={()=>setReflection(v=>v+'
One thing I handled well: ')}>One thing I handled well</button><button onClick={()=>setReflection(v=>v+'
Something I can let go of: ')}>Something to let go of</button><button onClick={()=>setReflection(v=>v+'
Tomorrow, I’ll start with: ')}>A gentle start tomorrow</button></div><button className="primary-button" onClick={()=>notify('Reflection saved on this device')}>Save reflection</button></section></>}
        {section === 'Anxiety Tracker' && <><PageTitle eyebrow="OPTIONAL · NON-DIAGNOSTIC" title="Anxiety check-in" sub="Notice what is present without judging or forcing change."/><div className="safety-note"><Heart size={18}/><span>This is a personal reflection tool, not a diagnosis or a replacement for professional care. Skip anything that doesn’t feel helpful.</span></div><section className="panel generic-panel"><h3>How intense does stress feel right now?</h3><input className="range" type="range" min="0" max="10" value={stress} onChange={e=>setStress(+e.target.value)}/><div className="range-labels"><span>Calm</span><b>{stress}/10</b><span>Very intense</span></div><h3 className="spaced-heading">What do you notice?</h3><div className="reflection-prompts">{['Racing thoughts','Tension','Restlessness','Fast heartbeat','Hard to focus','Nothing specific'].map(x=><button key={x} onClick={()=>notify(`Noted for now: ${x}`)}>{x}</button>)}</div><p className="muted safety-copy">You don’t need to fight the feeling. If symptoms are new, severe, or medically concerning, seek appropriate medical help.</p></section></>}
        {section === 'Breathe & Focus' && <><PageTitle eyebrow="A SMALL PAUSE" title="Breathe & focus" sub="No need to breathe deeply or hold your breath. Let your breathing stay comfortable."/><section className="panel breathe-panel"><div className={`breath-orb ${breathing?'breath-active':''}`}><div className="breath-orb-inner"><Wind size={30}/><span>{breathing?'Breathe gently':'A moment for you'}</span></div></div><p className="muted">{breathing?'Follow a comfortable, natural rhythm. Stop whenever you like.':'Start a gentle visual pause whenever it feels right.'}</p><button className="primary-button" onClick={()=>setBreathing(v=>!v)}>{breathing?'End pause':'Begin a gentle pause'} {breathing?<X size={16}/>:<ArrowRight size={16}/>}</button><div className="breath-footnote"><ShieldCheck size={15}/> No forced holds · No rapid breathing · Stop at any time</div></section></>}
        <footer className="page-footer"><span>PERSONAL OS <i>·</i> MADE FOR YOUR REAL LIFE</span><span><ShieldCheck size={13}/> {user && cloudReady ? 'Private cloud sync enabled' : 'Device save enabled · Cloud sync optional'}</span></footer>
      </div>
    </main>
  </div>
}

function PageTitle({eyebrow,title,sub}:{eyebrow:string;title:string;sub:string}) { return <div className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="subtitle">{sub}</p></div> }
function InfoCard({icon,title,text,tone}:{icon:React.ReactNode;title:string;text:string;tone:string}) { return <section className="panel info-card"><div className={`round-icon ${tone}`}>{icon}</div><h3>{title}</h3><p>{text}</p></section> }

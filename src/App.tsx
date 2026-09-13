import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { Dialog } from 'radix-ui'
import {
  ArrowLeftRight,
  Bell,
  ChartNoAxesCombined,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  FlaskConical,
  House,
  Layers,
  Menu,
  Moon,
  Package,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Wallet,
  X,
} from 'lucide-react'
import { ThemeProvider, useTheme } from './lib/theme'
import { AuthActions } from './components/AuthActions'
import { BrandLogo } from './components/BrandLogo'
import { useWorkspaceSession } from './lib/use-workspace-session'
import type { SyncState } from './lib/workspace-sync'
import { WorkspaceSyncStatus } from './components/WorkspaceSyncStatus'
import {
  canEditModule,
  WorkspaceAccessContext,
} from './components/workspace-access-context'
const WorkspaceAccess = lazy(() =>
  import('./components/WorkspaceAccess').then((module) => ({
    default: module.WorkspaceAccess,
  })),
)
import { Modal, Panel } from './components/workspace-ui'
import {
  catalogCapabilities,
  isCapabilityMuted,
  cutoff,
  dateLabel,
  type Mode,
  type Page,
  type Workspace,
} from './domain/workspace'
import { CapabilityDisplayContext } from './components/capability-context'
import { useDialogFocus } from './components/use-dialog-focus'
import { workspaceNotices } from './domain/notifications'
import { Home, type BusinessPageProps } from './features/business/Home'
const Inventory = lazy(() =>
  import('./features/business/Inventory').then((module) => ({
    default: module.Inventory,
  })),
)
const Dashboards = lazy(() =>
  import('./features/business/Dashboards').then((module) => ({
    default: module.Dashboards,
  })),
)
const Finance = lazy(() =>
  import('./features/business/Finance').then((module) => ({
    default: module.Finance,
  })),
)
const Catalog = lazy(() =>
  import('./features/business/CatalogSettings').then((module) => ({
    default: module.Catalog,
  })),
)
const Settings = lazy(() =>
  import('./features/business/CatalogSettings').then((module) => ({
    default: module.Settings,
  })),
)
import type { DataSection } from './features/data/Onboarding'
const Onboarding = lazy(() =>
  import('./features/data/Onboarding').then((module) => ({
    default: module.Onboarding,
  })),
)
const AnalysisPage = lazy(() =>
  import('./features/analysis/AnalysisPage').then((module) => ({
    default: module.AnalysisPage,
  })),
)

const navigation = [
  { page: 'home', name: 'Home', icon: House },
  { page: 'inventory', name: 'Inventory', icon: Package },
  { page: 'dashboards', name: 'Dashboards', icon: ChartColumn },
  { page: 'analysis', name: 'Forecast & Simulate', icon: ChartNoAxesCombined },
  { page: 'finance', name: 'Finance', icon: Wallet },
  { page: 'data', name: 'Add-ons & Data', icon: Layers },
  { page: 'settings', name: 'Settings', icon: SettingsIcon },
] satisfies { page: Page; name: string; icon: typeof House }[]

type Route = { mode: Mode; page: Page; query: string }

function readRoute(): Route {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?')
  const [environment, section] = path.split('/')
  const mode: Mode = environment === 'demo' ? 'demo' : 'business'
  const page: Page = navigation.some((n) => n.page === section)
    ? (section as Page)
    : 'home'
  return { mode, page, query }
}
export default function App() {
  return (
    <ThemeProvider>
      <WorkspaceErrorBoundary>
        <WorkspaceApp />
      </WorkspaceErrorBoundary>
    </ThemeProvider>
  )
}
function WorkspaceApp() {
  const drawerFocus = useDialogFocus()
  const [route, setRoute] = useState(readRoute)
  const [intake, setIntake] = useState<{
      section?: DataSection
      key: number
    } | null>(null),
    [drawer, setDrawer] = useState(false),
    [switcher, setSwitcher] = useState(false),
    [help, setHelp] = useState(false),
    [updates, setUpdates] = useState(false)
  const {
    stores,
    business,
    demo,
    workspaces,
    update,
    selectWorkspace,
    toast,
    setToast,
  } = useWorkspaceSession()
  const syncState = route.mode === 'demo' ? demo : business
  const w = workspaces[route.mode],
    pageName = navigation.find((n) => n.page === route.page)?.name ?? 'Home'
  useEffect(() => {
    const listener = () => {
      setRoute(readRoute())
      setIntake(null)
      setDrawer(false)
    }
    window.addEventListener('hashchange', listener)
    return () => window.removeEventListener('hashchange', listener)
  }, [])
  useEffect(() => {
    document.title = `${pageName} · SAMBY`
    document.querySelector<HTMLElement>('main h1')?.focus()
  }, [pageName, route.mode])
  const navigate = useCallback(
    (page: Page, query = '') => {
      location.hash = `/${route.mode}/${page}${query ? `?${query}` : ''}`
      setDrawer(false)
    },
    [route.mode, setDrawer],
  )
  const openIntake = useCallback(
    (section?: DataSection) => {
      if (
        !canEditModule(
          syncState.role,
          !section || section === 'profile' ? 'settings' : section,
        )
      ) {
        setToast(
          'Your role can inspect these records. An authorized workspace member can add or change them.',
        )
        return
      }
      setIntake({ section, key: Date.now() })
    },
    [syncState.role, setToast, setIntake],
  )
  function applyIntake(next: Workspace) {
    const unlocked = catalogCapabilities.filter(
      (c) => !c.check(w) && c.check(next) && !isCapabilityMuted(c, next),
    )
    update({
      ...next,
      notifications: canEditModule(syncState.role, 'settings')
        ? {
            ...next.notifications,
            unlocked: [
              ...new Set([
                ...(next.notifications.unlocked ?? []),
                ...unlocked.map((c) => c.id),
              ]),
            ],
          }
        : w.notifications,
    })
    if (
      unlocked.length &&
      next.notifications.enabled &&
      next.notifications.severity === 'all'
    )
      setToast(
        `${unlocked.length} capabilities now have usable inputs. Review their scope in Add-ons & Data.`,
      )
  }
  function changeMode(mode: Mode) {
    setSwitcher(false)
    setIntake(null)
    location.hash = `/${mode}/home`
    if (mode === route.mode) setRoute(readRoute())
  }
  const props = {
    workspace: w,
    onChange: update,
    onNavigate: navigate,
    onIntake: openIntake,
  }
  return (
    <WorkspaceAccessContext.Provider value={syncState.role}>
      <CapabilityDisplayContext.Provider value={w.muted}>
        <div className="app-shell">
          <aside className="sidebar">
            <WorkspaceSidebar
              route={route}
              w={w}
              onClose={() => setDrawer(false)}
              onSwitch={() => setSwitcher(true)}
              onHelp={() => setHelp(true)}
              changeMode={changeMode}
            />
          </aside>
          <div className="main-shell">
            <WorkspaceTopbar
              route={route}
              w={w}
              pageName={pageName}
              onOpenDrawer={() => setDrawer(true)}
              onUpdates={() => setUpdates(true)}
              onSettings={() => navigate('settings')}
            />
            {route.mode === 'demo' && (
              <div className="demo-strip">
                <span>
                  <strong>Demo workspace</strong>Synthetic records. Your
                  business data stays separate.
                </span>
                <button onClick={() => changeMode('business')}>
                  Exit demo
                </button>
              </div>
            )}
            <main id="main-content" className="content" key={route.mode}>
              <WorkspaceSyncStatus
                state={syncState}
                sync={stores[route.mode]}
              />
              {syncState.role !== 'administrator' &&
                syncState.role !== 'owner' && (
                  <p className="notice small">
                    Your workspace role is <strong>{syncState.role}</strong>.
                    Available editing actions follow your assigned access.
                  </p>
                )}
              {w.muted.length > 0 && route.page !== 'analysis' && (
                <p className="notice small">
                  {w.muted.length} capability displays are muted.{' '}
                  <button
                    className="text-button"
                    onClick={() => navigate('data')}
                  >
                    Manage visibility
                  </button>{' '}
                  Source records and saved results remain available.
                </p>
              )}
              <Suspense
                fallback={
                  <p role="status" className="notice">
                    Loading this view…
                  </p>
                }
              >
                <WorkspacePage
                  {...props}
                  route={route}
                  syncState={syncState}
                  selectWorkspace={selectWorkspace}
                />
              </Suspense>
            </main>
          </div>
          <Modal
            open={intake !== null}
            onClose={() => setIntake(null)}
            title={
              intake?.section
                ? 'Add business information'
                : 'Start with the data you have'
            }
            description="Review each interpretation before applying records. Optional data can wait."
            wide
          >
            {intake && (
              <Suspense
                fallback={
                  <p role="status" className="notice">
                    Opening data review…
                  </p>
                }
              >
                <Onboarding
                  key={`${w.id}-${intake.key}`}
                  workspace={w}
                  onChange={applyIntake}
                  onFirstDecision={(question) => {
                    setIntake(null)
                    navigate('analysis', `question=${question}`)
                  }}
                  onViewResult={(page) => {
                    setIntake(null)
                    navigate(page)
                  }}
                  onClose={() => {
                    setIntake(null)
                    navigate('home')
                  }}
                  initialSection={intake.section}
                />
              </Suspense>
            )}
          </Modal>
          <Dialog.Root open={drawer} onOpenChange={setDrawer}>
            <Dialog.Portal>
              <Dialog.Overlay className="modal-overlay" />
              <Dialog.Content
                {...drawerFocus}
                className="modal-content drawer-content"
                aria-describedby={undefined}
              >
                <Dialog.Title className="sr-only">
                  Workspace navigation
                </Dialog.Title>
                <aside className="sidebar">
                  <WorkspaceSidebar
                    route={route}
                    w={w}
                    onClose={() => setDrawer(false)}
                    onSwitch={() => setSwitcher(true)}
                    onHelp={() => setHelp(true)}
                    changeMode={changeMode}
                  />
                </aside>
                <Dialog.Close
                  className="icon-button"
                  aria-label="Close navigation"
                  style={{ position: 'absolute', right: 10, top: 12 }}
                >
                  <X size={18} />
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <WorkspaceSwitcher
            open={switcher}
            onClose={() => setSwitcher(false)}
            businessName={workspaces.business.profile.name}
            changeMode={changeMode}
          />
          <WorkspaceHelp
            open={help}
            onClose={() => setHelp(false)}
            navigate={navigate}
          />
          <WorkspaceNotifications
            open={updates}
            onClose={() => setUpdates(false)}
            w={w}
            update={update}
            navigate={navigate}
          />
          {toast && (
            <div className="toast" role="status">
              {toast}
              <button
                aria-label="Dismiss notification"
                onClick={() => setToast('')}
                className="icon-button"
                style={{ color: 'white', marginLeft: 12 }}
              >
                <X size={15} />
              </button>
            </div>
          )}
        </div>
      </CapabilityDisplayContext.Provider>
    </WorkspaceAccessContext.Provider>
  )
}

function WorkspaceSidebar({
  route,
  w,
  onClose,
  onSwitch,
  onHelp,
  changeMode,
}: {
  route: Route
  w: Workspace
  onClose: () => void
  onSwitch: () => void
  onHelp: () => void
  changeMode: (mode: Mode) => void
}) {
  return (
    <>
      <a
        href={`#/${route.mode}/home`}
        className="brand"
        aria-label="SAMBY home"
        onClick={onClose}
      >
        <BrandLogo decorative />
      </a>
      <button className="workspace-switch" onClick={onSwitch}>
        <span className="workspace-avatar">
          {w.profile.name
            ? w.profile.name
                .split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')
            : 'MY'}
        </span>
        <span className="workspace-title">
          <strong>{w.profile.name || 'My business'}</strong>
          <small>
            {route.mode === 'demo'
              ? 'Demonstration workspace'
              : 'Business workspace'}
          </small>
        </span>
        <ChevronDown size={14} />
      </button>
      <p className="nav-label">Workspace</p>
      <nav className="primary-nav" aria-label="Main navigation">
        {navigation.map(({ page, name, icon: Icon }) => (
          <a
            key={page}
            className={`nav-item ${route.page === page ? 'active' : ''}`}
            href={`#/${route.mode}/${page}`}
            aria-current={route.page === page ? 'page' : undefined}
            onClick={onClose}
          >
            <Icon size={17} strokeWidth={1.65} />
            {name}
            {page === 'data' && (
              <span className="nav-count">
                {catalogCapabilities.filter((c) => c.check(w)).length}
              </span>
            )}
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="prototype-card">
          <BrandLogo variant="white" className="prototype-logo" />
          <strong>
            <FlaskConical size={15} />
            {route.mode === 'demo'
              ? 'Explore, with context.'
              : 'See SAMBY in action.'}
          </strong>
          <p>
            {route.mode === 'demo'
              ? 'Every number here comes from a separate demonstration dataset.'
              : 'A separate demo lets you explore the product with example records.'}
          </p>
          <button
            onClick={() =>
              changeMode(route.mode === 'demo' ? 'business' : 'demo')
            }
          >
            {route.mode === 'demo'
              ? 'Return to my workspace'
              : 'Explore demo workspace'}
            <ChevronRight size={14} />
          </button>
        </div>
        <button className="nav-item" onClick={onHelp}>
          <CircleHelp size={17} />
          Help & product guide
        </button>
        <div className="sidebar-status">
          <span className="status-dot" />
          SAMBY v0.4
        </div>
      </div>
    </>
  )
}

function WorkspaceTopbar({
  route,
  w,
  pageName,
  onOpenDrawer,
  onUpdates,
  onSettings,
}: {
  route: Route
  w: Workspace
  pageName: string
  onOpenDrawer: () => void
  onUpdates: () => void
  onSettings: () => void
}) {
  const { resolvedTheme, toggleTheme } = useTheme()
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button
          className="icon-button mobile-menu"
          aria-label="Open navigation"
          onClick={onOpenDrawer}
        >
          <Menu size={20} />
        </button>
        <a
          href={`#/${route.mode}/home`}
          className="mobile-brand"
          aria-label="SAMBY home"
        >
          <BrandLogo variant="symbol" decorative />
        </a>
        <House size={14} className="breadcrumb-home" />
        <span className="breadcrumb-workspace">Workspace</span>
        <ChevronRight size={12} className="breadcrumb-separator" />
        <strong>{pageName}</strong>
      </div>
      <div className="topbar-actions">
        <span className="topbar-date">
          {dateLabel(cutoff(w))}, {cutoff(w).slice(0, 4)}
        </span>
        <button
          className="icon-button theme-toggle"
          aria-label={
            resolvedTheme === 'dark'
              ? 'Switch to light theme'
              : 'Switch to dark theme'
          }
          title={
            resolvedTheme === 'dark'
              ? 'Switch to light theme'
              : 'Switch to dark theme'
          }
          onClick={toggleTheme}
        >
          {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          className="icon-button"
          aria-label="View notifications"
          onClick={onUpdates}
        >
          <Bell size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Open account settings"
          onClick={onSettings}
        >
          <span className="avatar">
            {w.profile.name
              ? w.profile.name
                  .split(' ')
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')
              : 'MY'}
          </span>
        </button>
      </div>
    </header>
  )
}

function WorkspacePage({
  route,
  syncState,
  selectWorkspace,
  ...props
}: BusinessPageProps & {
  route: Route
  syncState: SyncState
  selectWorkspace: (id: string) => Promise<void>
}) {
  const { workspace: w } = props
  const params = new URLSearchParams(route.query)
  switch (route.page) {
    case 'home':
      return <Home {...props} />
    case 'inventory':
      return (
        <Inventory
          key={params.get('filter') ?? 'inventory'}
          {...props}
          initialFilter={params.get('filter') ?? undefined}
        />
      )
    case 'dashboards':
      return (
        <Dashboards
          key={params.get('family') ?? 'dashboards'}
          {...props}
          initialFamily={params.get('family') ?? undefined}
        />
      )
    case 'finance':
      return (
        <Finance
          key={params.get('tab') ?? 'finance'}
          {...props}
          initialTab={params.get('tab') ?? undefined}
        />
      )
    case 'data':
      return <Catalog {...props} />
    case 'settings':
      return (
        <>
          <Settings {...props} />
          <Panel
            title="Account access"
            subtitle="Sign in to reopen your saved business workspace on another device."
          >
            <div className="panel-body">
              <AuthActions />
            </div>
          </Panel>
          <WorkspaceAccess
            workspace={w}
            role={syncState.role}
            onSelectWorkspace={selectWorkspace}
          />
        </>
      )
    case 'analysis':
      return (
        <AnalysisRoute {...props} query={route.query} ready={syncState.ready} />
      )
  }
}

function AnalysisRoute({
  query,
  ready,
  workspace: w,
  onChange: update,
  onNavigate: navigate,
}: BusinessPageProps & { query: string; ready: boolean }) {
  const params = new URLSearchParams(query)
  return ready ? (
    <AnalysisPage
      key={params.get('question') ?? 'analysis'}
      workspace={w}
      onChange={update}
      initialRunId={params.get('run') ?? undefined}
      initialQuestion={params.get('question') ?? undefined}
      onOpenRun={(id) =>
        navigate('analysis', id ? `run=${encodeURIComponent(id)}` : '')
      }
    />
  ) : (
    <div>
      <h1>Forecast &amp; Simulate</h1>
      <p className="notice" role="status">
        Connect to your workspace to open saved analytical history.
      </p>
    </div>
  )
}

function WorkspaceSwitcher({
  open,
  onClose,
  businessName,
  changeMode,
}: {
  open: boolean
  onClose: () => void
  businessName: string
  changeMode: (mode: Mode) => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose a workspace"
      description="Demo and business records have separate saved workspaces and analytical histories."
    >
      <div className="stack">
        {(['business', 'demo'] as Mode[]).map((mode) => (
          <button
            key={mode}
            className="workspace-option"
            onClick={() => changeMode(mode)}
          >
            <span className="empty-icon">
              {mode === 'demo' ? (
                <FlaskConical size={22} />
              ) : (
                <Database size={22} />
              )}
            </span>
            <span>
              <strong>
                {mode === 'demo'
                  ? 'Demonstration workspace'
                  : businessName || 'My business'}
              </strong>
              <small>
                {mode === 'demo'
                  ? 'Explore coherent synthetic data'
                  : 'Your own records and saved analytical history'}
              </small>
            </span>
            <ArrowLeftRight size={17} />
          </button>
        ))}
      </div>
    </Modal>
  )
}

function WorkspaceHelp({
  open,
  onClose,
  navigate,
}: {
  open: boolean
  onClose: () => void
  navigate: BusinessPageProps['onNavigate']
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="A guide to SAMBY"
      description="Commercial and financial intelligence for distributors and resellers."
    >
      <div className="stack">
        <div>
          <h3>Start with sales or another supported dataset</h3>
          <p className="small muted">
            Use Add data to enter records or review a CSV. Missing values stay
            unknown. Inventory and a full catalog are optional at the start.
          </p>
        </div>
        <div>
          <h3>Keep facts and scenarios separate</h3>
          <p className="small muted">
            Inventory and Finance show your recorded facts. Forecast & Simulate
            saves assumptions and dated results. Scenario changes never execute
            a purchase, collection or payment.
          </p>
        </div>
        <div>
          <h3>Return to your analytical history</h3>
          <p className="small muted">
            The local analytical service stores definitions, input snapshots and
            completed results. Runs continue while you leave a page. History
            remains available even after local business records are removed.
          </p>
        </div>
        <p className="notice small">
          Business records and analytical history are saved to SAMBY. Scenario
          results depend on your supplied data and assumptions. SAMBY does not
          execute payments or warehouse actions.
        </p>
        <button
          className="button primary"
          onClick={() => {
            onClose()
            navigate('data')
          }}
        >
          Explore capabilities
          <Sparkles size={16} />
        </button>
      </div>
    </Modal>
  )
}

function WorkspaceNotifications({
  open,
  onClose,
  w,
  update,
  navigate,
}: {
  open: boolean
  onClose: () => void
  w: Workspace
  update: (workspace: Workspace) => void
  navigate: BusinessPageProps['onNavigate']
}) {
  const notices = workspaceNotices(w)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Workspace notifications"
      description="Optional updates do not change the inline limitations on your results."
    >
      <div className="stack">
        <p className="notice">
          {w.notifications.enabled
            ? 'Optional notifications are enabled.'
            : 'Optional notifications are turned off.'}{' '}
          {catalogCapabilities.filter((c) => c.check(w)).length} capabilities
          have usable inputs. Review their current scope and warnings in Add-ons
          & Data.
        </p>
        {notices.length ? (
          notices.map((notice) => (
            <article className="notification-item stack" key={notice.id}>
              <div className="inline-actions">
                <span className="badge">{notice.type}</span>
                <span className="badge amber">{notice.severity}</span>
              </div>
              <h3>{notice.title}</h3>
              <p className="small muted">{notice.detail}</p>
              <div className="inline-actions">
                <button
                  className="button secondary"
                  onClick={() =>
                    update({
                      ...w,
                      notifications: {
                        ...w.notifications,
                        dismissed: [
                          ...(w.notifications.dismissed ?? []),
                          notice.id,
                        ],
                      },
                    })
                  }
                >
                  Dismiss
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    update({
                      ...w,
                      notifications: {
                        ...w.notifications,
                        snoozedUntil: {
                          ...w.notifications.snoozedUntil,
                          [notice.id]: new Date(
                            Date.now() + 86400000,
                          ).toISOString(),
                        },
                      },
                    })
                  }
                >
                  Snooze for 1 day
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="small muted">
            No optional notices match your preferences. Inline result warnings
            are always retained.
          </p>
        )}
        <button
          className="button secondary"
          onClick={() => {
            onClose()
            navigate('data')
          }}
        >
          Review data readiness
        </button>
        <button
          className="text-button"
          onClick={() => {
            onClose()
            navigate('settings')
          }}
        >
          Notification preferences
          <ChevronRight size={15} />
        </button>
      </div>
    </Modal>
  )
}

class WorkspaceErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? (
      <div className="error-boundary">
        <h1>This view could not be loaded.</h1>
        <p>
          Your saved analytical records remain on the server. Reload the
          workspace to try again.
        </p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    )
  }
}

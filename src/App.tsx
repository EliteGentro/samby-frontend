import { useAuth } from './auth/AuthContext'
import { AuthActions } from './components/AuthActions'
import { DeveloperPanel } from './components/DeveloperPanel'

const capabilities = [
  ['REST + SSE', 'Typed requests and authenticated streaming are ready to extend.'],
  ['Secure by default', 'Argon2 password hashes live in Neon and the API signs its own JWTs.'],
  ['Provider neutral', 'AI options pass through a stable interface, not vendor payloads.'],
]

export default function App() {
  const { isAuthenticated, isLoading, error } = useAuth()

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_50%_-20%,rgba(34,211,238,0.20),transparent_55%)]" />
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <a className="flex items-center gap-3 font-semibold tracking-tight" href="/">
          <span className="grid size-9 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">B</span>
          Base Monolith
        </a>
        <AuthActions />
      </nav>

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
        <section className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Ready for the first feature</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
            A quiet foundation for real-time applications.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            Authentication, persistence, event streaming, tests, and AI plumbing are connected—without choosing your product domain for you.
          </p>
        </section>

        <section className="mt-12 grid gap-3 md:grid-cols-3">
          {capabilities.map(([title, copy]) => (
            <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" key={title}>
              <h2 className="font-semibold text-slate-100">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
            </article>
          ))}
        </section>

        <div className="mt-10">
          {isLoading && <Status>Checking your session…</Status>}
          {error && !isAuthenticated && <Status>Authentication error: {error}</Status>}
          {!isLoading && !error && isAuthenticated && <DeveloperPanel />}
          {!isLoading && !error && !isAuthenticated && (
            <Status>Log in or create an account to open the protected developer sandbox.</Status>
          )}
        </div>
      </div>
    </main>
  )
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center text-sm text-slate-400">
      {children}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { GradientBackground } from './favorites'
import { signIn, verifyCredentials } from '../../data/session'
import { playSound } from '../../utils/sound'

// The sign-in gate — App.tsx renders this instead of the dashboard while
// there's no session (see session.ts). The supplied MercuryLogin look, kept:
// dark stage, gooey blob field with mouse parallax, underline inputs with a
// glow fill, the mercury goo button. Restyled to this product's theme on
// request: the stage is brand navy (not pure black), the blobs run brand
// blue to cyan, and the form sits in a glass card in the app's own glass
// idiom (tinted blur, hairline light border, top inner highlight — the same
// recipe IconRail's capsules and EventBanner's overlay use). Copy talks like
// an event-operations tool, the form is wired to the real session, and the
// two footer links became working demo fillers instead of dead anchors.
//
// Two invisible deviations from the snippet: min-height dvh instead of
// fixed 100vh (mobile browser chrome), and labels linked to their inputs.
const DEMO_ACCOUNTS = [
  { label: 'FILL ADMIN DEMO', email: 'admin@gamefinity.id', password: 'admin123' },
  { label: 'FILL STAFF DEMO', email: 'staff@gamefinity.id', password: 'staff123' },
] as const

// How long the loading bar takes to fill before the session is written —
// the "signing in" beat between a correct submit and the dashboard
// crossfade (see App.tsx). Finite and fast, not ambiance.
const LOADING_MS = 900

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current)
    }
  }, [])

  // Generate static random values once per mount to prevent hydration errors
  const blobsData = useMemo(() => {
    return Array.from({ length: 6 }).map(() => ({
      size: Math.random() * 200 + 150,
      left: Math.random() * 80 + 10,
      top: Math.random() * 80 + 10,
      animationDelay: Math.random() * -20,
      animationDuration: Math.random() * 15 + 15,
    }))
  }, [])

  // Keep track of the blob DOM elements for high-performance updates
  const blobRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth
      const y = e.clientY / window.innerHeight

      // Apply subtle parallax effect to each blob
      blobRefs.current.forEach((blob, index) => {
        if (blob) {
          const speed = (index + 1) * 20
          // Using margins for parallax so we don't overwrite the CSS transform animation
          blob.style.marginLeft = `${x * speed}px`
          blob.style.marginTop = `${y * speed}px`
        }
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [])

  function fillDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    if (loading) return
    setEmail(account.email)
    setPassword(account.password)
    setError(null)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading || !email.trim() || !password) return
    // Verified before anything animates, so a wrong password fails
    // instantly — the loading bar only ever plays for credentials that
    // will actually sign in.
    if (!verifyCredentials(email, password)) {
      playSound('error')
      setError('No account matches that email and password.')
      return
    }
    setError(null)
    setLoading(true)
    timer.current = window.setTimeout(() => {
      // Writes the session key: App mounts the dashboard underneath and
      // crossfades this gate away (see App.tsx).
      playSound('unlock')
      signIn(email, password)
    }, LOADING_MS)
  }

  return (
    <div className="mercury-wrapper">
      <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;800&family=Space+Mono&display=swap&family=Plus+Jakarta+Sans:wght@500;800');

                :root {
                    --bg: #101e33;
                    --mercury: #e0e0e0;
                    --glow: #0060a8;
                    --accent: #101e33;
                    --text-dim: #4d6580;
                    --filter-goo: url('#gooey');
                }

                .mercury-wrapper {
                    background-color: var(--bg);
                    color: var(--accent);
                    color-scheme: light;
                    font-family: 'Inter', sans-serif;
                    min-height: 100dvh;
                    width: 100%;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }

                .mercury-wrapper * {
                    box-sizing: border-box;
                    -webkit-font-smoothing: antialiased;
                }

                /* Background Liquid Physics Simulation */
                .stage {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    z-index: 0;
                    filter: var(--filter-goo);
                    opacity: 0.55;
                }

                .blob {
                    position: absolute;
                    background: linear-gradient(135deg, #0060a8, #54b4f0);
                    border-radius: 50%;
                    filter: blur(20px);
                    animation: float 20s infinite alternate ease-in-out;
                    box-shadow: inset -10px -10px 20px rgba(4, 12, 24, 0.35),
                                10px 10px 30px rgba(0, 96, 168, 0.25);
                    transition: margin 0.1s ease-out; /* Smooths the JS mousemove */
                }

                @keyframes float {
                    0% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(10vw, 20vh) scale(1.2); }
                    66% { transform: translate(-5vw, 10vh) scale(0.8); }
                    100% { transform: translate(5vw, -10vh) scale(1.1); }
                }

                @media (prefers-reduced-motion: reduce) {
                    .blob { animation: none; }
                }

                /* Interface Container — the side drawer's own card language:
                   warm cream, 2rem radius, hairline dark border, the
                   drawer's soft navy shadow, header under a bottom divider
                   like DrawerPanel's own header row. Kept translucent
                   (cream glass, not solid cream) so the blob field still
                   reads behind it. Static: no entrance animation, so the
                   gate can never fail to appear. */
                .auth-container {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    max-width: 440px;
                    margin: 24px;
                    padding: 40px;
                    border-radius: 2rem;
                    background: linear-gradient(135deg, rgba(248, 241, 228, 0.88), rgba(248, 241, 228, 0.68));
                    border: 1px solid rgba(16, 30, 51, 0.08);
                    backdrop-filter: blur(24px) saturate(1.2);
                    -webkit-backdrop-filter: blur(24px) saturate(1.2);
                    box-shadow: 0 20px 60px -15px rgba(16, 30, 51, 0.2),
                                inset 0 1px 0 rgba(255, 255, 255, 0.8);
                }

                .header {
                    margin-bottom: 0;
                    padding-bottom: 28px;
                    border-bottom: 1px solid rgba(16, 30, 51, 0.08);
                    text-align: left;
                }

                .brand-id {
                    font-family: 'Space Mono', monospace;
                    font-size: 10px;
                    letter-spacing: 4px;
                    text-transform: uppercase;
                    color: var(--text-dim);
                    margin-bottom: 8px;
                    display: block;
                }

                .header h1 {
                    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
                    font-weight: 800;
                    font-size: 3rem;
                    line-height: 0.9;
                    letter-spacing: -2px;
                    margin-left: -4px;
                    margin-top: 0;
                }

                .tagline {
                    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
                    font-weight: 500;
                    font-size: 14px;
                    line-height: 1.5;
                    color: rgba(16, 30, 51, 0.75);
                    margin: 12px 0 0;
                }

                /* Bare mark, no tile behind it — the file already carries
                   its own shape. */
                .login-logo {
                    display: block;
                    height: 40px;
                    width: auto;
                    object-fit: contain;
                    margin-bottom: 16px;
                }

                /* Form Elements — body rhythm like a drawer body slot. */
                .auth-container form {
                    margin-top: 28px;
                }

                .form-group {
                    position: relative;
                    margin-bottom: 30px;
                    transition: transform 0.4s cubic-bezier(0.2, 1, 0.3, 1);
                }

                .form-group:focus-within {
                    transform: translateX(10px);
                }

                .form-group label {
                    display: block;
                    font-family: 'Space Mono', monospace;
                    font-size: 11px;
                    color: var(--text-dim);
                    margin-bottom: 12px;
                    text-transform: uppercase;
                }

                .form-group input {
                    width: 100%;
                    background: transparent;
                    border: none;
                    border-bottom: 1px solid rgba(16, 30, 51, 0.25);
                    color: var(--accent);
                    padding: 12px 0;
                    font-size: 18px;
                    outline: none;
                    transition: border-color 0.4s;
                }

                .form-group input:disabled {
                    opacity: 0.7;
                }

                .input-glow {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 0%;
                    height: 2px;
                    background: var(--glow);
                    transition: width 0.6s cubic-bezier(0.2, 1, 0.3, 1);
                    box-shadow: 0 0 15px var(--glow);
                }

                .form-group input:focus + .input-glow {
                    width: 100%;
                }

                .form-error {
                    font-family: 'Space Mono', monospace;
                    font-size: 11px;
                    color: #b8362b;
                    margin: -14px 0 30px;
                }

                /* The Mercury Button */
                .submit-wrap {
                    margin-top: 50px;
                    position: relative;
                    filter: var(--filter-goo);
                }

                .btn-base {
                    background: #ffffff;
                    color: #000;
                    border: 1px solid rgba(16, 30, 51, 0.12);
                    padding: 20px 40px;
                    font-size: 14px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    cursor: pointer;
                    width: 100%;
                    position: relative;
                    z-index: 2;
                    transition: letter-spacing 0.3s;
                }

                .btn-base:hover {
                    letter-spacing: 4px;
                }

                .btn-base:disabled {
                    cursor: default;
                    opacity: 0.85;
                }

                .mercury-drop {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 100%;
                    height: 100%;
                    background: var(--mercury);
                    transform: translate(-50%, -50%);
                    z-index: 1;
                    border-radius: 50px;
                    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .submit-wrap:hover .mercury-drop {
                    transform: translate(-50%, -50%) scale(1.05, 1.2);
                    filter: brightness(1.2);
                }

                /* Loading progress — a rounded bar that fills its whole
                   track (stable caps, full length), brand cyan with glow. */
                .load-track {
                    margin-top: 16px;
                    height: 3px;
                    border-radius: 999px;
                    background: rgba(16, 30, 51, 0.12);
                    overflow: hidden;
                }

                .load-fill {
                    height: 100%;
                    width: 0%;
                    border-radius: 999px;
                    background: var(--glow);
                    box-shadow: 0 0 12px var(--glow);
                    transition: width 0.9s ease;
                }

                .load-fill[data-loading="true"] {
                    width: 100%;
                }

                /* Utility — drawer-footer language: a top divider, then the
                   row. */
                .footer-nav {
                    margin-top: 28px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(16, 30, 51, 0.08);
                    display: flex;
                    justify-content: space-between;
                    font-family: 'Space Mono', monospace;
                    font-size: 10px;
                }

                .footer-nav button {
                    background: none;
                    border: none;
                    padding: 0;
                    font: inherit;
                    color: var(--text-dim);
                    cursor: pointer;
                    transition: color 0.3s;
                }

                .footer-nav button:hover {
                    color: var(--accent);
                }

                .footer-nav button:disabled {
                    cursor: default;
                    opacity: 0.5;
                }

                .demo-hint {
                    margin-top: 16px;
                    font-family: 'Space Mono', monospace;
                    font-size: 10px;
                    color: var(--text-dim);
                    text-align: center;
                }

                /* SVG Filter Definition Hidden Element */
                .svg-filter-hidden {
                    position: absolute;
                    width: 0;
                    height: 0;
                }
            `}</style>

      <svg className="svg-filter-hidden" aria-hidden="true">
        <defs>
          <filter id="gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Capped, centered stage — the same composition as DashboardLayout's
          own shell (max-w-[1600px] column centered on the viewport, the
          flat navy showing through as side bars past the cap) so the gate
          reads as the same product's front door, not a separate site. The
          dashboard wash sits at the back, the goo blob field above it. */}
      <div className="relative flex min-h-dvh w-full max-w-[1600px] items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <GradientBackground className="h-full w-full" />
        </div>
        <div className="stage" id="stage">
          {blobsData.map((data, index) => (
            <div
              key={index}
              ref={(el) => {
                blobRefs.current[index] = el
              }}
              className="blob"
              style={{
                width: `${data.size}px`,
                height: `${data.size}px`,
                left: `${data.left}%`,
                top: `${data.top}%`,
                animationDelay: `${data.animationDelay}s`,
                animationDuration: `${data.animationDuration}s`,
              }}
            />
          ))}
        </div>

        <main className="auth-container">
          <header className="header">
            <img src="/gamefinity%20icon.png" alt="Gamefinity" className="login-logo" />
            <span className="brand-id">Gamefinity · Event Operations</span>
            <h1>
              EVENT
              <br />
              ACCESS
            </h1>
            <p className="tagline">Guest lists, seating, and check-in for every event.</p>
          </header>

        <form autoComplete="off" onSubmit={handleSubmit} aria-busy={loading}>
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="off"
              placeholder="admin@gamefinity.id"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="input-glow"></div>
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="off"
              placeholder="••••••••"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="input-glow"></div>
          </div>

          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}

          <div className="submit-wrap">
            <div className="mercury-drop"></div>
            <button type="submit" className="btn-base" disabled={loading}>
              {loading ? 'Signing in' : 'Sign in'}
            </button>
          </div>

          <div className="load-track" aria-hidden="true">
            <div className="load-fill" data-loading={loading} />
          </div>
        </form>

        <footer className="footer-nav">
          {DEMO_ACCOUNTS.map((account) => (
            <button key={account.email} type="button" disabled={loading} onClick={() => fillDemo(account)}>
              {account.label}
            </button>
          ))}
        </footer>
        <p className="demo-hint">DEMO PASSWORDS · ADMIN123 / STAFF123</p>
        </main>
      </div>
    </div>
  )
}

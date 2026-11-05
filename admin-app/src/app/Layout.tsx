import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, LogOut, Menu, Moon, MousePointerClick, Search, Sun, Monitor } from 'lucide-react';
import { NAV } from './nav';
import { useAuth } from './auth';
import { Button } from '../components/ui';
import { useLocalStorage } from '../components/hooks';
import { CommandPalette } from './CommandPalette';
import { siteBase } from '../lib/site';
import { logo } from './Login';

export { NAV } from './nav';

type Theme = 'system' | 'light' | 'dark';
function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>('ana-admin-theme-pref', 'system');
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') { delete el.dataset.theme; try { localStorage.removeItem('ana-admin-theme'); } catch { /* */ } }
    else { el.dataset.theme = theme; try { localStorage.setItem('ana-admin-theme', theme); } catch { /* */ } }
  }, [theme]);
  return [theme, setTheme] as const;
}

export function Layout() {
  const { profile, signOut, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [theme, setTheme] = useTheme();
  const loc = useLocation();
  const nav = useNavigate();
  const current = NAV.find((n) => loc.pathname.startsWith(n.to));
  const isEditor = loc.pathname.startsWith('/editor');

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const name = profile?.display_name || session?.user.email || '';
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const nextTheme: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

  return (
    <div className="shell">
      <aside className={'sidebar' + (open ? ' open' : '')} aria-label="Navigation principale">
        <div className="brand"><img src={logo} alt="" /><div>Ana Finance<small>Administration</small></div></div>
        <button className="nav-item" onClick={() => setPalette(true)} style={{ border: '1px solid var(--border)', background: 'var(--panel)', cursor: 'pointer', font: 'inherit' }}>
          <Search /> Rechercher <span className="count kbd" style={{ marginLeft: 'auto' }}>⌘K</span>
        </button>
        <div className="nav-section">Pilotage</div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <n.icon />{n.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <a className="nav-item" href={siteBase} target="_blank" rel="noopener"><ExternalLink />Voir le site public</a>
          <button className="nav-item" style={{ border: 0, background: 'none', cursor: 'pointer', font: 'inherit', width: '100%' }} onClick={() => setTheme(nextTheme[theme])} aria-label="Changer de thème">
            <ThemeIcon />Thème : {theme === 'system' ? 'système' : theme === 'light' ? 'clair' : 'sombre'}
          </button>
          <div className="user-chip">
            <span className="avatar" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
            <span className="who"><b>{name}</b><span>{profile?.role === 'admin' ? 'Administrateur' : 'Éditeur'}</span></span>
            <Button variant="ghost" size="sm" iconOnly aria-label="Se déconnecter" title="Se déconnecter" onClick={signOut} icon={<LogOut />} style={{ marginLeft: 'auto' }} />
          </div>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <Button className="mobile-only" variant="ghost" iconOnly aria-label="Ouvrir le menu" onClick={() => setOpen(true)} icon={<Menu />} />
          <div className="crumbs">{current && <current.icon size={16} />}<b>{current?.label ?? 'Administration'}</b></div>
          <div className="spacer" />
          <Button variant="ghost" size="sm" className="mobile-only" iconOnly aria-label="Rechercher" onClick={() => setPalette(true)} icon={<Search />} />
          {!isEditor && <Button size="sm" variant="primary" icon={<MousePointerClick />} onClick={() => nav('/editor')} className="desktop-only">Modifier le site</Button>}
        </header>
        <Outlet />
      </div>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}

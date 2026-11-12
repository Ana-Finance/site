import { BarChart3, FileText, Image, Inbox, LayoutDashboard, MousePointerClick, Rocket, Settings, SearchCheck } from 'lucide-react';

export const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/demandes', label: 'Demandes', icon: Inbox },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/pages', label: 'Pages', icon: FileText },
  { to: '/editor', label: 'Éditeur visuel', icon: MousePointerClick },
  { to: '/media', label: 'Médias', icon: Image },
  { to: '/seo', label: 'SEO', icon: SearchCheck },
  { to: '/publications', label: 'Publications', icon: Rocket },
  { to: '/settings', label: 'Paramètres', icon: Settings },
];

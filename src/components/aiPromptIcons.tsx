import { Clock, Package, Footprints, DollarSign, Users, Zap, MessageCircle, Sparkles, Search, FileText, ShoppingCart, AlertTriangle } from 'lucide-react';

export const AI_PROMPT_ICONS: Record<string, React.ReactNode> = {
  clock: <Clock size={14} />,
  package: <Package size={14} />,
  footprints: <Footprints size={14} />,
  dollar: <DollarSign size={14} />,
  users: <Users size={14} />,
  zap: <Zap size={14} />,
  message: <MessageCircle size={14} />,
  sparkles: <Sparkles size={14} />,
  search: <Search size={14} />,
  report: <FileText size={14} />,
  cart: <ShoppingCart size={14} />,
  alert: <AlertTriangle size={14} />,
};

export const AI_PROMPT_ICON_KEYS = Object.keys(AI_PROMPT_ICONS);

export function getPromptIcon(key: string): React.ReactNode {
  return AI_PROMPT_ICONS[key] ?? AI_PROMPT_ICONS.sparkles;
}

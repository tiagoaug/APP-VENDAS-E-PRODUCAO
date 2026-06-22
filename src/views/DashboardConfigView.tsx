import { useState, useEffect } from 'react';
import { DashboardConfig, DashboardCardConfig, Collaborator } from '../types';
import { 
  Layout, Eye, EyeOff, Save, CheckCircle2, ChevronLeft, GripVertical, RefreshCcw,
  Sparkles, Package, Plus, Wallet, TrendingUp, TrendingDown, DollarSign, Grid3X3,
  Users, BarChart3, Landmark, Search, ShoppingCart, AlertCircle, Filter, Calendar,
  Boxes, Copy, Share2, Hash, User, History, Printer, Factory, Settings, ScanLine,
  QrCode, Trash2, ClipboardList, Footprints, Layers, PackageOpen, Clipboard, Clock,
  ChevronRight, ShoppingBag, BookOpen, CreditCard, Database
} from 'lucide-react';
import { motion, Reorder, AnimatePresence, useDragControls } from 'motion/react';
import { isDashboardCardAllowed } from '../utils/collaborators';

export type ViewMode = 'name' | 'joint' | 'full';

interface DashboardConfigViewProps {
  config: DashboardConfig;
  onSave: (config: DashboardConfig) => void;
  onBack: () => void;
  isDarkMode: boolean;
  modulesConfig: import("../types").AppModulesConfig;
  activeCollaborator?: Collaborator | null;
}

interface CardPreviewProps {
  id: string;
  isDarkMode: boolean;
  mini: boolean;
}

function CardPreview({ id, isDarkMode, mini }: CardPreviewProps) {
  const containerClass = `mt-3 p-4 rounded-[1.5rem] border flex flex-col gap-3 w-full text-[11px] select-none pointer-events-none transition-all duration-300 ${
    isDarkMode ? 'bg-slate-900 border-slate-800/80 text-slate-400' : 'bg-slate-50/50 border-slate-100 text-slate-500'
  } ${mini ? 'p-2.5 rounded-xl gap-1.5 text-[8.5px]' : ''}`;

  const headerClass = `flex items-center justify-between pb-2 border-b ${
    isDarkMode ? 'border-slate-800' : 'border-slate-200/60'
  }`;

  const buttonClass = `w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 bg-indigo-600/90 text-white ${
    mini ? 'py-1 rounded-lg text-[7.5px]' : ''
  }`;

  const titleClass = `inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 ${
    mini ? 'px-2 py-0.5 text-[8px]' : ''
  }`;

  const valueClass = `text-xl font-black tracking-tight leading-none ${
    isDarkMode ? 'text-white' : 'text-slate-900'
  } ${mini ? 'text-sm' : 'text-2xl'}`;

  const renderConfigItem = (icon: React.ReactNode, label: string, desc: string, color: string) => (
    <div className={`flex items-center justify-between px-3 py-2 border-b last:border-0 ${
      isDarkMode ? 'border-slate-800' : 'border-slate-100'
    } ${mini ? 'px-2 py-1' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className={`${color} shrink-0`}>{icon}</div>
        <div className="min-w-0">
          <p className={`font-black uppercase truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'} ${mini ? 'text-[8px]' : 'text-[9px]'}`}>{label}</p>
          {!mini && <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">{desc}</p>}
        </div>
      </div>
      <ChevronRight size={mini ? 10 : 12} className="text-slate-400" />
    </div>
  );

  switch (id) {
    case 'ai_assistant':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <div>
              <span className={titleClass}>Assistente IA</span>
              {!mini && <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Claude — Consultas e análises</p>}
            </div>
            <Sparkles size={mini ? 12 : 16} className="text-indigo-500" />
          </div>
          <p className="leading-relaxed">Pergunte sobre produtos, pedidos atrasados, financeiro e estoque de solados...</p>
          <div className={buttonClass}><Sparkles size={mini ? 10 : 12} /> Abrir Assistente IA</div>
        </div>
      );

    case 'balance':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={titleClass}>Saldo Consolidado</span>
            <Wallet size={mini ? 12 : 16} className="text-indigo-500" />
          </div>
          <p className={valueClass}>R$ 152.840,50</p>
        </div>
      );

    case 'sales_products':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>Produtos e Catálogo</span>
            <Package size={mini ? 12 : 16} className="text-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2 rounded-lg border text-center font-bold flex flex-col items-center justify-center gap-1 ${
              isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-indigo-50 border-transparent'
            }`}>
              <Package size={mini ? 14 : 18} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-[8px] font-black leading-tight text-indigo-700 dark:text-slate-300">Produtos</span>
            </div>
            <div className={`p-2 rounded-lg border text-center font-bold flex flex-col items-center justify-center gap-1 ${
              isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-emerald-50 border-transparent'
            }`}>
              <Plus size={mini ? 14 : 18} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-[8px] font-black leading-tight text-emerald-700 dark:text-slate-300">Cadastrar</span>
            </div>
          </div>
        </div>
      );

    case 'manual_entries':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>Lançamentos Manuais</span>
            <DollarSign size={mini ? 12 : 16} className="text-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 ${
              isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'
            }`}>
              <TrendingUp size={mini ? 14 : 18} className="text-emerald-500" />
              <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400">Entrada</span>
            </div>
            <div className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 ${
              isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50'
            }`}>
              <TrendingDown size={mini ? 14 : 18} className="text-rose-500" />
              <span className="text-[8px] font-black text-rose-600 dark:text-rose-400">Saída</span>
            </div>
          </div>
        </div>
      );

    case 'report_center':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>Central de Relatórios</span>
            <BarChart3 size={mini ? 12 : 16} className="text-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2 rounded-xl text-center border ${
              isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-slate-100 border-slate-200'
            } flex items-center justify-center gap-1.5`}>
              <TrendingUp size={mini ? 12 : 14} className="text-indigo-500" />
              <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400">Vendas</span>
            </div>
            <div className={`p-2 rounded-xl text-center border ${
              isDarkMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-slate-100 border-slate-200'
            } flex items-center justify-center gap-1.5`}>
              <DollarSign size={mini ? 12 : 14} className="text-amber-500" />
              <span className="text-[8px] font-black text-amber-600 dark:text-amber-400">Financeiro</span>
            </div>
          </div>
        </div>
      );

    case 'quick_reports':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>Relatórios Rápidos</span>
            <Grid3X3 size={mini ? 12 : 16} className="text-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className={`p-1.5 rounded-lg border text-left ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-100 border-slate-200'}`}>
              <p className="text-[7px] text-slate-400 font-bold mb-0.5">Vendas (Mês)</p>
              <p className="font-black text-slate-700 dark:text-slate-200">R$ 42.500</p>
            </div>
            <div className={`p-1.5 rounded-lg border text-left ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-100 border-slate-200'}`}>
              <p className="text-[7px] text-slate-400 font-bold mb-0.5">Lucro (Mês)</p>
              <p className="font-black text-emerald-500">R$ 15.200</p>
            </div>
          </div>
        </div>
      );

    case 'dashboard_rankings':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400`}>Rankings de Performance</span>
            <TrendingUp size={mini ? 12 : 16} className="text-amber-500" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[7.5px] font-bold text-slate-400 uppercase">
              <span>Top Clientes</span>
              <span>Total</span>
            </div>
            <div className="flex justify-between items-center text-[8px]">
              <span className="font-black text-slate-700 dark:text-slate-200 truncate max-w-[80px]">João da Silva</span>
              <span className="text-indigo-500 font-black">R$ 5.400</span>
            </div>
          </div>
        </div>
      );

    case 'cash_flow':
      return (
        <div className={containerClass}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Balanço Mensal</p>
              <p className="text-lg font-black text-emerald-500">R$ 12.450,20</p>
            </div>
            <div className={`p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500`}>
              <TrendingUp size={mini ? 14 : 20} />
            </div>
          </div>
        </div>
      );

    case 'receivables':
      return (
        <div className={containerClass}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">A Receber (Pendente)</p>
              <p className={valueClass}>R$ 45.200,00</p>
            </div>
            <div className={`p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500`}>
              <DollarSign size={mini ? 14 : 20} />
            </div>
          </div>
        </div>
      );

    case 'personal_balance':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400`}>Saldo Pessoal</span>
            <Landmark size={mini ? 12 : 16} className="text-emerald-500" />
          </div>
          <p className={`${valueClass} text-emerald-500`}>R$ 8.900,00</p>
        </div>
      );

    case 'stock_alerts':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400`}>Alertas de Estoque</span>
            <Boxes size={mini ? 12 : 16} className="text-rose-500" />
          </div>
          <div className="space-y-1">
            <div className={`p-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} flex justify-between`}>
              <span className="font-bold truncate max-w-[100px]">Sapato Casual Premium</span>
              <span className="text-rose-500 font-bold shrink-0">2 un.</span>
            </div>
          </div>
        </div>
      );

    case 'customers':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>Clientes</span>
            <Users size={mini ? 12 : 16} className="text-slate-400" />
          </div>
          <div className={`p-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} flex justify-between items-center`}>
            <div>
              <p className="font-bold truncate max-w-[80px]">Marcos Antunes</p>
              {!mini && <p className="text-[7px] text-slate-400">1 venda pendente</p>}
            </div>
            <span className="text-rose-500 font-black shrink-0">R$ 350,00</span>
          </div>
        </div>
      );

    case 'suppliers':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>Fornecedores</span>
            <ShoppingCart size={mini ? 12 : 16} className="text-slate-400" />
          </div>
          <div className={`p-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} flex justify-between items-center`}>
            <div>
              <p className="font-bold truncate max-w-[80px]">Couros Vale Ltda</p>
              {!mini && <p className="text-[7px] text-slate-400">Vence: 25/06</p>}
            </div>
            <span className="text-rose-500 font-black shrink-0">R$ 1.200,00</span>
          </div>
        </div>
      );

    case 'debt_management':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400`}>Controle de Dívidas</span>
            <AlertCircle size={mini ? 12 : 16} className="text-rose-500" />
          </div>
          <p className={valueClass}>R$ 38.400,00</p>
        </div>
      );

    case 'stock_value':
      return (
        <div className={containerClass}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Patrimônio Estoque</p>
              <p className="font-black text-slate-700 dark:text-white leading-tight">Custo: R$ 95.000</p>
              <p className="text-emerald-500 font-bold leading-tight">Venda: R$ 145.000</p>
            </div>
            <div className={`p-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-500`}>
              <Boxes size={mini ? 14 : 20} />
            </div>
          </div>
        </div>
      );

    case 'estimated_profit':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={titleClass}>Lucro Estimado</span>
            <TrendingUp size={mini ? 12 : 16} className="text-indigo-500" />
          </div>
          <p className={valueClass}>R$ 245.200,00</p>
        </div>
      );

    case 'checks':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400`}>Cheques</span>
            <CreditCard size={mini ? 12 : 16} className="text-amber-500" />
          </div>
          <div className={`p-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} flex justify-between`}>
            <div>
              <p className="font-bold">Cheque nº 10024</p>
            </div>
            <span className="font-black text-indigo-500 shrink-0">R$ 2.500</span>
          </div>
        </div>
      );

    case 'monthly_profit_detailed':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400`}>Análise Lucro Detalhada</span>
            <TrendingUp size={mini ? 12 : 16} className="text-emerald-500" />
          </div>
          <p className={valueClass}>R$ 25.400,00</p>
        </div>
      );

    case 'activity':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={titleClass}>Atividade</span>
            <History size={mini ? 12 : 16} className="text-slate-400" />
          </div>
          <div className="flex justify-between items-center text-[7.5px] font-bold">
            <span className="text-emerald-500">+ Venda R$ 450,00</span>
            <span className="text-slate-400 font-normal">10 min</span>
          </div>
        </div>
      );

    case 'print_center':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={titleClass}>Central de Impressões</span>
            <Printer size={mini ? 12 : 16} className="text-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="bg-rose-50 border border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/20 p-1 rounded-lg text-center text-[7px] font-black text-rose-500">OS</div>
            <div className="bg-violet-50 border border-violet-100 dark:bg-violet-900/10 dark:border-violet-900/20 p-1 rounded-lg text-center text-[7px] font-black text-violet-500">Mapa Prod</div>
          </div>
        </div>
      );

    case 'pcp_sector_map':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400`}>Mapas PCP</span>
            <Factory size={mini ? 12 : 16} className="text-violet-500" />
          </div>
          <div className={`p-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} flex justify-between items-center`}>
            <span className="font-bold truncate max-w-[80px]">Costura</span>
            <span className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200 px-1 py-0.5 rounded text-[7px] font-bold shrink-0">3 mapas</span>
          </div>
        </div>
      );

    case 'pcp_purchase_needs':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={titleClass}>Necessidades de Compras</span>
            <ShoppingCart size={mini ? 12 : 16} className="text-amber-500" />
          </div>
          <div className="grid grid-cols-2 gap-1 text-[8px] font-bold">
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded text-center">Prod: 5</div>
            <div className="bg-rose-50 dark:bg-rose-950/20 p-1 rounded text-center text-rose-600">Solic: 2</div>
          </div>
        </div>
      );

    case 'engineering_config':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={titleClass}>Config Ficha Técnica</span>
            <Database size={mini ? 12 : 16} className="text-indigo-500" />
          </div>
          <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-100 shadow-sm'}`}>
            {renderConfigItem(<Package size={10} />, 'Produtos Cadastrados', 'Catálogo completo', 'text-indigo-600')}
          </div>
        </div>
      );

    case 'production_stock_control':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400`}>Controle de Estoques</span>
            <Boxes size={mini ? 12 : 16} className="text-emerald-500" />
          </div>
          <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-100 shadow-sm'}`}>
            {renderConfigItem(<PackageOpen size={10} />, 'Estoques Gerais', 'Matéria-prima e insumos', 'text-emerald-600')}
          </div>
        </div>
      );

    case 'factory_config':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={`${titleClass} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>Config de Fábrica</span>
            <Settings size={mini ? 12 : 16} className="text-slate-400" />
          </div>
          <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-100 shadow-sm'}`}>
            {renderConfigItem(<Factory size={10} />, 'Setores de Produção', 'Fluxo da fábrica', 'text-indigo-600')}
          </div>
        </div>
      );

    case 'qr_scanner':
      return (
        <div className={containerClass}>
          <div className={headerClass}>
            <span className={titleClass}>Scanner Rápido</span>
            <ScanLine size={mini ? 12 : 16} className="text-indigo-500" />
          </div>
          <div className={buttonClass}><QrCode size={mini ? 10 : 12} /> Escanear Código</div>
        </div>
      );

    default:
      return null;
  }
}

interface CardItemProps {
  card: DashboardCardConfig;
  isDarkMode: boolean;
  onToggleVisibility: (id: string) => void;
  viewMode: ViewMode;
  key?: string | number;
}

function CardItem({ card, isDarkMode, onToggleVisibility, viewMode }: CardItemProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item 
      value={card}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`p-4 rounded-[1.8rem] border flex flex-col transition-all duration-300 ${
        !card.visible 
          ? (isDarkMode ? 'bg-slate-900/40 border-slate-800/50 opacity-60' : 'bg-slate-50/50 border-slate-100 opacity-60')
          : (isDarkMode ? 'bg-slate-900 border-slate-800 shadow-xl shadow-black/10' : 'bg-white border-slate-200 shadow-sm')
      }`}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4 flex-1">
          <div 
            onPointerDown={(e) => {
              e.preventDefault();
              controls.start(e);
            }}
            className={`p-3 rounded-xl cursor-grab active:cursor-grabbing transition-colors select-none touch-none ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} text-slate-400`}
          >
            <GripVertical size={20} />
          </div>
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${card.visible ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <p className={`text-[11px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{card.label}</p>
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-4">
              ID: {card.id}
            </p>
          </div>
        </div>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(card.id);
          }}
          className={`p-3 rounded-xl transition-all ${
            card.visible 
              ? (isDarkMode ? 'text-indigo-400 bg-indigo-500/10' : 'text-indigo-600 bg-indigo-50') 
              : (isDarkMode ? 'text-slate-600 bg-slate-800' : 'text-slate-300 bg-slate-100')
          }`}
          title={card.visible ? "Ocultar" : "Mostrar"}
        >
          {card.visible ? <Eye size={18} strokeWidth={2.5} /> : <EyeOff size={18} strokeWidth={2.5} />}
        </button>
      </div>

      {card.visible && viewMode !== 'name' && (
        <div className={`w-full transition-all duration-300 ${viewMode === 'joint' ? 'pl-14 pr-2' : 'pl-0 pr-0'}`}>
          <CardPreview id={card.id} isDarkMode={isDarkMode} mini={viewMode === 'joint'} />
        </div>
      )}
    </Reorder.Item>
  );
}

export default function DashboardConfigView({ config, onSave, onBack, isDarkMode, modulesConfig, activeCollaborator = null }: DashboardConfigViewProps) {
  const passesFilter = (card: DashboardCardConfig) => {
    if (!isDashboardCardAllowed(activeCollaborator, card.id)) return false;
    if (!card.module || card.module === 'any') return true;
    if (!modulesConfig) return true; // Fallback if modulesConfig is missing
    return (modulesConfig as any)[card.module];
  };

  const [localCards, setLocalCards] = useState<DashboardCardConfig[]>(() =>
    [...(config?.cards || [])]
      .filter(passesFilter)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showReloadPrompt, setShowReloadPrompt] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('dashboard_config_view_mode') as ViewMode) || 'name';
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('dashboard_config_view_mode', mode);
  };

  useEffect(() => {
    // Helper function to get standardized content string for comparison
    const getContentString = (cards: DashboardCardConfig[]) => {
      return cards
        .filter(passesFilter)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(c => `${c.id}:${c.visible}:${c.order}`)
        .join('|');
    };

    const localContent = getContentString(localCards);
    const incomingContent = getContentString(config?.cards || []);

    if (!isSaving && isSaved && localContent !== incomingContent) {
      setLocalCards([...(config?.cards || [])]
        .filter(passesFilter)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      );
    }
  }, [config, isSaving, isSaved, modulesConfig, activeCollaborator]); // Removed localCards from deps to prevent loop, we use localContent internally

  const handleToggleVisibility = (id: string) => {
    setLocalCards(prev => prev.map(card => 
      card.id === id ? { ...card, visible: !card.visible } : card
    ));
    setIsSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Update order based on current list position
    const updatedCards = localCards.map((card, index) => ({ ...card, order: index }));
    await onSave({ cards: updatedCards });
    setIsSaved(true);
    setIsSaving(false);
    setShowReloadPrompt(true);
    // Remove the timeout that resets isSaved to false, so the "Salvo!" state persists until next change
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fafafa] dark:bg-slate-950">
      {/* Fixed Header */}
      <div className={`px-4 pt-12 pb-4 border-b shrink-0 flex items-center justify-between ${isDarkMode ? 'bg-slate-950 border-slate-800/60' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
            title="Voltar"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Layout</h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">
              {activeCollaborator && !activeCollaborator.isUnrestricted ? `Painel Pessoal — ${activeCollaborator.name}` : 'Painel Principal'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleSave}
          className={`${isSaved ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-indigo-600 shadow-indigo-500/20'} text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 active:scale-95`}
        >
          {isSaved ? (
            <><CheckCircle2 size={14} strokeWidth={3} /> Salvo!</>
          ) : (
            <><Save size={14} strokeWidth={3} /> Salvar</>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden force-scrollbar px-4 pt-6 pb-32 flex flex-col gap-6">

        <div className="mt-2">
          <div className={`p-5 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-indigo-50/30 border-indigo-100/50'} mb-6`}>
             <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
              Arraste os itens pelo ícone lateral para mudar a ordem. O corpo do cartão agora permite a rolagem da tela.
            </p>
          </div>

          {/* Segmented Control for Visual Mode */}
          <div className={`p-1 rounded-[1.5rem] border flex gap-1 mb-6 max-w-md mx-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/60'
          }`}>
            {(['name', 'joint', 'full'] as const).map((mode) => {
              const label = mode === 'name' ? 'Somente Nome' : mode === 'joint' ? 'Conjunta' : 'Card Completo';
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleViewModeChange(mode)}
                  className={`flex-1 py-2.5 px-2 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${
                    active
                      ? (isDarkMode ? 'bg-slate-800 text-indigo-400 shadow-lg shadow-black/30 border border-slate-700/50' : 'bg-white text-indigo-600 shadow-md border border-slate-200/20')
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <Reorder.Group 
            axis="y" 
            values={localCards} 
            onReorder={(newOrder) => {
              setLocalCards(newOrder);
              setIsSaved(false);
            }} 
            className="flex flex-col gap-3"
          >
            {localCards.map((card) => (
              <CardItem 
                key={card.id} 
                card={card} 
                isDarkMode={isDarkMode} 
                onToggleVisibility={handleToggleVisibility} 
                viewMode={viewMode}
              />
            ))}
          </Reorder.Group>
        </div>


      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 p-6 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-4"
      >
        <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center ${isDarkMode ? 'bg-slate-900 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}>
          <Layout size={28} strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Configuração de Interface</p>
          <p className="text-[11px] text-slate-400 font-bold mt-2 leading-relaxed italic max-w-[240px]">
            Personalize sua experiência visual deixando apenas o essencial à vista.
          </p>
        </div>
      </motion.div>

      </div>

      <AnimatePresence>
        {showReloadPrompt && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-4 right-4 z-50"
          >
            <div className={`p-5 rounded-[2rem] shadow-2xl border flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-indigo-500/30' : 'bg-white border-indigo-100'}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <RefreshCcw size={24} strokeWidth={2.5} className="animate-spin-slow" />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Atualização Necessária</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-tight mt-0.5">Recarregue para aplicar todas as mudanças perfeitamente.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowReloadPrompt(false)}
                  className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
                >
                  Mais Tarde
                </button>
                <button 
                  onClick={handleReload}
                  className="flex-[2] py-3.5 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={14} strokeWidth={3} />
                  Recarregar Agora
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


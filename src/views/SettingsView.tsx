import { useState, useEffect, useRef } from 'react';
import {
  Users,
  Tags,
  Palette,
  CreditCard,
  Wallet,
  BarChart3,
  Boxes,
  Moon,
  Sun,
  ChevronRight,
  ChevronDown,
  Layout,
  Grid3X3,
  Database,
  Footprints,
  Shield,
  Landmark,
  Package,
  LogOut,
  Type,
  BookOpen,
  X,
  Check,
  UserCog,
  KeyRound,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  SlidersHorizontal,
  Printer,
  Plus,
  Sparkles,
  Truck,
  Rocket,
  Building2,
  ScanText,
  Calculator,
  MoveHorizontal,
  Scissors,
  Bookmark,
  Layers,
  Clock,
  TableCellsMerge,
  CalendarClock,
  GanttChartSquare,
  Box,
  PackageOpen,
  ShieldCheck,
  Info,
  Fingerprint,
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  DollarSign,
  ScanLine
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { isLoginUnlockEnabled, clearLoginUnlockCredentials, isNativeBiometricAvailable, getBiometryLabel, saveLoginUnlockCredentials } from '../utils/biometricAuth';
import { toast } from '../utils/toast';
import { ViewType, ProductionScreenType, AppModulesConfig, Collaborator, BottomNavConfig } from '../types';
import { ThemeId, THEME_VISUALS, FONT_OPTIONS, FONT_SCALE_OPTIONS, NavIconMode, NAV_MONO_PALETTE, NAV_TAB_COLORS } from '../utils/themes';
import { isViewAllowed, isSectorAllowed, isViewTaskAllowed } from '../utils/collaborators';
import { SALES_TRIAL_DAYS, PRODUCTION_TRIAL_DAYS, PERSONAL_TRIAL_DAYS } from '../constants';
import AIAssistantSettings from '../components/AIAssistantSettings';
import GuidePulseDot from '../components/GuidePulseDot';
import BottomNavConfigModal from '../components/BottomNavConfigModal';
import CustomPinKeypad from '../components/CustomPinKeypad';
import { PIN_LENGTH } from '../utils/pinKeypad';
import { subscribeToProductionScheduleConfig, saveProductionScheduleConfig } from '../services/productionScheduleService';
import { isTemplateAdmin } from '../utils/templateAdmin';

// Atalhos diretos pra cada sub-tela de "Configuração de Fábrica" (ProductionConfigView) —
// pulam o menu intermediário e abrem a sub-tela na hora (mesmo mecanismo já usado por
// SOLE_MATRIX_DIRECT), pra deixar tudo isso dentro do Menu Mais numa tela só.
const PRODUCTION_CONFIG_SCREENS: Record<string, ProductionScreenType> = {
  PROD_SECTORS: 'SECTORS',
  PROD_FLOW_TAGS: 'FLOW_TAGS',
  PROD_PRAZOS: 'PRAZOS',
  PROD_INSUMOS: 'INSUMOS',
  PROD_UNIDADES: 'UNIDADES',
  PROD_FACAS: 'FACAS',
  PROD_INFESTO: 'INFESTO',
  PROD_PECAS: 'PECAS',
  PROD_EMBALAGENS: 'EMBALAGENS',
};

interface SettingsViewProps {
  onNavigate: (view: ViewType, params?: Record<string, any>) => void;
  onNavigateProduction: (screen: ProductionScreenType) => void;
  isDarkMode: boolean;
  appTheme: ThemeId;
  setAppTheme: (theme: ThemeId) => void;
  toggleDarkMode: () => void;
  modulesConfig: AppModulesConfig;
  fontScale: number;
  setFontScale: (scale: number) => void;
  fontFamily: string;
  setFontFamily: (family: string) => void;
  navIconMode: NavIconMode;
  setNavIconMode: (mode: NavIconMode) => void;
  navMonoColor: string;
  setNavMonoColor: (color: string) => void;
  collaborators: Collaborator[];
  activeCollaborator: Collaborator | null;
  onSwitchCollaborator: (id: string, pin: string) => boolean;
  onLogout: () => void;
  showEngineeringThumbnails?: boolean;
  setShowEngineeringThumbnails?: (v: boolean) => void;
  hideFinancialValues?: boolean;
  setHideFinancialValues?: (v: boolean) => void;
  // Empurra o cabeçalho um pouco mais pra baixo em pixels — pra aparelhos (iPhone com notch/
  // Dynamic Island, ou Android com câmera/status bar) onde o espaço padrão não é suficiente
  // (ver App.tsx <header> style). Era um toggle liga/desliga (+40px fixo), virou um valor livre
  // ajustado por um cursor, pra acertar a altura exata em qualquer aparelho.
  headerTopSpacePx?: number;
  setHeaderTopSpacePx?: (v: number) => void;
  // Controle da Barra de Atalhos do cabeçalho (Privacidade/Ajuda/Modo Diurno) — visibilidade e
  // animação ociosa (o "balancinho") individual por atalho, ver App.tsx headerShortcutVisibility/
  // headerShortcutAnimated.
  headerShortcutVisibility?: { privacidade: boolean; ajuda: boolean; tema: boolean; scanner: boolean; ia: boolean };
  onToggleHeaderShortcutVisibility?: (key: 'privacidade' | 'ajuda' | 'tema' | 'scanner' | 'ia') => void;
  headerShortcutAnimated?: { privacidade: boolean; ajuda: boolean; tema: boolean; scanner: boolean; ia: boolean };
  onToggleHeaderShortcutAnimated?: (key: 'privacidade' | 'ajuda' | 'tema' | 'scanner' | 'ia') => void;
  // Assistente de Personalização Visual — separado do Assistente de Configuração Inicial (ver
  // VISUAL_SETUP_STEPS em App.tsx). `visualGuideTarget` diz qual seção de Acessibilidade
  // abrir/pulsar automaticamente enquanto ele está ativo; undefined/null = não está ativo.
  visualGuideTarget?: 'topo' | 'tema' | 'fonte' | 'tamanho' | 'icones' | 'navegacao' | null;
  onOpenVisualSetup: () => void;
  onOpenOnboardingWizard: () => void;
  onOpenProductCreationChoice: () => void;
  // Abre a Impressão de Etiquetas (Ablemark) — antes era um ícone fixo no topo do app; agora
  // vive só aqui e no card do Painel Inicial (ver App.tsx handleOpenLabelPrintStudio).
  onOpenLabelPrintStudio: () => void;
  // Personalização da barra de navegação inferior (ver App.tsx middleNavItems/BottomNavConfigModal).
  bottomNavConfig: BottomNavConfig;
  onSaveBottomNavConfig: (config: BottomNavConfig) => void;
}

export default function SettingsView({
  onNavigate,
  onNavigateProduction,
  isDarkMode,
  appTheme,
  setAppTheme,
  toggleDarkMode,
  modulesConfig,
  fontScale,
  setFontScale,
  fontFamily,
  setFontFamily,
  navIconMode,
  setNavIconMode,
  navMonoColor,
  setNavMonoColor,
  collaborators,
  activeCollaborator,
  onSwitchCollaborator,
  onLogout,
  showEngineeringThumbnails = true,
  setShowEngineeringThumbnails,
  hideFinancialValues = false,
  setHideFinancialValues,
  headerTopSpacePx = 0,
  setHeaderTopSpacePx,
  headerShortcutVisibility = { privacidade: true, ajuda: true, tema: true, scanner: true, ia: true },
  onToggleHeaderShortcutVisibility,
  headerShortcutAnimated = { privacidade: false, ajuda: false, tema: true, scanner: true, ia: true },
  onToggleHeaderShortcutAnimated,
  visualGuideTarget,
  onOpenVisualSetup,
  onOpenOnboardingWizard,
  onOpenProductCreationChoice,
  onOpenLabelPrintStudio,
  bottomNavConfig,
  onSaveBottomNavConfig,
}: SettingsViewProps) {
  // "Tema", "Fonte", "Tamanho da Fonte" e "Ícones do Menu" começam minimizados — são escolhas
  // feitas uma vez e raramente revisitadas, então não precisam ocupar espaço aberto toda vez
  // que alguém entra em Acessibilidade e Personalização.
  const [themeSectionOpen, setThemeSectionOpen] = useState(false);
  const [fontSectionOpen, setFontSectionOpen] = useState(false);
  const [fontScaleSectionOpen, setFontScaleSectionOpen] = useState(false);
  const [navIconsSectionOpen, setNavIconsSectionOpen] = useState(false);
  const [shortcutBarSectionOpen, setShortcutBarSectionOpen] = useState(false);
  // Só Dias Úteis na Média — antes vivia só em Configuração de Fábrica, trazido pra cá pra
  // centralizar toda a configuração de Produção no Menu Mais (mesma coleção/serviço, só que
  // lido/gravado direto daqui em vez de por ProductionConfigView).
  const [excludeWeekends, setExcludeWeekends] = useState(true);
  // 'FULL_PERIOD' = dias úteis do período inteiro (comportamento de sempre); 'ELAPSED' = só os
  // dias úteis já passados até agora — as duas opções são mutuamente exclusivas (ver botões
  // abaixo, escolher uma desmarca a outra automaticamente).
  const [averageMode, setAverageMode] = useState<'FULL_PERIOD' | 'ELAPSED'>('ELAPSED');
  useEffect(() => {
    const unsub = subscribeToProductionScheduleConfig(cfg => { setExcludeWeekends(cfg.excludeWeekends); setAverageMode(cfg.averageMode); });
    return () => unsub();
  }, []);
  const handleToggleExcludeWeekends = () => {
    const next = !excludeWeekends;
    setExcludeWeekends(next);
    saveProductionScheduleConfig({ excludeWeekends: next, averageMode });
  };
  const handleSetAverageMode = (mode: 'FULL_PERIOD' | 'ELAPSED') => {
    setAverageMode(mode);
    saveProductionScheduleConfig({ excludeWeekends, averageMode: mode });
  };
  // Editor de "Espaço no Topo" — abre um popup com um cursor vertical pra ajustar o valor em
  // pixels ao vivo (vendo uma prévia do próprio cabeçalho se movendo), só grava de verdade no
  // app quando "Salvar" é tocado — `draftHeaderTopSpacePx` guarda o valor sendo arrastado,
  // sem tocar no valor real (`headerTopSpacePx`) até confirmar.
  const [headerSpaceEditorOpen, setHeaderSpaceEditorOpen] = useState(false);
  const [draftHeaderTopSpacePx, setDraftHeaderTopSpacePx] = useState(headerTopSpacePx);
  const HEADER_SPACE_MAX = 80;
  // Negativo permite LEVANTAR o cabeçalho um pouco (não só abaixar) — pedido pelo Tiago pra
  // corrigir o caso oposto, um aparelho onde o espaço padrão já é grande demais.
  const HEADER_SPACE_MIN = -40;
  const HEADER_SPACE_RANGE = HEADER_SPACE_MAX - HEADER_SPACE_MIN;
  const headerSpaceTrackRef = useRef<HTMLDivElement>(null);
  const headerSpaceDraggingRef = useRef(false);

  // Arrasto vertical do cursor — a trilha vai de cima (HEADER_SPACE_MIN) a baixo
  // (HEADER_SPACE_MAX), então a posição do toque é invertida em relação ao valor (mais pra
  // baixo na trilha = mais espaço).
  const updateHeaderSpaceFromPointer = (clientY: number) => {
    const track = headerSpaceTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    setDraftHeaderTopSpacePx(Math.round(HEADER_SPACE_MIN + ratio * HEADER_SPACE_RANGE));
  };
  const handleHeaderSpacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    headerSpaceDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateHeaderSpaceFromPointer(e.clientY);
  };
  const handleHeaderSpacePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!headerSpaceDraggingRef.current) return;
    updateHeaderSpaceFromPointer(e.clientY);
  };
  const handleHeaderSpacePointerUp = () => {
    headerSpaceDraggingRef.current = false;
  };
  const [showNavConfig, setShowNavConfig] = useState(false);
  const [showA11y, setShowA11y] = useState(false);
  // Etapas de Configurações Visuais do Assistente — abre o popup de Acessibilidade sozinho e já
  // expande a seção certa, em vez de depender da pessoa achar "Mais Opções → Acessibilidade"
  // sozinha no meio do tour guiado.
  useEffect(() => {
    if (!visualGuideTarget) return;
    // "Personalizar Navegação" é um modal PRÓPRIO (BottomNavConfigModal), fora do popup de
    // Acessibilidade — os outros 5 alvos abrem showA11y, este abre showNavConfig no lugar.
    if (visualGuideTarget === 'navegacao') {
      setShowA11y(false);
      setShowNavConfig(true);
      return;
    }
    setShowA11y(true);
    if (visualGuideTarget === 'tema') setThemeSectionOpen(true);
    if (visualGuideTarget === 'fonte') setFontSectionOpen(true);
    if (visualGuideTarget === 'tamanho') setFontScaleSectionOpen(true);
    if (visualGuideTarget === 'icones') setNavIconsSectionOpen(true);
  }, [visualGuideTarget]);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [faceIdUnlockEnabled, setFaceIdUnlockEnabled] = useState(false);
  const [showDisableFaceIdConfirm, setShowDisableFaceIdConfirm] = useState(false);
  // Rótulo da biometria do aparelho (ex.: "Face ID") — null quando indisponível/sem cadastro
  // no sistema, ou quando a conta não é de e-mail/senha (Google/Apple não têm senha pra
  // guardar, ver comentário em biometricAuth.ts). Controla se o botão "Ativar" aparece aqui —
  // antes disso, a ÚNICA forma de ativar era marcar uma caixinha no instante do login (LoginView),
  // fácil de perder e sem outro jeito de voltar atrás depois.
  const [enableFaceIdLabel, setEnableFaceIdLabel] = useState<string | null>(null);
  const [showEnableFaceId, setShowEnableFaceId] = useState(false);
  const [enableFaceIdPassword, setEnableFaceIdPassword] = useState('');
  const [showEnableFaceIdPassword, setShowEnableFaceIdPassword] = useState(false);
  const [enableFaceIdError, setEnableFaceIdError] = useState<string | null>(null);
  const [enableFaceIdBusy, setEnableFaceIdBusy] = useState(false);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    isLoginUnlockEnabled().then(setFaceIdUnlockEnabled);
    const isPasswordAccount = !!auth.currentUser?.providerData.some(p => p.providerId === 'password');
    if (isPasswordAccount) {
      Promise.all([isNativeBiometricAvailable(), getBiometryLabel()]).then(([available, label]) => {
        if (available && label) setEnableFaceIdLabel(label);
      });
    }
  }, []);

  const handleConfirmEnableFaceId = async () => {
    if (!auth.currentUser?.email || !enableFaceIdPassword) return;
    setEnableFaceIdBusy(true);
    setEnableFaceIdError(null);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, enableFaceIdPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await saveLoginUnlockCredentials(auth.currentUser.email, enableFaceIdPassword);
      setFaceIdUnlockEnabled(true);
      setShowEnableFaceId(false);
      setEnableFaceIdPassword('');
      toast.show(`Desbloqueio rápido com ${enableFaceIdLabel} ativado!`);
    } catch (err: any) {
      setEnableFaceIdError(err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential' ? 'Senha incorreta.' : 'Não foi possível confirmar. Tente de novo.');
    } finally {
      setEnableFaceIdBusy(false);
    }
  };
  const [showCollabSwitcher, setShowCollabSwitcher] = useState(false);
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPin, setShowPin] = useState(false);
  // Teclado personalizado do PIN (ver CustomPinKeypad.tsx) — só abre ao tocar no campo, em vez
  // de abrir sozinho junto com o colaborador escolhido (aqui é um popup compacto, diferente da
  // tela cheia "Quem é Você?", onde abrir direto economiza um toque).
  const [pinKeypadOpen, setPinKeypadOpen] = useState(false);
  const [expandedCollabPhoto, setExpandedCollabPhoto] = useState<{ url: string; name: string } | null>(null);

  // Bling e RH exigem o Módulo de Vendas ligado (ver ModuleConfigView.tsx — não dá mais pra
  // ativar nenhum dos dois sem Vendas) — checado de novo aqui pra contas antigas que já tinham
  // Bling/RH ligados de um jeito inconsistente antes dessa regra existir.
  const isModuleActive = (module: keyof AppModulesConfig | 'any') => {
    if (module === 'any') return true;
    // Assistente de IA ainda não é oferecido pra contas normais (ver App.tsx/ModuleConfigView.tsx)
    // — só a conta de desenvolvimento vê essa opção, independente do que estiver salvo em
    // modulesConfig.ai (contas antigas podem ter isso true de antes dessa restrição existir).
    if (module === 'ai') return isTemplateAdmin();
    // Bling agora também é exclusivo da conta de desenvolvimento (ver App.tsx, que já força
    // modulesConfig.bling=false pra qualquer conta que não seja isTemplateAdmin()) — dupla
    // checagem direto na UI, mesmo padrão da IA acima.
    if (module === 'bling') return isTemplateAdmin() && modulesConfig.sales && !!modulesConfig.bling;
    if (module === 'rh' && !modulesConfig.sales) return false;
    return !!modulesConfig[module];
  };

  const [showModulesInfo, setShowModulesInfo] = useState(false);

  // Feedback visual no ícone do card "Módulos do Sistema" (ver renderização mais abaixo) — avisa
  // sem precisar abrir a tela quando algum teste grátis (Vendas/Produção/Pessoal, ver
  // ModuleConfigView.tsx) está nas últimas 24h ou já venceu e pede assinatura.
  const hasUrgentModuleTrial = (() => {
    const now = Date.now();
    const checks: [number | null | undefined, boolean | undefined, number][] = [
      [modulesConfig.salesTrialStartedAt, modulesConfig.salesPurchased, SALES_TRIAL_DAYS],
      [modulesConfig.productionTrialStartedAt, modulesConfig.productionPurchased, PRODUCTION_TRIAL_DAYS],
      [modulesConfig.personalTrialStartedAt, modulesConfig.personalPurchased, PERSONAL_TRIAL_DAYS],
    ];
    return checks.some(([startedAt, purchased, days]) => {
      if (!startedAt || purchased) return false;
      const endsAt = startedAt + days * 24 * 60 * 60 * 1000;
      return endsAt - now < 24 * 60 * 60 * 1000; // menos de 24h (inclui já vencido)
    });
  })();

  const isItemAllowed = (itemId: ViewType | string) => {
    if (itemId === 'SOLE_MATRIX_DIRECT') return isSectorAllowed(activeCollaborator, 'cadastro_insumos');
    if (itemId in PRODUCTION_CONFIG_SCREENS) return isSectorAllowed(activeCollaborator, 'producao_pcp');
    return isViewAllowed(activeCollaborator, itemId as ViewType) && isViewTaskAllowed(activeCollaborator, itemId as ViewType);
  };

  const closeCollabSwitcher = () => {
    setShowCollabSwitcher(false);
    setSwitchTargetId(null);
    setPinInput('');
    setPinError(false);
    setShowPin(false);
    setPinKeypadOpen(false);
  };

  const confirmSwitch = () => {
    if (!switchTargetId) return;
    const ok = onSwitchCollaborator(switchTargetId, pinInput);
    if (ok) {
      closeCollabSwitcher();
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const menuGroups = [
    {
      title: "Cadastros",
      items: [
        // Duas entradas em vez de uma só — mesmo padrão de "Parâmetros de Modelagem" em
        // Configurações de Produção. Vão pro catálogo neutro (ProductsView) e direto pro
        // formulário de cadastro, não pra Ficha Técnica de Produção (PRODUCTION_ENGINEERING),
        // que é toda identificada como tela de Produção (título "Produção de Produtos",
        // botões "Editar/Duplicar Engenharia") — errado pra quem só tem o módulo Vendas.
        { id: ViewType.PRODUCTS, label: "Produtos Cadastrados", icon: <Package size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'sales' },
        { id: ViewType.PRODUCT_FORM, label: "Cadastrar Novo Modelo", icon: <Plus size={22} />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", module: 'sales' },
        { id: ViewType.STOCK, label: "Expedição e Estoque", icon: <Boxes size={22} />, color: "text-amber-700 dark:text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", module: 'sales' },
        { id: ViewType.COLORS, label: "Paleta de Cores", icon: <Palette size={22} />, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-900/30", module: 'sales' },
        { id: ViewType.CATEGORIES, label: "Categorias e Grupos", icon: <Tags size={22} />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", module: 'any' },
        { id: ViewType.BRANDS, label: "Marcas", icon: <Bookmark size={22} />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30", module: 'sales' },
        { id: ViewType.MODELS, label: "Nome de Modelos", icon: <Layers size={22} />, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-900/30", module: 'sales' },
        { id: ViewType.PEOPLE, label: "Clientes e Fornecedores", icon: <Users size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'sales' },
      ].filter(item => isModuleActive(item.module as keyof AppModulesConfig | 'any') && isItemAllowed(item.id))
    },
    {
      // Ferramentas por módulo (integrações e extras opcionais) — separadas dos Cadastros
      // porque não são "dado" a preencher, são funções/integrações que ou estão ligadas
      // (Entregas, Bling) ou são um assistente à parte (IA), cada uma com sua própria tela.
      title: "Ferramentas de Módulos",
      items: [
        { id: ViewType.DELIVERY_MENU, label: "Módulo Entregas", icon: <Truck size={22} />, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-900/20", module: 'entregas' },
        { id: ViewType.BLING_CONNECTION, label: "Conexão Bling", icon: <Building2 size={22} />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", module: 'bling' },
        { id: 'AI_SETTINGS', label: "Assistente de IA", icon: <Sparkles size={22} />, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20", module: 'ai' },
      ].filter(item => isModuleActive(item.module as keyof AppModulesConfig | 'any') && isItemAllowed(item.id))
    },
    {
      title: "Módulo de Produção",
      items: [
        { id: 'PROD_SECTORS', label: "Setores de Produção", icon: <TableCellsMerge size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'production' },
        { id: 'PROD_FLOW_TAGS', label: "Etapas e Processos", icon: <Tags size={22} />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", module: 'production' },
        { id: 'PROD_PRAZOS', label: "Prazos de Entrega", icon: <CalendarClock size={22} />, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-900/20", module: 'production' },
        { id: ViewType.GRIDS, label: "Grades de Tamanho", icon: <Grid3X3 size={22} />, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/30", module: 'production' },
        { id: 'SOLE_MATRIX_DIRECT', label: "Cadastro de Solados", icon: <Footprints size={22} />, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", module: 'production' },
        { id: 'PROD_INSUMOS', label: "Materiais e Insumos", icon: <Layers size={22} />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30", module: 'production' },
        { id: 'PROD_UNIDADES', label: "Unidades de Medida", icon: <GanttChartSquare size={22} />, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800", module: 'production' },
        { id: 'PROD_FACAS', label: "Facas de Corte", icon: <Scissors size={22} />, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20", module: 'production' },
        { id: 'PROD_INFESTO', label: "Camadas de Dobra Para Corte", icon: <Box size={22} />, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-900/20", module: 'production' },
        { id: 'PROD_PECAS', label: "Nome do Componente e Peça", icon: <Layers size={22} />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", module: 'production' },
        { id: 'PROD_EMBALAGENS', label: "Padrão Embalagens", icon: <PackageOpen size={22} />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", module: 'production' },
      ].filter(item => isModuleActive(item.module as keyof AppModulesConfig | 'any') && isItemAllowed(item.id))
    },
    {
      title: "Financeiro & Contas",
      items: [
        { id: ViewType.FINANCIAL, label: "Fluxo de Caixa Vendas", icon: <BarChart3 size={22} />, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", module: 'sales' },
        { id: ViewType.PERSONAL_FINANCIAL, label: "Financeiro Pessoal", icon: <Wallet size={22} />, color: "text-pink-500 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-900/30", module: 'personal' },
        { id: ViewType.ACCOUNTS, label: "Contas de Movimentação", icon: <Landmark size={22} />, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30", module: 'any' },
        { id: ViewType.PAYMENT_METHODS, label: "Meios de Recebimento", icon: <CreditCard size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'sales' },
      ].filter(item => isModuleActive(item.module as keyof AppModulesConfig | 'any') && isItemAllowed(item.id))
    },
    {
      title: "Sistema & Backup",
      items: [
        { id: ViewType.RH_MENU, label: "RH (Recursos Humanos)", icon: <UserCog size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'rh' },
        { id: ViewType.COMPANY_PROFILE, label: "Personalizar Empresa", icon: <Building2 size={22} />, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-900/20", module: 'sales' },
        { id: 'ONBOARDING_WIZARD', label: "Assistente de Configuração", icon: <Rocket size={22} />, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20", module: 'any' },
        { id: ViewType.BACKUP, label: "Ajustes Técnicos", icon: <Database size={22} />, color: "text-gray-600 dark:text-gray-400", bg: "bg-slate-100 dark:bg-slate-800", module: 'any' },
        { id: ViewType.MANUAL, label: "Manual do Sistema", icon: <BookOpen size={22} />, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", module: 'any' },
      ].filter(item => isModuleActive(item.module as keyof AppModulesConfig | 'any') && isItemAllowed(item.id))
    },
    {
      title: "Extras",
      items: [
        { id: ViewType.OCR_TEXT_EXTRACTOR, label: "Extrator de Texto (OCR)", icon: <ScanText size={22} />, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-900/20", module: 'any' },
        { id: 'LABEL_PRINT_STUDIO', label: "Ajustes de PDF e JPG", icon: <Printer size={22} />, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", module: 'production' },
        { id: ViewType.RULE_OF_THREE, label: "Calculadora de Regra de Três", icon: <Calculator size={22} />, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-900/20", module: 'any' },
        // Aparece só pra quem tem o setor RH liberado com a função "Simulador de Rescisão" (ou
        // é Acesso Total) — diferente dos outros itens de Extras, que são abertos a qualquer
        // colaborador. Ver SECTORS['rh'] em utils/collaborators.ts.
        { id: ViewType.LABOR_TERMINATION_SIMULATOR, label: "Simulador de Rescisão", icon: <Scissors size={22} />, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20", module: 'rh' },
      ].filter(item => isModuleActive(item.module as keyof AppModulesConfig | 'any') && isItemAllowed(item.id))
    }
  ];

  return (
    <div className="flex flex-col gap-6 pb-10 h-full overflow-y-auto overflow-x-hidden force-scrollbar">

      {/* Menu Groups */}
      <div className="flex flex-col gap-6">
        {menuGroups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-3">
            {/* Sem isso, um grupo cujos itens são TODOS de um módulo desligado (ex.: "Módulo de
                Produção" com produção desativada, "Ferramentas de Módulos" sem Entregas/Bling/IA
                ligados) aparecia como uma caixa branca vazia com só o título em cima — nenhum
                item real pra mostrar, mas a seção inteira continuava lá. */}
            {group.items.length > 0 && (
            <>
            <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">{group.title}</h3>
            <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              {group.items.map((item, itemIdx) => (
                <button
                  key={item.id}
                  title={item.label}
                  aria-label={`Navegar para ${item.label}`}
                  data-guide-anchor="settings.menuItem"
                  onClick={() => {
                    if (item.id === 'SOLE_MATRIX_DIRECT') {
                      onNavigateProduction('MATRIZES');
                    } else if (typeof item.id === 'string' && item.id in PRODUCTION_CONFIG_SCREENS) {
                      onNavigateProduction(PRODUCTION_CONFIG_SCREENS[item.id]);
                    } else if (item.id === 'AI_SETTINGS') {
                      setShowAISettings(true);
                    } else if (item.id === 'ONBOARDING_WIZARD') {
                      onOpenOnboardingWizard();
                    } else if (item.id === ViewType.PRODUCT_FORM) {
                      onOpenProductCreationChoice();
                    } else if (item.id === 'LABEL_PRINT_STUDIO') {
                      onOpenLabelPrintStudio();
                    } else {
                      onNavigate(item.id as ViewType);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${itemIdx !== group.items.length - 1 ? (isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-50') : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${(item as any).bg || 'bg-slate-100 dark:bg-slate-800'} ${item.color}`}>
                      {item.icon}
                    </div>
                    <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.label}</p>
                  </div>
                  <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
                </button>
              ))}
            </div>
            </>
            )}

            {group.title === 'Módulo de Produção' && modulesConfig.production && (
              <div className={`rounded-3xl border shadow-sm p-5 flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
                      <CalendarClock size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Só Dias Úteis na Média</p>
                      <p className="text-[11px] font-medium tracking-wide text-slate-400 mt-0.5 leading-relaxed">
                        Divide os pares produzidos só pelos dias de seg. a sex. do período, excluindo sábado e domingo — em vez de todos os dias corridos
                      </p>
                      <p className="text-[11px] font-medium tracking-wide text-teal-500 mt-1 leading-relaxed">
                        Usado na barra de estatísticas do PCP Monitor e no card "Análise de Produção" do Painel, pra calcular a média de pares produzidos por dia.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleExcludeWeekends}
                    data-guide-anchor="prodcfg.excludeWeekendsToggle"
                    aria-label={excludeWeekends ? 'Desativar contagem só de dias úteis' : 'Ativar contagem só de dias úteis'}
                    className={`w-12 h-7 rounded-full transition-all relative shrink-0 ${excludeWeekends ? 'bg-indigo-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-200 ${excludeWeekends ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
                {excludeWeekends && (
                  <div className="flex flex-col gap-1.5 pl-14">
                    <button
                      type="button"
                      onClick={() => handleSetAverageMode('FULL_PERIOD')}
                      data-guide-anchor="prodcfg.averageModeFullPeriod"
                      className={`flex items-start gap-2.5 p-3 rounded-2xl text-left transition-all ${averageMode === 'FULL_PERIOD' ? (isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50') : (isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50')}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${averageMode === 'FULL_PERIOD' ? 'border-indigo-600' : isDarkMode ? 'border-slate-600' : 'border-slate-300'}`}>
                        {averageMode === 'FULL_PERIOD' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[10px] font-black uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Período Total de Dias Úteis</p>
                        <p className="text-[11px] font-medium tracking-wide text-slate-400 mt-0.5 leading-relaxed">Divide pelos dias úteis do período inteiro, mesmo os que ainda não chegaram</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAverageMode('ELAPSED')}
                      data-guide-anchor="prodcfg.averageModeElapsed"
                      className={`flex items-start gap-2.5 p-3 rounded-2xl text-left transition-all ${averageMode === 'ELAPSED' ? (isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50') : (isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50')}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${averageMode === 'ELAPSED' ? 'border-indigo-600' : isDarkMode ? 'border-slate-600' : 'border-slate-300'}`}>
                        {averageMode === 'ELAPSED' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-[10px] font-black uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Média até o Momento no Mês</p>
                          <span className="px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Recomendado</span>
                        </div>
                        <p className="text-[11px] font-medium tracking-wide text-slate-400 mt-0.5 leading-relaxed">Divide só pelos dias úteis já trabalhados até hoje — não dilui pelos dias que ainda faltam</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* ── EQUIPE / QUEM ESTÁ USANDO ── */}
        <div className="flex flex-col gap-3">
          <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Equipe</h3>
          <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <button
              onClick={() => setShowCollabSwitcher(true)}
              title="Quem está usando"
              aria-label="Trocar colaborador ativo"
              data-guide-anchor="settings.trocarColaborador"
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-slate-100 dark:active:bg-slate-800"
            >
              <div className="flex items-center gap-4">
                {activeCollaborator ? (
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white font-black text-sm" style={{ backgroundColor: activeCollaborator.colorHex }}>
                    {activeCollaborator.name.charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                    <UserCog size={22} />
                  </div>
                )}
                <div className="text-left">
                  <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Quem está usando</p>
                  <p className="text-[11px] text-blue-900 dark:text-blue-300 font-medium tracking-wide mt-0.5">{activeCollaborator ? activeCollaborator.name : 'Acesso Completo'}</p>
                </div>
              </div>
              <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
            </button>
          </div>
        </div>

        {/* ── MÓDULOS ── card próprio, fora de "Personalização" de propósito: é uma decisão de
            NEGÓCIO (o que o app pode fazer) e tem avisos de teste grátis vencendo — não é sobre
            gosto/aparência como o resto dali, então fica mais fácil de achar destacado sozinho. */}
        <div className="flex flex-col gap-3">
          <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Módulos</h3>
          <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="w-full flex items-center gap-1 p-4">
              <button
                onClick={() => onNavigate(ViewType.MODULES_CONFIG)}
                title="Módulos do Sistema"
                aria-label="Configurar módulos do sistema"
                data-guide-anchor="settings.modulosAbrir"
                className="flex-1 min-w-0 flex items-center justify-between gap-4 text-left rounded-xl transition-colors active:bg-slate-100 dark:active:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 -m-1 p-1"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                    <Shield size={22} />
                    {hasUrgentModuleTrial && (
                      <span
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900 animate-pulse"
                        aria-hidden="true"
                        title="Teste grátis de um módulo está vencendo"
                      />
                    )}
                  </div>
                  <div className="text-left min-w-0">
                    <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Módulos do Sistema</p>
                    <p className="text-[11px] text-blue-900 dark:text-blue-300 font-medium tracking-wide mt-0.5 truncate">Ativar ou desativar módulos</p>
                  </div>
                </div>
                <ChevronRight size={18} className={`shrink-0 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`} />
              </button>
              <button
                type="button"
                onClick={() => setShowModulesInfo(true)}
                title="O que são Módulos do Sistema?"
                aria-label="O que são Módulos do Sistema?"
                data-guide-anchor="settings.modulosInfo"
                className={`p-2 rounded-xl shrink-0 transition-all active:scale-90 ${isDarkMode ? 'text-slate-600 hover:text-slate-400 hover:bg-slate-800 active:bg-slate-700 active:text-slate-300' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50 active:bg-slate-200 active:text-slate-600'}`}
              >
                <Info size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* ── ACESSIBILIDADE ── */}
        <div className="flex flex-col gap-3">
          <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Personalização</h3>
          <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>

            {/* Accessibility — abre popup de teste */}
            <button
              onClick={() => setShowA11y(true)}
              title="Acessibilidade e Personalização"
              aria-label="Abrir configurações de acessibilidade e personalização"
              data-guide-anchor="settings.acessibilidadeAbrir"
              className={`w-full flex items-center justify-between p-4 transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${isDarkMode ? 'border-b border-slate-800 hover:bg-slate-800/50' : 'border-b border-slate-50 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                  <SlidersHorizontal size={22} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Acessibilidade e Personalização</p>
                  <p className="text-[11px] text-blue-900 dark:text-blue-300 font-medium tracking-wide mt-0.5">Tema, fonte e tamanho</p>
                </div>
              </div>
              <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
            </button>

            {/* ── ORGANIZAR DASHBOARD ── */}
            <button
              onClick={() => onNavigate(ViewType.DASHBOARD_CONFIG)}
              title="Organizar Dashboard"
              aria-label="Organizar layout do Dashboard"
              data-guide-anchor="settings.dashboardConfigAbrir"
              className={`w-full flex items-center justify-between p-4 transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${isDarkMode ? 'border-b border-slate-800 hover:bg-slate-800/50' : 'border-b border-slate-50 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                  <Layout size={22} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Organizar Dashboard</p>
                  <p className="text-[11px] text-blue-900 dark:text-blue-300 font-medium tracking-wide mt-0.5">Layout e atalhos da tela inicial</p>
                </div>
              </div>
              <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
            </button>

            {/* ── CONTA DESENVOLVEDORA (só quem já é conta de desenvolvimento) — reúne
                "Configurações Padrão (Novos Usuários)" e demais ações de dev lá dentro, ver
                DeveloperAccountView.tsx ── */}
            {isTemplateAdmin() && (
              <button
                onClick={() => onNavigate(ViewType.DEVELOPER_ACCOUNT)}
                title="Conta Desenvolvedora"
                aria-label="Abrir gerenciamento da conta desenvolvedora"
                className={`w-full flex items-center justify-between p-4 transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${isDarkMode ? 'border-b border-slate-800 hover:bg-slate-800/50' : 'border-b border-slate-50 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0 text-violet-600 dark:text-violet-400">
                    <ShieldCheck size={22} />
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Conta Desenvolvedora</p>
                    <p className="text-[11px] text-blue-900 dark:text-blue-300 font-medium tracking-wide mt-0.5">Só você vê isto</p>
                  </div>
                </div>
                <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
              </button>
            )}

            {/* ── PERSONALIZAR NAVEGAÇÃO ── */}
            <button
              onClick={() => setShowNavConfig(true)}
              title="Personalizar Navegação"
              aria-label="Escolher e ordenar os ícones da barra de navegação"
              data-guide-anchor="settings.navConfigAbrir"
              className={`w-full flex items-center justify-between p-4 transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${isDarkMode ? 'border-b border-slate-800 hover:bg-slate-800/50' : 'border-b border-slate-50 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                  <MoveHorizontal size={22} />
                </div>
                <div className="text-left">
                  <p className={`flex items-center gap-1.5 text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Personalizar Navegação {visualGuideTarget === 'navegacao' && <GuidePulseDot show />}</p>
                  <p className="text-[11px] text-blue-900 dark:text-blue-300 font-medium tracking-wide mt-0.5">Escolha e ordene os ícones da barra</p>
                </div>
              </div>
              <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
            </button>

            {/* ── LIMPEZA E ARQUIVAMENTO DE DADOS ── */}
            <button
              onClick={() => onNavigate(ViewType.DATA_CLEANUP)}
              title="Limpeza e Arquivamento de Dados"
              aria-label="Configurar limpeza e arquivamento de dados antigos"
              data-guide-anchor="settings.dataCleanupAbrir"
              className={`w-full flex items-center justify-between p-4 transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
                  <Database size={22} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Limpeza e Arquivamento</p>
                  <p className="text-[11px] text-blue-900 dark:text-blue-300 font-medium tracking-wide mt-0.5">Arquivar Vendas/Compras/Produção antigas</p>
                </div>
              </div>
              <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
            </button>
          </div>
        </div>

        {/* ── CONTA — LOGOUT ── */}
        <div className="flex flex-col gap-3">
          <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Conta</h3>
          <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            {faceIdUnlockEnabled ? (
              <button
                onClick={() => setShowDisableFaceIdConfirm(true)}
                title="Desativar Desbloqueio por Face ID"
                aria-label="Desativar desbloqueio por Face ID/Touch ID"
                className={`w-full flex items-center justify-between p-4 border-b transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${isDarkMode ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                    <Fingerprint size={22} />
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Desativar Desbloqueio Rápido</p>
                    <p className="text-[11px] text-blue-900 dark:text-blue-300 font-medium tracking-wide mt-0.5">Esquece a senha guardada pra Face ID/Touch ID</p>
                  </div>
                </div>
                <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
              </button>
            ) : enableFaceIdLabel && (
              <button
                onClick={() => { setEnableFaceIdError(null); setEnableFaceIdPassword(''); setShowEnableFaceId(true); }}
                title={`Ativar Desbloqueio por ${enableFaceIdLabel}`}
                aria-label={`Ativar desbloqueio por ${enableFaceIdLabel}`}
                data-guide-anchor="settings.ativarFaceId"
                className={`w-full flex items-center justify-between p-4 border-b transition-colors active:bg-slate-100 dark:active:bg-slate-800 ${isDarkMode ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                    <Fingerprint size={22} />
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Ativar Desbloqueio Rápido</p>
                    <p className="text-[11px] text-blue-900 dark:text-blue-300 font-medium tracking-wide mt-0.5">Entrar direto com {enableFaceIdLabel}, sem digitar a senha</p>
                  </div>
                </div>
                <ChevronRight size={18} className={isDarkMode ? 'text-slate-700' : 'text-slate-300'} />
              </button>
            )}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              title="Encerrar Sessão"
              aria-label="Sair da conta atual"
              data-guide-anchor="settings.sairAbrir"
              className="w-full flex items-center justify-between p-4 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors active:bg-rose-100 dark:active:bg-rose-900/20"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center shrink-0 text-rose-500">
                  <LogOut size={22} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black tracking-tight text-rose-500">Encerrar Sessão</p>
                  <p className="text-[11px] text-blue-900 dark:text-blue-300 font-medium tracking-wide mt-0.5">Sair da conta atual</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-rose-300" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 text-center">
        <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest">LIM.O APP v1.32.2</p>
      </div>

      {/* ── ACESSIBILIDADE E PERSONALIZAÇÃO — POPUP DE TESTE ── */}
      <BottomNavConfigModal
        isOpen={showNavConfig}
        onClose={() => setShowNavConfig(false)}
        config={bottomNavConfig}
        onSave={onSaveBottomNavConfig}
        modulesConfig={modulesConfig}
        isDarkMode={isDarkMode}
      />

      {showA11y && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowA11y(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md max-h-[88vh] overflow-y-auto rounded-[2rem] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
          >
            {/* Header */}
            <div className={`p-6 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
                  <SlidersHorizontal size={22} />
                </div>
                <div>
                  <h3 className={`text-base font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Acessibilidade</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Tema, fonte e tamanho</p>
                </div>
              </div>
              <button
                onClick={() => setShowA11y(false)}
                data-guide-anchor="settings.acessibilidadeFechar"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
                aria-label="Fechar" title="Fechar"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* Assistente de Personalização Visual — roda o tour guiado por Espaço no Topo/
                  Tema/Fonte/Tamanho/Ícones do Menu, um de cada vez, com explicação e bolinha
                  pulsante em cada seção (ver VISUAL_SETUP_STEPS em App.tsx). Sempre disponível
                  aqui, não só na primeira configuração da conta. */}
              {!visualGuideTarget && (
                <button
                  type="button"
                  onClick={() => { setShowA11y(false); onOpenVisualSetup(); }}
                  data-guide-anchor="settings.abrirAssistenteVisual"
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 active:scale-[0.99] transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <SlidersHorizontal size={18} />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-black">Assistente de Personalização Visual</p>
                    <p className="text-[11px] font-medium opacity-80">Um tour guiado por Tema, Fonte e mais opções</p>
                  </div>
                </button>
              )}

              {/* Dark Mode toggle — atalho rápido */}
              <div className={`flex items-center justify-between gap-3 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 text-indigo-400' : 'bg-amber-50 text-amber-500'}`}>
                    {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Modo {isDarkMode ? 'Noturno' : 'Diurno'}</p>
                    <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Atalho rápido</p>
                  </div>
                </div>
                <button
                  onClick={toggleDarkMode}
                  title="Alternar modo claro/escuro"
                  aria-label="Alternar modo claro/escuro"
                  data-guide-anchor="settings.modoEscuro"
                  className={`w-12 h-6 rounded-full relative shrink-0 transition-colors duration-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${isDarkMode ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Miniaturas dos modelos na Engenharia de Produção */}
              {setShowEngineeringThumbnails && (
                <div className={`flex items-center justify-between gap-3 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                      {showEngineeringThumbnails ? <Eye size={18} /> : <EyeOff size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Miniaturas dos Modelos</p>
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Foto nas listas de produtos cadastrados</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEngineeringThumbnails(!showEngineeringThumbnails)}
                    title="Mostrar/ocultar miniaturas dos modelos"
                    aria-label="Mostrar ou ocultar miniaturas dos modelos na Engenharia de Produção"
                    data-guide-anchor="settings.miniaturasEngenharia"
                    className={`w-12 h-6 rounded-full relative shrink-0 transition-colors duration-300 ${showEngineeringThumbnails ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${showEngineeringThumbnails ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              )}

              {/* Modo Privacidade Financeira — borra valores no Financeiro e nos cards do
                  Dashboard, pra poder mostrar a tela pra alguém sem expor números. */}
              {setHideFinancialValues && (
                <div className={`flex items-center justify-between gap-3 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                      {hideFinancialValues ? <EyeOff size={18} /> : <Eye size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Modo Privacidade Financeira</p>
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Borra valores no Financeiro e no Dashboard</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setHideFinancialValues(!hideFinancialValues)}
                    title="Ativar/desativar Modo Privacidade Financeira"
                    aria-label="Ativar ou desativar o Modo Privacidade Financeira"
                    data-guide-anchor="settings.privacidadeFinanceira"
                    className={`w-12 h-6 rounded-full relative shrink-0 transition-colors duration-300 ${hideFinancialValues ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${hideFinancialValues ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              )}

              {/* Espaço no Topo — empurra o cabeçalho pra baixo em aparelhos Android ou iPhone
                  com notch/Dynamic Island/câmera, onde a área de status pode cobrir parte dele.
                  Era um toggle liga/desliga (+40px fixo); virou um cursor livre — toca no card
                  pra abrir o ajuste fino. */}
              {setHeaderTopSpacePx && (
                <button
                  type="button"
                  onClick={() => { setDraftHeaderTopSpacePx(headerTopSpacePx); setHeaderSpaceEditorOpen(true); }}
                  title="Ajustar espaço extra no topo do cabeçalho"
                  aria-label="Ajustar espaço extra no topo do cabeçalho"
                  data-guide-anchor="settings.espacoTopoExtra"
                  className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl text-left transition-colors active:scale-[0.99] ${isDarkMode ? 'bg-slate-800 hover:bg-slate-800/70' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                      <Layout size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className={`flex items-center gap-1.5 text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Espaço no Topo {visualGuideTarget === 'topo' && <GuidePulseDot show />}</p>
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Ajuste fino pra não ficar atrás da câmera/notch</p>
                    </div>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-500 border border-slate-200'}`}>
                    {headerTopSpacePx}px
                  </span>
                </button>
              )}

              {/* Tema — acordeão minimizado por padrão (escolha rara de revisitar). */}
              <div className={`flex flex-col gap-2.5 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setThemeSectionOpen(v => !v)}
                  data-guide-anchor="settings.temaAcordeao"
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 text-pink-400' : 'bg-pink-50 text-pink-500'}`}>
                      <Palette size={18} />
                    </div>
                    <p className={`flex items-center gap-1.5 text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Tema {visualGuideTarget === 'tema' && <GuidePulseDot show />}</p>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${themeSectionOpen ? 'rotate-180' : ''}`} />
                </button>
                {themeSectionOpen && (
                  <div className="grid grid-cols-4 gap-2.5">
                    {(Object.keys(THEME_VISUALS) as ThemeId[]).map(id => {
                      const t = THEME_VISUALS[id];
                      const active = appTheme === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setAppTheme(id)}
                          data-guide-anchor="settings.tema"
                          className="flex flex-col items-center gap-1.5"
                          aria-label={`Tema ${t.label}`}
                          title={t.label}
                        >
                          <div
                            className={`w-9 h-9 rounded-lg border-2 transition-all flex items-center justify-center ${active ? 'border-violet-500 scale-110 shadow-lg' : 'border-transparent'}`}
                            style={{ background: t.swatch }}
                          >
                            {active && <Check size={14} className="text-white drop-shadow" strokeWidth={3} />}
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-wide ${active ? 'text-violet-500' : 'text-slate-400'}`}>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Fonte — acordeão minimizado por padrão (escolha rara de revisitar). */}
              <div className={`flex flex-col gap-2.5 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setFontSectionOpen(v => !v)}
                  data-guide-anchor="settings.fonteAcordeao"
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 text-blue-400' : 'bg-blue-50 text-blue-500'}`}>
                      <Type size={18} />
                    </div>
                    <p className={`flex items-center gap-1.5 text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Fonte {visualGuideTarget === 'fonte' && <GuidePulseDot show />}</p>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${fontSectionOpen ? 'rotate-180' : ''}`} />
                </button>
                {fontSectionOpen && (
                  <div className={`flex flex-col gap-1.5 max-h-48 overflow-y-auto rounded-2xl p-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                    {FONT_OPTIONS.map(opt => {
                      const active = fontFamily === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFontFamily(opt.value)}
                          data-guide-anchor="settings.fonteFamilia"
                          className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${active ? 'bg-violet-500 text-white' : isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-white text-slate-600'}`}
                          style={{ fontFamily: opt.value }}
                        >
                          <span className="text-sm truncate">{opt.label}</span>
                          {active && <Check size={14} className="shrink-0" strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tamanho da Fonte — acordeão minimizado por padrão. */}
              <div className={`flex flex-col gap-2.5 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setFontScaleSectionOpen(v => !v)}
                  data-guide-anchor="settings.fonteTamanhoAcordeao"
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 text-teal-400' : 'bg-teal-50 text-teal-500'}`}>
                      <Type size={18} />
                    </div>
                    <p className={`flex items-center gap-1.5 text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Tamanho da Fonte ({fontScale}%) {visualGuideTarget === 'tamanho' && <GuidePulseDot show />}</p>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${fontScaleSectionOpen ? 'rotate-180' : ''}`} />
                </button>
                {fontScaleSectionOpen && (
                  <div className="grid grid-cols-5 gap-2">
                    {FONT_SCALE_OPTIONS.map(pct => {
                      const active = fontScale === pct;
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setFontScale(pct)}
                          data-guide-anchor="settings.fonteTamanho"
                          className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all active:scale-95 ${active ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}
                        >
                          <span className={`font-black leading-none ${active ? 'text-violet-600 dark:text-violet-400' : isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} style={{ fontSize: `${10 + (pct / 100) * 6}px` }}>A</span>
                          <span className={`text-[9px] font-black ${active ? 'text-violet-500' : 'text-slate-400'}`}>{pct}%</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ícones do Menu — barra inferior (Home/Compras/Vendas/...) — acordeão minimizado
                  por padrão. */}
              <div className={`flex flex-col gap-2.5 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setNavIconsSectionOpen(v => !v)}
                  data-guide-anchor="settings.iconesMenuAcordeao"
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 text-amber-400' : 'bg-amber-50 text-amber-500'}`}>
                      <Layout size={18} />
                    </div>
                    <p className={`flex items-center gap-1.5 text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Ícones do Menu {visualGuideTarget === 'icones' && <GuidePulseDot show />}</p>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${navIconsSectionOpen ? 'rotate-180' : ''}`} />
                </button>
                {navIconsSectionOpen && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNavIconMode('mono')}
                        data-guide-anchor="settings.navIconMode"
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95 ${navIconMode === 'mono' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}
                      >
                        <span className={`text-[11px] font-black uppercase tracking-wide ${navIconMode === 'mono' ? 'text-violet-500' : 'text-slate-400'}`}>Monocromático</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNavIconMode('colored')}
                        data-guide-anchor="settings.navIconMode"
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all active:scale-95 ${navIconMode === 'colored' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}
                      >
                        <span className={`text-[11px] font-black uppercase tracking-wide ${navIconMode === 'colored' ? 'text-violet-500' : 'text-slate-400'}`}>Colorido</span>
                      </button>
                    </div>
                    {navIconMode === 'mono' && (
                      <div className={`flex flex-col gap-2 p-3 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Cor do ícone ativo</p>
                        <div className="flex flex-wrap gap-2">
                          {NAV_MONO_PALETTE.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNavMonoColor(c)}
                              title={c}
                              aria-label={`Cor ${c}`}
                              data-guide-anchor="settings.navMonoCor"
                              className={`w-7 h-7 rounded-lg border transition-all ${navMonoColor === c ? 'border-violet-500 scale-110 ring-2 ring-violet-500/20' : 'border-slate-200 dark:border-slate-700 hover:scale-105'}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prévia ao vivo — antes ficava solta lá em cima, junto do botão do
                        Assistente; Tiago pediu pra morar aqui dentro de Ícones do Menu, já que
                        é a cor do ícone (mono ou colorido) que muda na hora — Tema/Fonte/Tamanho
                        continuam refletidos junto, só a localização mudou. */}
                    <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-2">Prévia</p>
                      <div className={`flex items-center justify-around gap-2 p-3 rounded-2xl mb-3 ${THEME_VISUALS[appTheme].pillGradient}`}>
                        {[
                          { key: 'dashboard', Icon: LayoutDashboard },
                          { key: 'purchases', Icon: ShoppingCart },
                          { key: 'sales', Icon: ShoppingBag },
                          { key: 'financial', Icon: DollarSign },
                        ].map(({ key, Icon }) => (
                          <Icon key={key} size={18} color={navIconMode === 'colored' ? NAV_TAB_COLORS[key] : navMonoColor} />
                        ))}
                      </div>
                      <p
                        style={{ fontFamily, fontSize: `${13 * (fontScale / 100)}px` }}
                        className={`font-bold truncate px-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                      >
                        Texto de exemplo — Aa Bb Cc 123
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Controle da Barra de Atalhos — Privacidade/Ajuda/Modo Diurno no cabeçalho.
                  Acordeão minimizado por padrão, mesmo padrão de Ícones do Menu logo acima. Pra
                  cada atalho: "Exibir" (mostra/esconde o botão do cabeçalho) e "Com Movimento"
                  (o balancinho de animação ociosa — ver privacyAnim/helpAnim/themeAnim em
                  App.tsx; estático = só fica parado até o toque). */}
              <div className={`flex flex-col gap-2.5 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setShortcutBarSectionOpen(v => !v)}
                  data-guide-anchor="settings.barraAtalhosAcordeao"
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 text-sky-400' : 'bg-sky-50 text-sky-500'}`}>
                      <MoveHorizontal size={18} />
                    </div>
                    <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Controle da Barra de Atalhos</p>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${shortcutBarSectionOpen ? 'rotate-180' : ''}`} />
                </button>
                {shortcutBarSectionOpen && (
                  <div className="flex flex-col gap-2">
                    {([
                      { key: 'privacidade' as const, label: 'Privacidade', Icon: hideFinancialValues ? EyeOff : Eye, iconBg: 'bg-rose-50 dark:bg-slate-700 text-rose-500 dark:text-rose-400' },
                      { key: 'ajuda' as const, label: 'Ajuda', Icon: HelpCircle, iconBg: 'bg-sky-50 dark:bg-slate-700 text-sky-500 dark:text-sky-400' },
                      { key: 'tema' as const, label: isDarkMode ? 'Modo Noturno' : 'Modo Diurno', Icon: isDarkMode ? Moon : Sun, iconBg: 'bg-amber-50 dark:bg-slate-700 text-amber-500 dark:text-amber-400' },
                      // Scanner e IA continuam configuráveis aqui mesmo com o módulo (Produção/
                      // IA) desativado — a preferência já fica pronta e passa a valer sozinha
                      // assim que o módulo correspondente for ativado, sem precisar mexer aqui
                      // de novo depois.
                      { key: 'scanner' as const, label: 'Scanner', Icon: ScanLine, iconBg: 'bg-emerald-50 dark:bg-slate-700 text-emerald-500 dark:text-emerald-400', note: !modulesConfig.production ? 'Só aparece com o Módulo de Produção ativo' : undefined },
                      { key: 'ia' as const, label: 'Assistente IA', Icon: Sparkles, iconBg: 'bg-violet-50 dark:bg-slate-700 text-violet-500 dark:text-violet-400', note: !modulesConfig.ai ? 'Só aparece com o Assistente de IA ativo' : undefined },
                    ]).map(({ key, label, Icon, iconBg, note }) => (
                      <div key={key} className={`flex flex-col gap-2 p-3 rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white border border-slate-100'}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[13px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{label}</p>
                            {note && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate">{note}</p>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleHeaderShortcutVisibility?.(key)}
                            data-guide-anchor="settings.barraAtalhosExibir"
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
                          >
                            <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Exibir</span>
                            <span className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${headerShortcutVisibility[key] ? 'bg-indigo-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${headerShortcutVisibility[key] ? 'left-4' : 'left-0.5'}`} />
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleHeaderShortcutAnimated?.(key)}
                            disabled={!headerShortcutVisibility[key]}
                            data-guide-anchor="settings.barraAtalhosMovimento"
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl disabled:opacity-40 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
                          >
                            <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Movimento</span>
                            <span className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${headerShortcutAnimated[key] ? 'bg-indigo-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${headerShortcutAnimated[key] ? 'left-4' : 'left-0.5'}`} />
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] font-medium text-slate-400 leading-relaxed px-1">
                      "Exibir" mostra ou esconde o atalho no cabeçalho. "Movimento" liga o balancinho de animação; desligado, o ícone fica parado até você tocar.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className={`p-5 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <button
                type="button"
                onClick={() => setShowA11y(false)}
                data-guide-anchor="settings.acessibilidadeFechar"
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      <AIAssistantSettings isOpen={showAISettings} onClose={() => setShowAISettings(false)} isDarkMode={isDarkMode} />

      {/* ── QUEM ESTÁ USANDO — TROCA DE COLABORADOR ── */}
      {showCollabSwitcher && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeCollabSwitcher}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-[2rem] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
          >
            <div className={`p-6 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <UserCog size={22} />
                </div>
                <div>
                  <h3 className={`text-base font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Quem está usando</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Escolha o colaborador</p>
                </div>
              </div>
              <button
                onClick={closeCollabSwitcher}
                data-guide-anchor="settings.trocarColaboradorFechar"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
                aria-label="Fechar" title="Fechar"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              {collaborators.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  Nenhum colaborador cadastrado ainda. Cadastre em "RH", no menu Sistema & Backup.
                </p>
              )}

              {collaborators.map(collab => {
                const isTarget = switchTargetId === collab.id;
                const isActive = activeCollaborator?.id === collab.id;
                return (
                  <div key={collab.id} className="flex flex-col gap-2">
                    <div
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${isTarget ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}
                    >
                      {collab.photoUrl ? (
                        <button
                          type="button"
                          onClick={() => setExpandedCollabPhoto({ url: collab.photoUrl!, name: collab.name })}
                          title="Ampliar foto"
                          aria-label={`Ampliar foto de ${collab.name}`}
                          data-guide-anchor="settings.trocarColaboradorFoto"
                          className="w-9 h-9 rounded-xl overflow-hidden shrink-0"
                        >
                          <img src={collab.photoUrl} alt={collab.name} className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0" style={{ backgroundColor: collab.colorHex }}>
                          {collab.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { setSwitchTargetId(isTarget ? null : collab.id); setPinInput(''); setPinError(false); setPinKeypadOpen(false); }}
                        data-guide-anchor="settings.trocarColaboradorSelecionar"
                        className="flex-1 flex items-center gap-3 text-left"
                      >
                        <div className="text-left flex-1">
                          <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{collab.name}</p>
                          {isActive && <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Ativo agora</p>}
                          {collab.locked && <p className="text-[9px] font-black uppercase tracking-wider text-rose-500">Bloqueado</p>}
                        </div>
                        {collab.locked ? <Lock size={16} className="text-rose-400 shrink-0" /> : <KeyRound size={16} className="text-slate-400 shrink-0" />}
                      </button>
                    </div>

                    {isTarget && collab.locked && (
                      <div className="flex flex-col gap-2 px-1 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <p className="text-[10px] font-bold text-rose-500 text-center leading-relaxed">
                          Conta bloqueada após 5 tentativas incorretas. Peça para o administrador desbloquear em RH.
                        </p>
                      </div>
                    )}

                    {isTarget && !collab.locked && (
                      <div className="flex flex-col gap-2 px-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="relative">
                          {/* readOnly de propósito — abre o teclado personalizado abaixo ao
                              tocar, em vez do teclado nativo do celular. */}
                          <input
                            type="text"
                            readOnly
                            value={showPin ? pinInput : '•'.repeat(pinInput.length)}
                            onClick={() => setPinKeypadOpen(true)}
                            placeholder="Toque para digitar o PIN"
                            className={`w-full px-4 py-3 pr-11 rounded-2xl border-2 text-sm font-bold outline-none tracking-[0.3em] text-center cursor-pointer transition-colors ${pinError ? 'border-rose-500' : 'focus:border-indigo-500'} ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900'}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPin(v => !v)}
                            title={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                            aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                            data-guide-anchor="settings.trocarColaboradorPinToggle"
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition"
                          >
                            {showPin ? <EyeOff size={16} strokeWidth={2.5} /> : <Eye size={16} strokeWidth={2.5} />}
                          </button>
                        </div>
                        {pinError && <p className="text-[10px] font-bold text-rose-500 text-center">PIN incorreto</p>}
                        {pinKeypadOpen ? (
                          <CustomPinKeypad
                            value={pinInput}
                            onChange={(v) => { setPinInput(v); setPinError(false); }}
                            onSubmit={confirmSwitch}
                            maxLength={PIN_LENGTH}
                            isDarkMode={isDarkMode}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={confirmSwitch}
                            data-guide-anchor="settings.trocarColaboradorConfirmar"
                            className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                          >
                            Confirmar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── FOTO DO COLABORADOR AMPLIADA ── */}
      {expandedCollabPhoto && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setExpandedCollabPhoto(null)}
        >
          <div className="relative max-w-sm w-full flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <img src={expandedCollabPhoto.url} alt={expandedCollabPhoto.name} className="w-full max-h-[70vh] object-contain rounded-[2rem] shadow-2xl" />
            <p className="text-sm font-black uppercase tracking-wider text-white">{expandedCollabPhoto.name}</p>
            <button
              type="button"
              onClick={() => setExpandedCollabPhoto(null)}
              data-guide-anchor="settings.fotoAmpliadaFechar"
              className="absolute -top-3 -right-3 w-9 h-9 bg-white text-slate-700 rounded-full flex items-center justify-center shadow-md hover:bg-slate-100 transition-all"
              aria-label="Fechar" title="Fechar"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* ── LOGOUT CONFIRM MODAL ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[65000] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4 duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
              <LogOut size={32} className="text-rose-500" strokeWidth={2} />
            </div>

            <div className="text-center">
              <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Encerrar Sessão?
              </h3>
              <p className="text-[11px] font-medium tracking-wide text-blue-950 dark:text-blue-300 mt-2 leading-relaxed">
                Você será desconectado. Seus dados ficam salvos na nuvem e estarão disponíveis no próximo acesso.
              </p>
            </div>

            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                title="Cancelar Sair"
                data-guide-anchor="settings.sairCancelar"
                className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 ${
                  isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); onLogout(); }}
                title="Confirmar Sair"
                data-guide-anchor="settings.sairConfirmar"
                className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition-all active:scale-95"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDITOR DE "ESPAÇO NO TOPO" — cursor vertical com prévia ao vivo do cabeçalho.
          Fecha sem salvar se cancelar; só grava em headerTopSpacePx (e localStorage, via
          App.tsx) ao tocar em "Salvar", mesmo quando o valor já mudou por causa do arrasto. ── */}
      {headerSpaceEditorOpen && setHeaderTopSpacePx && (
        <div
          className="fixed inset-0 z-[65000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setHeaderSpaceEditorOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="text-center">
              <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Espaço no Topo</h3>
              <p className="text-[11px] font-medium tracking-wide text-blue-950 dark:text-blue-300 mt-2 leading-relaxed">
                Arraste o cursor até o cabeçalho parar exatamente abaixo da câmera/notch/barra de
                status do seu aparelho — funciona tanto no Android quanto no iPhone, já que a
                altura do recorte varia de modelo pra modelo. Também aceita valores negativos, pra
                LEVANTAR o cabeçalho se o espaço padrão já for grande demais no seu aparelho.
                Toque em "Salvar" quando estiver bom.
              </p>
            </div>

            {/* Prévia ao vivo — a barrinha se move junto com o cursor, no MESMO valor em pixels
                que será aplicado no cabeçalho de verdade. */}
            <div className={`relative rounded-2xl overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`} style={{ height: HEADER_SPACE_RANGE + 56 }}>
              <div
                className="absolute inset-x-2 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg flex items-center justify-center transition-[top] duration-75"
                style={{ top: (draftHeaderTopSpacePx - HEADER_SPACE_MIN) + 8 }}
              >
                <span className="text-white text-[9px] font-black uppercase tracking-widest">Cabeçalho</span>
              </div>
            </div>

            <div className="flex items-center gap-5">
              {/* Trilha vertical do cursor — onPointerMove só reage enquanto arrastando
                  (headerSpaceDraggingRef), então dá pra passar o dedo por cima sem querer sem
                  mudar o valor à toa. */}
              <div
                ref={headerSpaceTrackRef}
                onPointerDown={handleHeaderSpacePointerDown}
                onPointerMove={handleHeaderSpacePointerMove}
                onPointerUp={handleHeaderSpacePointerUp}
                onPointerCancel={handleHeaderSpacePointerUp}
                className={`relative w-12 h-40 rounded-full shrink-0 cursor-grab active:cursor-grabbing touch-none ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
              >
                <div className={`absolute left-1/2 -translate-x-1/2 top-2 bottom-2 w-1.5 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-indigo-600 shadow-lg border-4 border-white dark:border-slate-900 transition-[top] duration-75"
                  style={{ top: `calc(${((draftHeaderTopSpacePx - HEADER_SPACE_MIN) / HEADER_SPACE_RANGE) * 100}% - ${((draftHeaderTopSpacePx - HEADER_SPACE_MIN) / HEADER_SPACE_RANGE) * 36}px)` }}
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor Atual</span>
                <span className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{draftHeaderTopSpacePx}<span className="text-sm text-slate-400 ml-1">px</span></span>
                <button
                  type="button"
                  onClick={() => setDraftHeaderTopSpacePx(0)}
                  className="self-start text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1"
                >
                  Zerar
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setHeaderSpaceEditorOpen(false)}
                className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 ${
                  isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => { setHeaderTopSpacePx(draftHeaderTopSpacePx); setHeaderSpaceEditorOpen(false); }}
                data-guide-anchor="settings.espacoTopoSalvar"
                className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Check size={16} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ATIVAR DESBLOQUEIO POR FACE ID (pede a senha atual pra confirmar antes de guardar
          no Keychain/Keystore, mesma exigência do Firebase pra reautenticar) ── */}
      {showEnableFaceId && (
        <div className="fixed inset-0 z-[65000] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4 duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Fingerprint size={32} className="text-indigo-600 dark:text-indigo-400" strokeWidth={2} />
            </div>
            <div className="text-center">
              <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Ativar Desbloqueio Rápido?
              </h3>
              <p className="text-[11px] font-medium tracking-wide text-blue-950 dark:text-blue-300 mt-2 leading-relaxed">
                Confirme sua senha atual pra guardar o acesso com {enableFaceIdLabel} neste aparelho.
              </p>
            </div>
            <div className="w-full relative">
              <input
                type={showEnableFaceIdPassword ? 'text' : 'password'}
                value={enableFaceIdPassword}
                onChange={(e) => { setEnableFaceIdPassword(e.target.value); setEnableFaceIdError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && enableFaceIdPassword && !enableFaceIdBusy) handleConfirmEnableFaceId(); }}
                placeholder="Sua senha"
                autoFocus
                className={`w-full h-14 px-5 pr-12 rounded-2xl font-bold text-base outline-none border-2 transition-all ${isDarkMode ? 'bg-slate-800/50 border-transparent focus:border-indigo-500 text-white' : 'bg-slate-50 border-transparent focus:border-indigo-500 text-slate-900'}`}
              />
              <button
                type="button"
                onClick={() => setShowEnableFaceIdPassword(v => !v)}
                aria-label={showEnableFaceIdPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showEnableFaceIdPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {enableFaceIdError && (
              <p className="text-rose-500 text-xs font-bold text-center -mt-1">{enableFaceIdError}</p>
            )}
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setShowEnableFaceId(false)}
                disabled={enableFaceIdBusy}
                className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${
                  isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmEnableFaceId}
                disabled={enableFaceIdBusy || !enableFaceIdPassword}
                className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {enableFaceIdBusy ? 'Confirmando...' : 'Ativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DESATIVAR DESBLOQUEIO POR FACE ID CONFIRM MODAL ── */}
      {showDisableFaceIdConfirm && (
        <div className="fixed inset-0 z-[65000] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4 duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Fingerprint size={32} className="text-indigo-600 dark:text-indigo-400" strokeWidth={2} />
            </div>
            <div className="text-center">
              <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Desativar Desbloqueio Rápido?
              </h3>
              <p className="text-[11px] font-medium tracking-wide text-blue-950 dark:text-blue-300 mt-2 leading-relaxed">
                A senha guardada neste aparelho pra Face ID/Touch ID será esquecida. Você pode ativar de novo a qualquer momento na tela de login.
              </p>
            </div>
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setShowDisableFaceIdConfirm(false)}
                className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 ${
                  isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await clearLoginUnlockCredentials();
                  setFaceIdUnlockEnabled(false);
                  setShowDisableFaceIdConfirm(false);
                }}
                className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition-all active:scale-95"
              >
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPLICAÇÃO "MÓDULOS DO SISTEMA" ── clique no ícone (i) do card acima, mesmo
          padrão de popup de explicação usado em outras telas (ver "Dividir Caixas entre
          Clientes" em SaleFormView.tsx). */}
      {showModulesInfo && (
        <div
          className="fixed inset-0 z-[65000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowModulesInfo(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                  <Shield size={20} />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Módulos do Sistema
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModulesInfo(false)}
                title="Fechar"
                aria-label="Fechar"
                data-guide-anchor="settings.modulosInfoFechar"
                className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
              Liga ou desliga áreas do sistema conforme o que seu negócio usa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers, Hammer, Scissors, Check,
  ChevronRight, ArrowLeft, Plus, Minus,
  Play, User, DollarSign, FileText, CheckCircle2,
  AlertCircle, Info, Hash, Clock, Settings, HelpCircle,
  Sparkles, List, Printer, Eye, Settings2, X, Tag,
  QrCode, ScanLine, CheckSquare
} from 'lucide-react';
import PrintLabelEditorModal from './PrintLabelEditorModal';
import { scannerService } from '../services/scannerService';
import {
  ProductionLot, Product, Sector, FlowTag, ColorValue,
  ProductionConfigItem, ServiceOrder, Person, Account, Category
} from '../types';
import { firebaseService } from '../services/firebaseService';
import { financeService } from '../services/financeService';

interface CuttingProjectionPanelProps {
  lots: ProductionLot[];
  products: Product[];
  sectors: Sector[];
  flowTags: FlowTag[];
  colors: ColorValue[];
  productionConfigs: ProductionConfigItem[];
  people: Person[];
  accounts: Account[];
  categories: Category[];
  serviceOrders: ServiceOrder[];
  isDarkMode: boolean;
  selectedSectorId: string;
  onBack: () => void;
  onSaveLot: (lot: ProductionLot) => Promise<void>;
  userName?: string;
}

export default function CuttingProjectionPanel({
  lots = [],
  products = [],
  sectors = [],
  flowTags = [],
  colors = [],
  productionConfigs = [],
  people = [],
  accounts = [],
  categories = [],
  serviceOrders = [],
  isDarkMode,
  selectedSectorId,
  onBack,
  onSaveLot,
  userName = 'Operador de Corte'
}: CuttingProjectionPanelProps) {
  // Filter active lots in the cutting sector
  const cuttingLots = useMemo(() => {
    return lots.filter(l => 
      !l.finishedAt && 
      l.route && 
      l.route[l.currentSectorIndex] === selectedSectorId
    );
  }, [lots, selectedSectorId]);

  // Local state
  const [selectedLotId, setSelectedLotId] = useState<string | null>(
    cuttingLots.length > 0 ? cuttingLots[0].id : null
  );
  
  // Custom manual fold configurations
  const [foldConfigs, setFoldConfigs] = useState<Record<string, {
    dobraType: string;
    margin: number;
    chanfrar: boolean;
    observacao: string;
  }>>({});

  // Infesto/layers state per lot/piece
  const [manualLayers, setManualLayers] = useState<Record<string, number>>({});

  // Expanded accordions for pieces (collapsible layout)
  const [expandedPieces, setExpandedPieces] = useState<Record<string, boolean>>({});

  // OS Creation state
  const [isOSPanelOpen, setIsOSPanelOpen] = useState(false);
  const [osProviderId, setOsProviderId] = useState('');
  const [osValuePerPair, setOsValuePerPair] = useState<number>(0);
  const [osNotes, setOsNotes] = useState('');
  const [osAccountId, setOsAccountId] = useState('');
  const [osCategoryId, setOsCategoryId] = useState('');
  const [osDirectComplete, setOsDirectComplete] = useState(false);
  const [isSavingOS, setIsSavingOS] = useState(false);

  // Label modal state
  const [labelModalOpen, setLabelModalOpen] = useState(false);

  // QR Baixa modal state
  const [qrBaixaOpen, setQrBaixaOpen] = useState(false);
  const [qrBaixaManualCode, setQrBaixaManualCode] = useState('');
  const [qrBaixaScanning, setQrBaixaScanning] = useState(false);
  const [qrBaixaConfirm, setQrBaixaConfirm] = useState<{
    os: ServiceOrder;
    nextSectorName: string;
  } | null>(null);

  // Print states
  const [printModalData, setPrintModalData] = useState<{
    lot: ProductionLot;
    pieces: any[];
    isFromOSCreation?: boolean;
    osNumber?: string;
    providerName?: string;
    osNotes?: string;
  } | null>(null);
  const [printTab, setPrintTab] = useState<'os' | 'sheet' | 'both'>('both');

  // Active selected lot object
  const selectedLot = useMemo(() => {
    return lots.find(l => l.id === selectedLotId) || null;
  }, [lots, selectedLotId]);

  // Product and variation details for selected lot
  const lotProductDetails = useMemo(() => {
    if (!selectedLot) return null;
    const product = products.find(p => p.id === selectedLot.productId);
    const variation = product?.variations.find(v => v.id === selectedLot.variationId);
    return { product, variation };
  }, [products, selectedLot]);

  // Active sector object
  const currentSector = useMemo(() => {
    return sectors.find(s => s.id === selectedSectorId);
  }, [sectors, selectedSectorId]);

  // Cutting pieces/consumptions from engineering sheet
  const cuttingPieces = useMemo(() => {
    if (!lotProductDetails?.variation) return [];
    return (lotProductDetails.variation.consumptions || []).filter(
      c => c.category === 'CUTTING_PIECE'
    );
  }, [lotProductDetails]);

  // Preset Infesto configs from Production configs
  const infestoPresets = useMemo(() => {
    return productionConfigs.filter(c => c.type === 'INFESTO');
  }, [productionConfigs]);

  // Dynamic registered layer values from database
  const registeredLayers = useMemo(() => {
    if (infestoPresets.length > 0) {
      const layersValues = infestoPresets
        .map(p => Number(p.metadata?.layers))
        .filter(l => !isNaN(l) && l > 0);
      const unique = Array.from(new Set(layersValues)).sort((a, b) => a - b);
      if (unique.length > 0) return unique;
    }
    // Fallback default layers if nothing registered in DB yet
    return [1, 2, 4, 6, 8, 12, 16];
  }, [infestoPresets]);

  // Resolve material and tool details
  const resolvedPieces = useMemo(() => {
    return cuttingPieces.map(piece => {
      const material = productionConfigs.find(
        c => c.id === piece.materialId && c.type === 'MATERIAL'
      );
      const tool = productionConfigs.find(
        c => c.id === piece.toolId && c.type === 'TOOL'
      );
      
      const layers = manualLayers[piece.id] !== undefined 
        ? manualLayers[piece.id] 
        : (registeredLayers.includes(4) ? 4 : (registeredLayers[0] || 4)); // Try 4 first, fallback to first registered

      const foldConfig = foldConfigs[piece.id] || {
        dobraType: 'Sem Dobra',
        margin: 0,
        chanfrar: false,
        observacao: ''
      };

      return {
        piece,
        material,
        tool,
        layers,
        foldConfig
      };
    });
  }, [cuttingPieces, productionConfigs, manualLayers, foldConfigs, registeredLayers]);

  // Handle Layer change cycling through registered layers
  const handleLayerChange = (pieceId: string, delta: number) => {
    setManualLayers(prev => {
      const current = prev[pieceId] !== undefined 
        ? prev[pieceId] 
        : (registeredLayers.includes(4) ? 4 : (registeredLayers[0] || 4));
      
      // Find index in registeredLayers
      const currentIndex = registeredLayers.indexOf(current);
      if (currentIndex === -1) {
        // If current value is not in presets (arbitrary), snap to first or last depending on direction
        const nextIndex = delta > 0 ? 0 : registeredLayers.length - 1;
        return { ...prev, [pieceId]: registeredLayers[nextIndex] || 4 };
      }
      
      const nextIndex = Math.max(0, Math.min(registeredLayers.length - 1, currentIndex + delta));
      return { ...prev, [pieceId]: registeredLayers[nextIndex] };
    });
  };

  const handlePresetLayer = (pieceId: string, qty: number) => {
    setManualLayers(prev => ({ ...prev, [pieceId]: qty }));
  };

  // Handle Fold Config change
  const handleFoldConfigChange = (pieceId: string, updates: Partial<typeof foldConfigs[string]>) => {
    setFoldConfigs(prev => {
      const current = prev[pieceId] || {
        dobraType: 'Sem Dobra',
        margin: 0,
        chanfrar: false,
        observacao: ''
      };
      return {
        ...prev,
        [pieceId]: { ...current, ...updates }
      };
    });
  };

  // Providers list
  const providers = useMemo(() => {
    return people.filter(p => p.isSupplier || p.isPersonal);
  }, [people]);

  // Initialize financial accounts and categories if emitting OS
  React.useEffect(() => {
    if (isOSPanelOpen) {
      // Default account
      const defAccount = accounts.find(a => a.isDefault) || accounts[0];
      if (defAccount) setOsAccountId(defAccount.id);

      // Default category (Production/Labor Expense)
      const defCat = categories.find(
        c => c.type === 'EXPENSE' && 
        (c.name.toLowerCase().includes('mão') || 
         c.name.toLowerCase().includes('obra') || 
         c.name.toLowerCase().includes('produ'))
      ) || categories.find(c => c.type === 'EXPENSE');
      if (defCat) setOsCategoryId(defCat.id);

      // Default OS value per pair from sector or default
      if (lotProductDetails?.product) {
        const sectorPrice = lotProductDetails.product.sectorPrices?.[selectedSectorId] || 
                            currentSector?.defaultServiceValue || 
                            0;
        setOsValuePerPair(sectorPrice);
      }
    }
  }, [isOSPanelOpen, lotProductDetails, selectedSectorId, currentSector, accounts, categories]);

  // Generate Service Order
  const handleCreateOS = async () => {
    if (!selectedLot || !lotProductDetails?.product) return;

    // Trava: impede OS duplicada para o mesmo lote+setor
    if (activeOSForSelectedLot) {
      alert(`Já existe a OS ${activeOSForSelectedLot.osNumber} em aberto para este lote no setor de corte. Conclua ou exclua-a antes de emitir uma nova.`);
      setIsOSPanelOpen(false);
      return;
    }

    if (!osProviderId) {
      alert("Por favor, selecione o Cortador (Prestador)!");
      return;
    }

    setIsSavingOS(true);
    try {
      const uniqueId = `os_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const osNumberStr = `OS-C-${Date.now().toString().slice(-4)}`;
      const provider = people.find(p => p.id === osProviderId);
      const providerName = provider?.name || 'Cortador Avulso';
      
      const totalPairs = selectedLot.quantity;
      const totalValue = totalPairs * osValuePerPair;

      let transactionId = '';
      if (osAccountId && osCategoryId && totalValue > 0) {
        const txId = `tx_os_${uniqueId}`;
        const txData = {
          id: txId,
          type: 'EXPENSE',
          amount: totalValue,
          description: `Corte - OS ${osNumberStr} (Mapa: ${selectedLot.orderNumber} - Produto: ${lotProductDetails.product.name})`,
          accountId: osAccountId,
          categoryId: osCategoryId,
          date: Date.now(),
          status: osDirectComplete ? 'COMPLETED' : 'PENDING',
          personId: osProviderId || undefined,
          notes: `OS de Corte: ${osNumberStr}\nPrestador: ${providerName}\nQuantidade: ${totalPairs} pares\nPreço/Par: R$ ${osValuePerPair.toFixed(2)}`
        };
        await financeService.createTransaction(txData);
        transactionId = txId;
      }

      // Consolidate pieces and fold configurations as notes in OS
      const resolvedDetailsNotes = resolvedPieces.map(item => {
        const conjugation = item.tool?.metadata?.conjugation || 1;
        const totalFacadas = Object.entries(selectedLot.pairs || {}).reduce((sum, [size, qty]) => {
          return sum + Math.ceil(qty / (conjugation * item.layers));
        }, 0);
        
        return `- ${item.piece.name}: ${item.material?.name || 'Manual'} (${item.foldConfig.dobraType}, Infesto: ${item.layers} cam, Facadas: ${totalFacadas})`;
      }).join('\n');

      const newOS: ServiceOrder = {
        id: uniqueId,
        osNumber: osNumberStr,
        lotId: selectedLot.id,
        lotNumber: selectedLot.orderNumber,
        lotIds: [selectedLot.id],
        lotNumbers: [selectedLot.orderNumber],
        productId: selectedLot.productId,
        productName: lotProductDetails.product.name,
        variationId: selectedLot.variationId,
        variationName: lotProductDetails.variation?.colorName || '',
        sectorId: selectedSectorId,
        sectorName: currentSector?.name || 'Cortes',
        type: 'INTERNAL',
        providerId: osProviderId,
        providerName: providerName,
        quantity: totalPairs,
        valuePerPair: osValuePerPair,
        totalValue: totalValue,
        notes: `${osNotes}\n\nDetalhamento de Corte:\n${resolvedDetailsNotes}`,
        status: osDirectComplete ? 'COMPLETED' : 'PENDING',
        transactionId: transactionId || undefined,
        createdAt: Date.now(),
        finishedAt: osDirectComplete ? Date.now() : undefined
      };

      await firebaseService.saveDocument("serviceOrders", newOS);

      if (osDirectComplete) {
        // Move lot silent
        const nextSectorIndex = selectedLot.currentSectorIndex + 1;
        const nextRouteId = selectedLot.route[nextSectorIndex] || '';
        await firebaseService.updateDocument("productionLots", selectedLot.id, {
          currentSectorIndex: Math.min(nextSectorIndex, selectedLot.route.length - 1),
          currentStatusId: '',
          finishedAt: nextRouteId ? undefined : Date.now(),
          history: [
            ...(selectedLot.history || []),
            {
              sectorId: selectedSectorId,
              statusId: 'CONCLUÍDO',
              timestamp: Date.now(),
              userName: userName,
              notes: `Corte concluído e OS ${osNumberStr} baixada.`
            }
          ]
        });
      }

      // Set data for the print modal preview before auto-advancement
      setPrintModalData({
        lot: selectedLot,
        pieces: resolvedPieces,
        isFromOSCreation: true,
        osNumber: osNumberStr,
        providerName: providerName,
        osNotes: osNotes
      });
      setPrintTab('both');

      alert(`Ordem de Serviço ${osNumberStr} criada com sucesso!`);
      setIsOSPanelOpen(false);
      
      // Auto select next lot if available
      const remaining = cuttingLots.filter(l => l.id !== selectedLot.id);
      if (remaining.length > 0) {
        setSelectedLotId(remaining[0].id);
      } else {
        setSelectedLotId(null);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao emitir OS de Corte: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSavingOS(false);
    }
  };

  // Find existing OS for the printed lot (if any)
  const existingOS = useMemo(() => {
    if (!printModalData?.lot) return null;
    return serviceOrders.find(
      os => os.lotId === printModalData.lot.id && os.sectorId === selectedSectorId
    );
  }, [serviceOrders, printModalData, selectedSectorId]);

  // OS pendente do lote ATUALMENTE selecionado na estação de trabalho
  const activeOSForSelectedLot = useMemo(() => {
    if (!selectedLot) return null;
    return serviceOrders.find(os =>
      (os.lotId === selectedLot.id || (os.lotIds && os.lotIds.includes(selectedLot.id))) &&
      os.sectorId === selectedSectorId &&
      os.status === 'PENDING'
    ) || null;
  }, [serviceOrders, selectedLot, selectedSectorId]);

  // Complete an OS from cutting sector (baixa)
  const handleCompleteOSCutting = async (os: ServiceOrder) => {
    try {
      await firebaseService.updateDocument('serviceOrders', os.id, {
        status: 'COMPLETED',
        finishedAt: Date.now(),
      });
      if (os.transactionId) {
        const { financeService } = await import('../services/financeService');
        await financeService.settleTransaction(os.transactionId);
      }
      // Advance lot to next sector
      const lotObj = cuttingLots.find(l =>
        l.id === os.lotId || (os.lotIds && os.lotIds.includes(l.id))
      );
      if (lotObj) {
        const nextIdx = lotObj.currentSectorIndex + 1;
        const nextRouteId = lotObj.route[nextIdx] || '';
        await firebaseService.updateDocument('productionLots', lotObj.id, {
          currentSectorIndex: Math.min(nextIdx, lotObj.route.length - 1),
          currentStatusId: '',
          finishedAt: nextRouteId ? undefined : Date.now(),
          history: [
            ...(lotObj.history || []),
            {
              sectorId: selectedSectorId,
              statusId: 'CONCLUÍDO',
              timestamp: Date.now(),
              userName: userName,
              notes: `Baixa via QR — OS ${os.osNumber} concluída.`,
            },
          ],
        });
      }
      alert(`OS ${os.osNumber} concluída com sucesso!`);
      const remaining = cuttingLots.filter(l => l.id !== lotObj?.id);
      if (remaining.length > 0) setSelectedLotId(remaining[0].id);
      else setSelectedLotId(null);
    } catch (e) {
      alert('Erro ao concluir OS: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  // Resolve OS from a raw scan string or manual OS number
  const handleQrBaixaResolve = (raw: string) => {
    const parsed = scannerService.parseScanResult(raw);
    let os: ServiceOrder | undefined;

    if (parsed?.type === 'OS') {
      os = serviceOrders.find(so => so.id === parsed.osId);
    } else {
      const normalized = raw.trim().toUpperCase();
      os = serviceOrders.find(so =>
        so.osNumber.toUpperCase() === normalized || so.id === raw.trim()
      );
    }

    if (!os) { alert('OS não encontrada. Verifique o código e tente novamente.'); return; }
    if (os.status === 'COMPLETED') { alert(`A OS ${os.osNumber} já foi concluída.`); return; }

    const lotObj = cuttingLots.find(l =>
      l.id === os!.lotId || (os!.lotIds && os!.lotIds.includes(l.id))
    );
    const nextIdx = (lotObj?.currentSectorIndex ?? 0) + 1;
    const nextSectorId = lotObj?.route?.[nextIdx] || '';
    const nextSec = sectors.find(s => s.id === nextSectorId);
    setQrBaixaConfirm({ os, nextSectorName: nextSec?.name || 'CONCLUÍDO' });
  };

  // High-fidelity browser print trigger
  const handlePrint = () => {
    if (!printModalData) return;

    const printContainerId = 'temp-cutting-print-container';
    let oldContainer = document.getElementById(printContainerId);
    if (oldContainer) {
      oldContainer.remove();
    }

    const printWindow = document.createElement('div');
    printWindow.id = printContainerId;
    
    // Inject printing styles directly
    const styles = `
      @media screen {
        #temp-cutting-print-container {
          display: none !important;
        }
      }
      @page { size: A4 portrait; margin: 1.8cm 1.5cm; }
      @page landscape { size: A4 landscape; margin: 1.2cm 1.0cm; }

      @media print {
        body > *:not(#temp-cutting-print-container) {
          display: none !important;
        }
        #temp-cutting-print-container {
          display: block !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
          color: #000 !important;
          background: #fff !important;
        }
        .print-page {
          page-break-after: always;
          page-break-inside: avoid;
          padding: 0 !important;
          margin: 0 !important;
          box-sizing: border-box;
        }
        .print-page-landscape {
          page-break-after: always;
          page-break-inside: avoid;
          padding: 0 !important;
          margin: 0 !important;
          box-sizing: border-box;
        }
        .print-page:last-child,
        .print-page-landscape:last-child {
          page-break-after: avoid;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 10px 0 !important;
          table-layout: auto !important;
        }
        th, td {
          border: 1px solid #000 !important;
          padding: 5px 6px !important;
          text-align: left !important;
          font-size: 10px !important;
          word-break: break-word;
        }
        th {
          background-color: #f3f4f6 !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        /* Tabela de facadas: forçar paisagem com largura expandida */
        .facadas-table {
          width: 100% !important;
          font-size: 9px !important;
          border-collapse: collapse !important;
        }
        .facadas-table th,
        .facadas-table td {
          border: 1px solid #000 !important;
          padding: 4px 4px !important;
          font-size: 9px !important;
          white-space: nowrap;
        }
        .facadas-table .col-peca { width: 110px !important; white-space: normal !important; }
        .facadas-table .col-mat  { width: 90px  !important; white-space: normal !important; }
        .facadas-table .col-num  { width: 38px  !important; text-align: center !important; }
        .facadas-table .col-size { width: 32px  !important; text-align: center !important; font-weight: 900 !important; }
        .facadas-table .col-bat  { width: 48px  !important; text-align: center !important; background: #e5e7eb !important; font-weight: 900 !important; }
        .header-title {
          font-size: 20px !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          border-bottom: 3px solid #000 !important;
          padding-bottom: 5px !important;
          margin-bottom: 15px !important;
        }
        .info-grid {
          display: grid !important;
          grid-template-cols: repeat(2, 1fr) !important;
          gap: 12px !important;
          margin-bottom: 25px !important;
        }
        .info-item {
          font-size: 12px !important;
          line-height: 1.5 !important;
        }
        .info-label {
          font-weight: 800 !important;
          text-transform: uppercase !important;
          font-size: 10px !important;
          color: #374151 !important;
          display: block !important;
          margin-bottom: 2px !important;
        }
        .info-val {
          font-weight: bold !important;
          font-size: 13px !important;
        }
        .grid-table {
          margin-top: 10px !important;
          margin-bottom: 20px !important;
        }
        .grid-header-cell {
          text-align: center !important;
          font-weight: 900 !important;
          background: #e5e7eb !important;
        }
        .grid-value-cell {
          text-align: center !important;
          font-weight: 900 !important;
          font-size: 13px !important;
        }
        .signature-section {
          margin-top: 60px !important;
          display: flex !important;
          justify-content: space-between !important;
          gap: 60px !important;
        }
        .signature-box {
          flex: 1 !important;
          text-align: center !important;
          font-size: 11px !important;
          border-top: 2px solid #000 !important;
          padding-top: 6px !important;
          margin-top: 40px !important;
        }
        .badge {
          background: #000 !important;
          color: #fff !important;
          padding: 4px 8px !important;
          border-radius: 4px !important;
          font-weight: 900 !important;
          font-size: 10px !important;
          display: inline-block !important;
          text-transform: uppercase !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.innerHTML = styles;
    printWindow.appendChild(styleEl);

    const showOS = printTab === 'os' || printTab === 'both';
    const showSheet = printTab === 'sheet' || printTab === 'both';

    const lot = printModalData.lot;
    const pieces = printModalData.pieces;
    const product = products.find(p => p.id === lot.productId);
    const variation = product?.variations.find(v => v.id === lot.variationId);
    
    const osNumber = printModalData.osNumber || existingOS?.osNumber || `OS-CORTE-PREVIA`;
    const providerName = printModalData.providerName || existingOS?.providerName || 'Sem Cortador Designado';
    const valPerPair = printModalData.isFromOSCreation ? printModalData.lot.quantity : (existingOS?.valuePerPair || 0); 
    const totalValue = lot.quantity * valPerPair;

    const formattedDate = new Date().toLocaleDateString('pt-BR');
    let htmlContent = '';

    // Page 1: Ordem de Serviço de Corte
    if (showOS) {
      htmlContent += `
        <div class="print-page">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 24px;">
            <div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase;">GESTÃO PRO</h1>
              <p style="margin: 3px 0 0 0; font-size: 10px; font-weight: 800; color: #4b5563; text-transform: uppercase; letter-spacing: 2px;">Sistema de Produção & PCP</p>
            </div>
            <div style="text-align: right;">
              <span class="badge">Ordem de Serviço de Corte</span>
              <p style="margin: 6px 0 0 0; font-size: 18px; font-weight: 900; letter-spacing: -0.5px;">${osNumber}</p>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Mapa de Produção / Lote</span>
              <span class="info-val">#${lot.orderNumber}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Data de Emissão</span>
              <span class="info-val">${formattedDate}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Referência / Produto</span>
              <span class="info-val">${product?.name || 'Não cadastrado'} <span style="font-weight: normal; color: #4b5563;">(${product?.reference || 'S/Ref'})</span></span>
            </div>
            <div class="info-item">
              <span class="info-label">Cor / Variação</span>
              <span class="info-val">${variation?.colorName || 'Não cadastrado'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Cortador Responsável</span>
              <span class="info-val">${providerName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Setor</span>
              <span class="info-val">${currentSector?.name || 'Corte'}</span>
            </div>
          </div>

          <h3 style="font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 6px; margin-top: 30px;">Grade de Distribuição de Pares</h3>
          <table class="grid-table">
            <thead>
              <tr>
                <th style="width: 140px;">Tamanho</th>
                ${Object.keys(lot.pairs || {}).map(sz => `<th class="grid-header-cell">${sz}</th>`).join('')}
                <th style="background: #e5e7eb; font-weight: 900; text-align: center; width: 100px;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 900;">Quantidade (Pares)</td>
                ${Object.values(lot.pairs || {}).map(val => `<td class="grid-value-cell">${val}</td>`).join('')}
                <td style="font-weight: 900; text-align: center; background: #f3f4f6; font-size: 14px;">${lot.quantity}</td>
              </tr>
            </tbody>
          </table>

          <h3 style="font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 6px; margin-top: 30px;">Valores de Serviço</h3>
          <table style="margin-top: 10px;">
            <thead>
              <tr>
                <th>Pares Totais</th>
                <th>Valor por Par</th>
                <th style="text-align: right;">Total Mão de Obra</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: bold; font-size: 12px;">${lot.quantity} Pares</td>
                <td style="font-weight: bold; font-size: 12px;">R$ ${valPerPair.toFixed(2)}</td>
                <td style="text-align: right; font-weight: 900; font-size: 15px; color: #000;">R$ ${totalValue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          ${printModalData.osNotes || existingOS?.notes ? `
            <h3 style="font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 6px; margin-top: 30px;">Instruções e Detalhes Adicionais</h3>
            <div style="font-size: 11px; border: 1.5px solid #000; padding: 12px; line-height: 1.6; margin-top: 10px; white-space: pre-line;">
              ${printModalData.isFromOSCreation ? osNotes : (existingOS?.notes || '')}
            </div>
          ` : ''}

          <div class="signature-section">
            <div class="signature-box">
              <p style="margin: 0; font-weight: 900;">${providerName}</p>
              <p style="margin: 3px 0 0 0; color: #374151; font-size: 9px; text-transform: uppercase; font-weight: bold;">Assinatura do Cortador</p>
            </div>
            <div class="signature-box">
              <p style="margin: 0; font-weight: 900;">Supervisão de Produção</p>
              <p style="margin: 3px 0 0 0; color: #374151; font-size: 9px; text-transform: uppercase; font-weight: bold;">Assinatura de Controle</p>
            </div>
          </div>
        </div>
      `;
    }

    // Page 2: Ficha Técnica com Padrões de Corte
    if (showSheet) {
      const materialsSummary: Record<string, { name: string; ref: string; consumption: number; unit: string }> = {};
      pieces.forEach(item => {
        const mat = item.material;
        if (!mat) return;
        const matId = mat.id;
        const unitName = productionConfigs.find(u => u.id === mat?.metadata?.unitId)?.name || 'UN';
        const unitCons = Number(item.piece.quantity) || 0;
        const totalCons = lot.quantity * unitCons;
        
        if (!materialsSummary[matId]) {
          materialsSummary[matId] = {
            name: mat.name,
            ref: mat.metadata?.reference || 'S/Ref',
            consumption: 0,
            unit: unitName
          };
        }
        materialsSummary[matId].consumption += totalCons;
      });

      // Part A: Ficha Técnica - Materiais e Grade
      htmlContent += `
        <div class="print-page" style="page-break-before: ${showOS ? 'always' : 'auto'};">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 24px;">
            <div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase;">GESTÃO PRO</h1>
              <p style="margin: 3px 0 0 0; font-size: 10px; font-weight: 800; color: #4b5563; text-transform: uppercase; letter-spacing: 2px;">Sistema de Produção & PCP</p>
            </div>
            <div style="text-align: right;">
              <span class="badge" style="background: #e0f2fe !important; border: 1.5px solid #000 !important; color: #000 !important;">Ficha Técnica - Materiais e Grade</span>
              <p style="margin: 6px 0 0 0; font-size: 12px; font-weight: 900; text-transform: uppercase; color: #374151;">Lote: #${lot.orderNumber} • Emissão: ${formattedDate}</p>
            </div>
          </div>

          <div class="info-grid" style="grid-template-cols: repeat(3, 1fr) !important;">
            <div class="info-item">
              <span class="info-label">Referência / Modelo</span>
              <span class="info-val">${product?.name || 'Não cadastrado'} (${product?.reference || 'S/Ref'})</span>
            </div>
            <div class="info-item">
              <span class="info-label">Grade / Cor</span>
              <span class="info-val">${variation?.colorName || 'Não cadastrado'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Total de Pares</span>
              <span class="info-val">${lot.quantity} Pares</span>
            </div>
          </div>

          <h3 style="font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 6px; margin-top: 25px;">Requisição Consolidada de Materiais</h3>
          <table style="margin-top: 10px;">
            <thead>
              <tr>
                <th>Código / Nome do Material</th>
                <th>Referência</th>
                <th style="text-align: right; width: 180px;">Consumo Total Estimado</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(materialsSummary).map(m => `
                <tr>
                  <td style="font-weight: bold; font-size: 11px;">${m.name}</td>
                  <td style="font-size: 11px;">${m.ref}</td>
                  <td style="text-align: right; font-weight: 900; font-size: 12px; color: #000;">${m.consumption.toFixed(3)} ${m.unit}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h3 style="font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 6px; margin-top: 30px;">Grade Detalhada do Mapa</h3>
          <table class="grid-table">
            <thead>
              <tr>
                <th style="width: 140px;">Tamanho</th>
                ${Object.keys(lot.pairs || {}).map(sz => `<th class="grid-header-cell">${sz}</th>`).join('')}
                <th style="background: #e5e7eb; font-weight: 900; text-align: center; width: 100px;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: bold;">Pares</td>
                ${Object.values(lot.pairs || {}).map(val => `<td class="grid-value-cell">${val}</td>`).join('')}
                <td style="font-weight: 900; text-align: center; background: #f3f4f6; font-size: 13px;">${lot.quantity}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      // Part B: Ficha Técnica - Padrão de Facadas (paisagem para caber todas as colunas)
      htmlContent += `
        <div class="print-page-landscape" style="page-break-before: always;">
          <style>@page { size: A4 landscape; margin: 1.2cm 1.0cm; }</style>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 18px;">
            <div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase;">GESTÃO PRO</h1>
              <p style="margin: 2px 0 0 0; font-size: 9px; font-weight: 800; color: #4b5563; text-transform: uppercase; letter-spacing: 2px;">Sistema de Produção & PCP</p>
            </div>
            <div style="text-align: right;">
              <span class="badge" style="background: #e0f2fe !important; border: 1.5px solid #000 !important; color: #000 !important;">Padrão de Facadas / Batidas por Peça</span>
              <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #374151;">Lote: #${lot.orderNumber} • ${formattedDate}</p>
            </div>
          </div>

          <div style="display: flex; gap: 24px; margin-bottom: 16px;">
            <div><span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #6b7280; display: block;">Referência / Modelo</span>
              <span style="font-size: 12px; font-weight: 900;">${product?.name || '—'} <span style="font-weight: normal; color: #4b5563;">(${product?.reference || 'S/Ref'})</span></span></div>
            <div><span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #6b7280; display: block;">Cor / Variação</span>
              <span style="font-size: 12px; font-weight: 900;">${variation?.colorName || '—'}</span></div>
            <div><span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #6b7280; display: block;">Total do Mapa</span>
              <span style="font-size: 12px; font-weight: 900; color: #1e3a8a;">${lot.quantity} Pares</span></div>
          </div>

          <p style="font-size: 8px; color: #4b5563; font-style: italic; margin: 0 0 10px 0;">
            * As batidas mostram exatamente quantos golpes o cortador precisa dar para cada grade com base nas camadas.
          </p>

          <table class="facadas-table">
            <thead>
              <tr>
                <th class="col-peca">Peça / Faca</th>
                <th class="col-mat">Material</th>
                <th class="col-num" style="text-align:center;">Conj.</th>
                <th class="col-num" style="text-align:center; color:#1e3a8a;">Infesto</th>
                ${Object.keys(lot.pairs || {}).map(sz => `<th class="col-size">T${sz}</th>`).join('')}
                <th class="col-bat">Batidas<br/>Total</th>
              </tr>
            </thead>
            <tbody>
              ${pieces.map(item => {
                const conjugation = item.tool?.metadata?.conjugation || 1;
                const layers = item.layers;
                let totalStrikes = 0;
                const sizeStrikesHtml = Object.entries(lot.pairs || {}).map(([size, qty]) => {
                  const strokesNeeded = Math.ceil(qty / (conjugation * layers));
                  totalStrikes += strokesNeeded;
                  return `<td class="col-size" style="font-weight:${strokesNeeded > 0 ? '900' : 'normal'}; color:${strokesNeeded > 0 ? '#000' : '#d1d5db'};">${strokesNeeded || '—'}</td>`;
                }).join('');
                return `
                  <tr>
                    <td class="col-peca">
                      <div style="font-weight:900; font-size:10px;">${item.piece.name}</div>
                      <div style="font-size:8px; color:#4b5563; margin-top:1px;">Faca: ${item.tool?.name || 'S/Ref'}<br/>Ref: ${item.tool?.metadata?.reference || '—'}</div>
                    </td>
                    <td class="col-mat">
                      <div style="font-weight:bold; font-size:10px;">${item.material?.name || 'Manual'}</div>
                      <div style="font-size:8px; color:#4b5563; margin-top:1px;">Ref: ${item.material?.metadata?.reference || 'S/Ref'}</div>
                    </td>
                    <td class="col-num" style="text-align:center; font-weight:900; font-size:11px;">${conjugation}x</td>
                    <td class="col-num" style="text-align:center; font-weight:900; font-size:11px; color:#1e3a8a;">${layers}c.</td>
                    ${sizeStrikesHtml}
                    <td class="col-bat" style="font-weight:900; font-size:13px; color:#000; background:#e5e7eb !important;">${totalStrikes}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div style="margin-top: 50px; display: flex; justify-content: space-between; gap: 60px;">
            <div style="flex:1; text-align:center; border-top: 2px solid #000; padding-top: 6px; margin-top: 30px;">
              <p style="margin:0; font-weight:900; font-size:11px;">${providerName}</p>
              <p style="margin:3px 0 0 0; color:#374151; font-size:9px; text-transform:uppercase; font-weight:bold;">Assinatura do Cortador</p>
            </div>
            <div style="flex:1; text-align:center; border-top: 2px solid #000; padding-top: 6px; margin-top: 30px;">
              <p style="margin:0; font-weight:900; font-size:11px;">Supervisão de Produção</p>
              <p style="margin:3px 0 0 0; color:#374151; font-size:9px; text-transform:uppercase; font-weight:bold;">Assinatura de Controle</p>
            </div>
          </div>
        </div>
      `;
    }

    printWindow.innerHTML = htmlContent;
    document.body.appendChild(printWindow);
    window.print();
    printWindow.remove();
  };

  return (
    <div className={`p-6 rounded-[2.5rem] border-2 flex flex-col gap-6 ${isDarkMode ? 'bg-slate-950 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
      
      {/* Header Area */}
      <div className="flex items-center justify-between border-b pb-6 border-slate-250 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={`p-3 rounded-2xl transition-all ${isDarkMode ? 'bg-slate-900 text-slate-400 hover:text-white' : 'bg-white text-slate-500 hover:text-slate-900 shadow-sm'}`}
            title="Voltar ao PCP"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Scissors size={22} className="text-indigo-500 animate-pulse" />
              <h2 className="text-xl font-black uppercase tracking-wider">Projeção e Corte Digital</h2>
            </div>
            <p className="text-[9px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-widest mt-1">
              Setor: {currentSector?.name || 'Cortes'} • Terminal de Projeção Industrial
            </p>
          </div>
        </div>

        {/* Quick status */}
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black px-4 py-2 rounded-xl border ${
            isDarkMode 
              ? 'text-indigo-400 bg-indigo-950/40 border-indigo-500/20' 
              : 'text-indigo-700 bg-indigo-50 border-indigo-200/50'
          }`}>
            {cuttingLots.length} MAPAS NA FILA
          </span>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Lot Selection & Overview (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className={`p-6 rounded-3xl flex flex-col gap-4 border ${isDarkMode ? 'bg-slate-900/60 border-slate-850' : 'bg-white border-slate-100 shadow-sm'}`}>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <List size={14} /> Selecione o Mapa de Produção
            </h3>
            
            {cuttingLots.length === 0 ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                <Scissors size={32} className="opacity-20 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhum mapa na fila de corte</p>
                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mt-1">Novos lotes aparecerão conforme forem iniciados no PCP</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {cuttingLots.map(lot => {
                  const product = products.find(p => p.id === lot.productId);
                  const variation = product?.variations.find(v => v.id === lot.variationId);
                  const isSelected = selectedLotId === lot.id;
                  const lotOS = serviceOrders.find(os =>
                    (os.lotId === lot.id || (os.lotIds && os.lotIds.includes(lot.id))) &&
                    os.sectorId === selectedSectorId &&
                    os.status === 'PENDING'
                  );

                  return (
                    <button
                      key={lot.id}
                      onClick={() => {
                        setSelectedLotId(lot.id);
                        setIsOSPanelOpen(false);
                      }}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? isDarkMode
                            ? 'border-indigo-500 bg-indigo-950/40 text-white font-black'
                            : 'border-indigo-600 bg-indigo-50 text-indigo-950 font-black shadow-md'
                          : isDarkMode
                            ? 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-350'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 shadow-sm'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${
                            lot.prioridade === 'URGENTE' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {lot.prioridade}
                          </span>
                          <span className={`text-[10px] font-black ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-500'}`}>#{lot.orderNumber}</span>
                          {/* Badge OS já emitida */}
                          {lotOS && (
                            <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-emerald-500 text-white flex items-center gap-1">
                              ✓ {lotOS.osNumber}
                            </span>
                          )}
                        </div>
                        <h4 className={`text-xs font-black uppercase truncate ${isSelected ? 'text-indigo-950 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>{product?.name || 'Sem nome'}</h4>
                        <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${isSelected ? 'text-indigo-750 dark:text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          Ref: {product?.reference} • Cor: {variation?.colorName}
                        </p>
                      </div>

                      <div className="text-right shrink-0 ml-3">
                        <span className={`text-sm font-black ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>{lot.quantity}</span>
                        <p className={`text-[8px] font-black uppercase tracking-widest leading-none mt-1 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-455 dark:text-slate-500'}`}>Pares</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Big Info and Size Distribution Card */}
          {selectedLot && lotProductDetails?.product && (
            <div className={`p-6 rounded-3xl border flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900/60 border-slate-850' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center gap-4">
                {lotProductDetails.product.photoUrl ? (
                  <img src={lotProductDetails.product.photoUrl} alt={lotProductDetails.product.name} className="w-16 h-16 rounded-2xl object-cover border border-slate-800" />
                ) : (
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-slate-855 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                    <Scissors size={24} />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">{lotProductDetails.product.name}</h3>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-350 uppercase tracking-widest mt-1">
                    Ref: {lotProductDetails.product.reference} • Cor: {lotProductDetails.variation?.colorName}
                  </p>
                  <p className="text-[11px] font-black text-indigo-650 dark:text-indigo-400 uppercase mt-1">
                    TOTAL MAPA: {selectedLot.quantity} PARES
                  </p>
                </div>
              </div>

              {/* Large Size Grid Projection */}
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black text-slate-455 dark:text-slate-400 uppercase tracking-widest">Distribuição da Grade (Pares)</span>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                  {Object.entries(selectedLot.pairs || {}).map(([size, qty]) => (
                    <div key={size} className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                      qty > 0 
                        ? isDarkMode
                          ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-sm' 
                          : 'border-indigo-300 bg-indigo-50/80 text-indigo-950 shadow-sm'
                        : isDarkMode 
                          ? 'border-slate-800 bg-slate-950/20 opacity-30 text-slate-605' 
                          : 'border-slate-200 bg-slate-50 opacity-40 text-slate-450'
                    }`}>
                      <span className={`text-[10px] font-black leading-none mb-1 ${qty > 0 ? 'text-indigo-600 dark:text-indigo-350' : 'text-slate-455 dark:text-slate-400'}`}>{size}</span>
                      <span className={`text-sm font-black leading-none ${qty > 0 ? 'text-indigo-950 dark:text-white font-black' : 'text-slate-400'}`}>{qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Cutting detail Workspace (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {!selectedLot ? (
            <div className={`h-full min-h-[450px] rounded-3xl border border-dashed flex flex-col items-center justify-center text-center p-8 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <Scissors size={48} className="text-slate-600 animate-bounce mb-4" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Selecione um Mapa de Produção</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">
                Selecione um Mapa de Produção na coluna à esquerda para iniciar a projeção de corte
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              
              {/* Workspace Navigation/Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 mb-2">
                <div className="w-full sm:w-auto">
                  <h3 className="text-xs font-black uppercase tracking-[0.25em] text-indigo-400 leading-tight">
                    Mapa de Produção #{selectedLot.orderNumber}
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 leading-normal">
                    Ficha Técnica de Corte: facas, materiais e infestos
                  </p>
                </div>
                
                {/* Workspace Header Actions — 2 rows on mobile */}
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  {/* Row 1: Imprimir Ficha + Etiqueta Térmica */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPrintModalData({
                          lot: selectedLot,
                          pieces: resolvedPieces,
                          osNotes: existingOS?.notes
                        });
                        setPrintTab('sheet');
                      }}
                      className={`flex-1 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900 shadow-sm'
                      }`}
                    >
                      <Printer size={14} /> Imprimir Ficha
                    </button>

                    {lotProductDetails?.product && (
                      <button
                        type="button"
                        onClick={() => setLabelModalOpen(true)}
                        className={`flex-1 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border ${
                          isDarkMode
                            ? 'bg-amber-950/30 border-amber-700/40 text-amber-400 hover:bg-amber-900/40 hover:text-amber-300'
                            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-900 shadow-sm'
                        }`}
                      >
                        <Tag size={14} /> Etiqueta Térmica
                      </button>
                    )}
                  </div>

                  {/* Row 2: OS badge/button + QR baixa */}
                  {!isOSPanelOpen && (
                    <div className="flex gap-2">
                      {activeOSForSelectedLot ? (
                        <>
                          <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-400 dark:border-emerald-700 min-w-0">
                            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest truncate">
                              ✓ {activeOSForSelectedLot.osNumber}
                            </span>
                          </div>
                          <button
                            type="button"
                            title="Dar Baixa por QR Code"
                            onClick={() => {
                              setQrBaixaOpen(true);
                              setQrBaixaManualCode('');
                              setQrBaixaConfirm(null);
                            }}
                            className={`px-4 py-3 rounded-2xl border-2 active:scale-95 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shrink-0 ${
                              isDarkMode
                                ? 'bg-violet-950/40 border-violet-700/40 text-violet-400 hover:bg-violet-900/50'
                                : 'bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100'
                            }`}
                          >
                            <QrCode size={14} /> Baixa QR
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsOSPanelOpen(true)}
                          className="flex-1 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/35 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Play size={14} fill="currentColor" /> Iniciar / Emitir OS
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Legenda do setor de corte ─────────────────────────────── */}
              <div className={`flex flex-wrap gap-3 px-3 py-2.5 rounded-2xl border text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                <span className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Legenda:</span>
                {[
                  { dot: 'bg-indigo-500',   label: 'Mapa de Produção', desc: 'Agrupamento de pares em rota de produção — o que está sendo cortado' },
                  { dot: 'bg-violet-500',   label: 'Ficha Técnica',    desc: 'Especificação de corte: peças, facas, materiais e infestos — clique em "Imprimir Ficha"' },
                  { dot: 'bg-emerald-500',  label: 'OS de Corte',      desc: 'Ordem de Serviço emitida para o cortador — gera registro financeiro' },
                  { dot: 'bg-amber-500',    label: 'Batidas/Facadas',  desc: 'Quantidade de golpes por tamanho com base nas camadas de infesto e conjugação da faca' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5 group relative">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`}/>
                    <span className={`${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item.label}</span>
                    <div className={`absolute bottom-full left-0 mb-1 px-2.5 py-1.5 rounded-xl text-[9px] font-bold normal-case tracking-normal whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white'}`}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>

              {/* OS Configuration Panel Inline */}
              <AnimatePresence>
                {isOSPanelOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`p-6 rounded-3xl border-2 border-indigo-600 flex flex-col gap-6 ${isDarkMode ? 'bg-indigo-950/10' : 'bg-indigo-50/20'}`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/20 pb-4">
                      <div className="flex items-center gap-2">
                        <User className="text-indigo-400 animate-pulse" size={18} />
                        <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400">Configuração da Ordem de Serviço (OS) de Corte</h4>
                      </div>
                      <button
                        onClick={() => setIsOSPanelOpen(false)}
                        aria-label="Fechar"
                        title="Fechar"
                        className={`p-1.5 rounded-lg text-slate-400 hover:text-white ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* Worker select */}
                      <div className="flex flex-col gap-2">
                        <label htmlFor="os-provider-select" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Cortador (Operador) *</label>
                        <select
                          id="os-provider-select"
                          value={osProviderId}
                          onChange={(e) => setOsProviderId(e.target.value)}
                          className={`w-full px-4 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 text-slate-805 dark:text-white ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-white border-slate-200 focus:border-indigo-500'
                          }`}
                        >
                          <option value="" className="text-slate-800 dark:text-slate-200">Selecione...</option>
                          {providers.map(p => (
                            <option key={p.id} value={p.id} className="text-slate-800 dark:text-slate-200">{p.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Pay rate per pair */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Mão de Obra por Par (R$)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={osValuePerPair || ''}
                            onChange={(e) => setOsValuePerPair(parseFloat(e.target.value) || 0)}
                            className={`w-full pl-10 pr-4 py-3.5 rounded-2xl font-bold text-xs outline-none border-2 text-slate-805 dark:text-white ${
                              isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-white border-slate-200 focus:border-indigo-500'
                            }`}
                            placeholder="0,00"
                          />
                        </div>
                      </div>

                      {/* Account selection for Finance */}
                      <div className="flex flex-col gap-2">
                        <label htmlFor="os-account-select" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Caixa / Conta Financeira</label>
                        <select
                          id="os-account-select"
                          value={osAccountId}
                          onChange={(e) => setOsAccountId(e.target.value)}
                          className={`w-full px-4 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none border-2 text-slate-805 dark:text-white ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-white border-slate-200 focus:border-indigo-500'
                          }`}
                        >
                          <option value="" className="text-slate-850 dark:text-slate-200">NÃO GERAR FINANCEIRO</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id} className="text-slate-850 dark:text-slate-200">{a.name}</option>
                          ))}
                        </select>
                      </div>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* OS Notes */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Observações / Notas da OS</label>
                        <input
                          type="text"
                          value={osNotes}
                          onChange={(e) => setOsNotes(e.target.value)}
                          placeholder="Ex: Corte prioritário de camurça"
                          className={`w-full px-5 py-3.5 rounded-2xl font-bold text-xs outline-none border-2 text-slate-805 dark:text-white ${
                            isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-white border-slate-200 focus:border-indigo-500'
                          }`}
                        />
                      </div>

                      {/* Complete status or workflow update */}
                      <div className="flex items-center gap-6 px-2 py-2">
                        <label className="relative flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={osDirectComplete}
                            onChange={(e) => setOsDirectComplete(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`relative w-11 h-6 rounded-full transition-all duration-200 shrink-0 ${
                            osDirectComplete 
                              ? 'bg-indigo-600' 
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}>
                            <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-200 ${
                              osDirectComplete ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </div>
                          <div className="ml-3">
                            <span className="text-[10px] font-black uppercase tracking-widest block text-slate-705 dark:text-slate-200">Baixa Direta / Concluir</span>
                            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Já avançar lote e finalizar OS no ato!
                            </span>
                          </div>
                        </label>
                      </div>

                    </div>

                    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border ${
                      isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="text-left">
                        <span className="text-[8px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest block">Custo de Mão de Obra Calculado</span>
                        <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                          R$ {(selectedLot.quantity * osValuePerPair).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="flex flex-row gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setIsOSPanelOpen(false)}
                          className={`flex-1 sm:flex-initial px-5 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-center transition-all ${
                            isDarkMode 
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                          }`}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateOS}
                          disabled={isSavingOS}
                          className="flex-1 sm:flex-initial px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isSavingOS ? 'Salvando...' : 'Confirmar e Salvar OS'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cutting pieces detail cards / panels */}
              {resolvedPieces.length === 0 ? (
                <div className={`py-16 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center text-center p-6 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                  <HelpCircle size={32} className="text-slate-600 mb-2" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sem peças de corte configuradas</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Esta variação do produto não tem peças categorizadas como "CUTTING_PIECE" na Ficha Técnica
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {resolvedPieces.map(({ piece, material, tool, layers, foldConfig }, index) => {
                    const conjugation = tool?.metadata?.conjugation || 1;
                    
                    // Total strokes for this specific piece
                    const totalFacadas = Object.entries(selectedLot.pairs || {}).reduce((sum, [size, qty]) => {
                      return sum + Math.ceil(qty / (conjugation * layers));
                    }, 0);

                    // Material consumption total
                    const totalConsumo = selectedLot.quantity * piece.quantity;

                    // Dynamic premium color configurations for different pieces to identify at a glance
                    const pieceColors = [
                      {
                        bg: 'bg-rose-50 dark:bg-rose-950/30',
                        border: 'border-rose-200/50 dark:border-rose-500/20',
                        text: 'text-rose-600 dark:text-rose-450',
                        hoverBorder: 'hover:border-rose-400 dark:hover:border-rose-700/50'
                      },
                      {
                        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
                        border: 'border-emerald-200/50 dark:border-emerald-500/20',
                        text: 'text-emerald-600 dark:text-emerald-450',
                        hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-700/50'
                      },
                      {
                        bg: 'bg-amber-50 dark:bg-amber-950/30',
                        border: 'border-amber-200/50 dark:border-amber-500/20',
                        text: 'text-amber-600 dark:text-amber-450',
                        hoverBorder: 'hover:border-amber-400 dark:hover:border-amber-700/50'
                      },
                      {
                        bg: 'bg-violet-50 dark:bg-violet-950/30',
                        border: 'border-violet-200/50 dark:border-violet-500/20',
                        text: 'text-violet-600 dark:text-violet-450',
                        hoverBorder: 'hover:border-violet-400 dark:hover:border-violet-700/50'
                      },
                      {
                        bg: 'bg-cyan-50 dark:bg-cyan-950/30',
                        border: 'border-cyan-200/50 dark:border-cyan-500/20',
                        text: 'text-cyan-600 dark:text-cyan-450',
                        hoverBorder: 'hover:border-cyan-400 dark:hover:border-cyan-700/50'
                      },
                      {
                        bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30',
                        border: 'border-fuchsia-200/50 dark:border-fuchsia-500/20',
                        text: 'text-fuchsia-600 dark:text-fuchsia-450',
                        hoverBorder: 'hover:border-fuchsia-400 dark:hover:border-fuchsia-700/50'
                      },
                      {
                        bg: 'bg-orange-50 dark:bg-orange-950/30',
                        border: 'border-orange-200/50 dark:border-orange-500/20',
                        text: 'text-orange-600 dark:text-orange-450',
                        hoverBorder: 'hover:border-orange-400 dark:hover:border-orange-700/50'
                      }
                    ];

                    const colorStyle = pieceColors[index % pieceColors.length];
                    const isExpanded = expandedPieces[piece.id] !== false;

                    return (
                      <div 
                        key={piece.id}
                        className={`p-6 rounded-[2.2rem] border flex flex-col gap-6 transition-all duration-300 relative ${
                          isDarkMode 
                            ? `bg-slate-900 border-slate-800/80 ${colorStyle.hoverBorder}` 
                            : `bg-white border-slate-100 shadow-sm hover:shadow-md ${colorStyle.hoverBorder}`
                        }`}
                      >
                        {/* Absolute Top-Right Chevron Toggle Button */}
                        <div className="absolute top-6 right-6 z-10 pointer-events-none">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                            isExpanded 
                              ? `${colorStyle.bg} ${colorStyle.border} ${colorStyle.text} rotate-180` 
                              : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-400'
                          }`}>
                            <ChevronRight size={18} className="transform rotate-90" />
                          </div>
                        </div>

                        {/* Piece Accordion Header (Click to toggle) */}
                        <div 
                          onClick={() => setExpandedPieces(prev => ({ ...prev, [piece.id]: !isExpanded }))}
                          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 cursor-pointer select-none group pr-12 lg:pr-16"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${colorStyle.bg} ${colorStyle.border} ${colorStyle.text} group-hover:scale-105 duration-200 shrink-0`}>
                              <Scissors size={22} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-3">
                                <h4 className={`text-lg md:text-xl lg:text-2xl font-black uppercase tracking-tight ${colorStyle.text}`}>
                                  {piece.name}
                                </h4>
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                                  isExpanded 
                                    ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400' 
                                    : `${colorStyle.bg} ${colorStyle.text} border ${colorStyle.border}`
                                }`}>
                                  {isExpanded ? 'Expandido' : 'Recolhido'}
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>Faca: <span className="text-indigo-650 dark:text-indigo-400 font-black">{tool?.name || piece.toolId || 'Não Vinculada'}</span></span>
                                <span className="text-slate-350 dark:text-slate-700">•</span>
                                <span>Ref: <span className="font-black text-slate-650 dark:text-slate-300">{tool?.metadata?.reference || '---'}</span></span>
                              </p>

                              {/* Grade Total a Ser Cortada - Junto a Faca */}
                              <div className="mt-3 flex flex-col gap-2">
                                <div className="flex items-center gap-1.5 text-slate-450 dark:text-slate-455 uppercase tracking-wider">
                                  <List size={11} className="text-indigo-500" />
                                  <span className="text-[10px] font-black">Grade a Cortar:</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(selectedLot.pairs || {}).map(([size, qty]) => {
                                    if (qty === 0) return null;
                                    return (
                                      <div 
                                        key={size}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 border transition-all ${
                                          isDarkMode 
                                            ? 'bg-slate-955 border-slate-800 text-indigo-400 shadow-sm' 
                                            : 'bg-indigo-50/60 border-indigo-100 text-indigo-900 shadow-xs'
                                        }`}
                                      >
                                        <span className="opacity-70 text-[9px] uppercase tracking-wider">TAM {size}</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                        <span className="text-[12px] font-black text-slate-900 dark:text-white">{qty} p</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Side - Material, Consumption & Accordion Indicator */}
                          <div className="flex flex-wrap items-center gap-4 lg:shrink-0 lg:ml-auto">
                            <div className="text-left lg:text-right">
                              <span className="text-[10px] font-black text-slate-400 dark:text-slate-555 uppercase tracking-wider">Material & Cor</span>
                              <p className="text-xs font-black text-slate-800 dark:text-white uppercase mt-0.5">
                                {material?.name || 'Manual'} <span className="text-slate-400 font-normal">({material?.metadata?.reference || 'S/Ref'})</span>
                              </p>
                              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-wide mt-1 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/40 inline-block">
                                Consumo total: {totalConsumo.toFixed(3)} {productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'UN'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Content Area */}
                        {isExpanded && (
                          <div className="flex flex-col gap-6">

                        {/* Interactive Infesto & Stroke configuration row */}
                        <div className={`p-5 rounded-2xl border ${
                          isDarkMode 
                            ? 'bg-slate-950/40 border-slate-800' 
                            : 'bg-slate-50 border-slate-200'
                        }`}>
                          
                          {/* Infesto Setup (layers) */}
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Layers size={12} className="text-indigo-500 dark:text-indigo-400" /> Setup de Infesto (Camadas)
                              </span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                                isDarkMode 
                                  ? 'text-indigo-400 bg-indigo-950/60' 
                                  : 'text-indigo-700 bg-indigo-50 border border-indigo-100'
                              }`}>
                                {layers} Camadas Ativas
                              </span>
                            </div>
                            
                            {/* Layer Counter Buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleLayerChange(piece.id, -1)}
                                aria-label="Diminuir camadas"
                                title="Diminuir camadas"
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors border ${
                                  isDarkMode
                                    ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-950 hover:bg-slate-50 shadow-sm'
                                }`}
                              >
                                <Minus size={16} />
                              </button>
                              <div className={`flex-1 text-center py-2 border rounded-xl ${
                                isDarkMode 
                                  ? 'bg-slate-950/60 border-slate-850' 
                                  : 'bg-white border-slate-200 shadow-sm'
                              }`}>
                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-550">{layers} Camadas</span>
                              </div>
                              <button
                                onClick={() => handleLayerChange(piece.id, 1)}
                                aria-label="Aumentar camadas"
                                title="Aumentar camadas"
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors border ${
                                  isDarkMode
                                    ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-950 hover:bg-slate-50 shadow-sm'
                                }`}
                              >
                                <Plus size={16} />
                              </button>
                            </div>

                            {/* Preset shortcuts */}
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {registeredLayers.map(preset => {
                                const presetName = infestoPresets.find(p => Number(p.metadata?.layers) === preset)?.name || `${preset} Camadas`;
                                return (
                                  <button
                                    key={preset}
                                    onClick={() => handlePresetLayer(piece.id, preset)}
                                    title={presetName}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all flex items-center gap-1 ${
                                      layers === preset 
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : isDarkMode
                                          ? 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                                          : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-sm'
                                    }`}
                                  >
                                    <Layers size={10} /> {presetName}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Fold Margin & Folding configuration */}
                          <div className="hidden flex flex-col gap-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Settings size={12} className="text-indigo-550 dark:text-indigo-400" /> Configuração de Dobras & Acabamento
                            </span>
                            
                            <div className="grid grid-cols-2 gap-2">
                              {/* Dobra type select */}
                              <select
                                value={foldConfig.dobraType}
                                onChange={(e) => handleFoldConfigChange(piece.id, { dobraType: e.target.value })}
                                aria-label="Selecione o tipo de dobra"
                                className={`w-full px-3 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider outline-none border ${
                                  isDarkMode 
                                    ? 'bg-slate-900 border-slate-800 text-slate-200 focus:border-indigo-500' 
                                    : 'bg-white border-slate-200 text-slate-750 focus:border-indigo-600 shadow-sm'
                                }`}
                              >
                                <option value="Sem Dobra">Sem Dobra</option>
                                <option value="Dobra Simples">Dobra Simples (1.5mm)</option>
                                <option value="Dobra Dupla">Dobra Dupla (3.0mm)</option>
                                <option value="Debum / Vivo">Debum / Vivo</option>
                                <option value="Dobra Francesa">Dobra Francesa</option>
                              </select>

                              {/* Margin input */}
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={foldConfig.margin || ''}
                                  onChange={(e) => handleFoldConfigChange(piece.id, { margin: parseFloat(e.target.value) || 0 })}
                                  className={`w-full pl-3 pr-12 py-2.5 rounded-xl font-black text-[10px] uppercase text-right outline-none border ${
                                    isDarkMode
                                      ? 'bg-slate-900 border-slate-800 text-slate-200 focus:border-indigo-500'
                                      : 'bg-white border-slate-200 text-slate-705 focus:border-indigo-600 shadow-sm'
                                  }`}
                                  placeholder="0.0"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase">Margem</span>
                              </div>
                            </div>

                            {/* Chanfrar toggle */}
                            <div className="flex items-center justify-between px-2 pt-1">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={foldConfig.chanfrar}
                                  onChange={(e) => handleFoldConfigChange(piece.id, { chanfrar: e.target.checked })}
                                  className={`rounded focus:ring-indigo-550 ${
                                    isDarkMode 
                                      ? 'border-slate-800 bg-slate-900 text-indigo-500' 
                                      : 'border-slate-300 bg-white text-indigo-600'
                                  }`}
                                />
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Chanfrar bordas antes de dobrar</span>
                              </label>
                            </div>
                          </div>

                        </div>

                        {/* Intelligent Infesto & Folding Assistant */}
                        {(() => {
                          const totalParesLote = selectedLot.quantity;
                          const materialUnit = productionConfigs.find(u => u.id === material?.metadata?.unitId)?.name || 'M';

                          // 1. Calculate surplus (sobra) for a given layer option
                          const calculateSobraForLayers = (layerOption: number) => {
                            let totalParesCortados = 0;
                            Object.entries(selectedLot.pairs || {}).forEach(([size, qty]) => {
                              const strokesForSize = Math.ceil(qty / (conjugation * layerOption));
                              totalParesCortados += strokesForSize * conjugation * layerOption;
                            });
                            return totalParesCortados - totalParesLote;
                          };

                          // 2. Map all registered layer options to their sobra and strokes
                          const optionsMetrics = registeredLayers.map(l => {
                            const sobra = calculateSobraForLayers(l);
                            const strokes = Object.entries(selectedLot.pairs || {}).reduce((sum, [size, qty]) => {
                              return sum + Math.ceil(qty / (conjugation * l));
                            }, 0);
                            return { layers: l, sobra, strokes };
                          });

                          // Sort options to find the best single configuration (minimum surplus, then minimum strokes)
                          const bestSingleSetup = [...optionsMetrics].sort((a, b) => {
                            if (a.sobra !== b.sobra) return a.sobra - b.sobra;
                            return a.strokes - b.strokes;
                          })[0] || { layers, sobra: calculateSobraForLayers(layers), strokes: totalFacadas };

                          // Name of the best preset
                          const bestPresetName = infestoPresets.find(p => Number(p.metadata?.layers) === bestSingleSetup.layers)?.name || `${bestSingleSetup.layers} Camadas`;

                          // 3. Current configuration metrics
                          const currentSobra = calculateSobraForLayers(layers);
                          const currentPresetName = infestoPresets.find(p => Number(p.metadata?.layers) === layers)?.name || `${layers} Camadas`;

                          // 4. Physical Folding / Infesto Instruction (Base de Cálculo de Consumo)
                          const totalConsumoMetros = totalParesLote * piece.quantity;
                          const singleLayerLength = totalConsumoMetros / layers;

                          // 5. Two-Fold (Dobra Dupla) Calculation
                          const splitData = Object.entries(selectedLot.pairs || {}).map(([size, qty]) => {
                            const exactStrokes = Math.floor(qty / (conjugation * layers));
                            const cutQty1 = exactStrokes * conjugation * layers;
                            const remQty = qty - cutQty1;
                            return { size, exactStrokes, cutQty1, remQty };
                          });

                          const run1Pairs = splitData.reduce((sum, d) => sum + d.cutQty1, 0);
                          const run2Pairs = totalParesLote - run1Pairs;

                          // Best sub-layer count for Phase 2 (must be smaller than current 'layers')
                          const possibleSubLayers = registeredLayers.filter(l => l < layers);
                          const bestSubLayer = possibleSubLayers.sort((a, b) => {
                            const getSobraForRem = (l: number) => {
                              let cut = 0;
                              splitData.forEach(d => {
                                if (d.remQty > 0) {
                                  cut += Math.ceil(d.remQty / (conjugation * l)) * conjugation * l;
                                }
                              });
                              return cut - run2Pairs;
                            };
                            return getSobraForRem(a) - getSobraForRem(b);
                          })[0] || 1;

                          // Secondary run metrics
                          const run2CutQty = splitData.reduce((sum, d) => {
                            if (d.remQty <= 0) return sum;
                            return sum + Math.ceil(d.remQty / (conjugation * bestSubLayer)) * conjugation * bestSubLayer;
                          }, 0);

                          const run2Sobra = run2CutQty - run2Pairs;

                          const run1Consumo = run1Pairs * piece.quantity;
                          const run1LayerLength = run1Consumo / layers;

                          const run2Consumo = run2Pairs * piece.quantity;
                          const run2LayerLength = run2Consumo / bestSubLayer;

                          const totalTwoFoldSobra = run2Sobra;

                          const isTwoFoldBetter = run2Pairs > 0 && totalTwoFoldSobra < currentSobra;

                          return (
                            <div className={`p-5 rounded-[1.8rem] border flex flex-col gap-4 ${
                              isDarkMode 
                                ? 'bg-slate-950/20 border-slate-800/60 text-slate-300' 
                                : 'bg-indigo-50/20 border-indigo-100/55 text-slate-705 shadow-sm'
                            }`}>
                              {/* Header */}
                              <div className="flex items-center justify-between border-b pb-3 border-slate-200/50 dark:border-slate-800/50">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-indigo-550/10 text-indigo-600 dark:text-indigo-400">
                                    <Sparkles size={16} />
                                  </div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-850 dark:text-white">
                                      Assistente Inteligente de Infesto & Sobra
                                    </h5>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                      Otimização de consumo físico por facada
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                  {/* Smart choice button — applies the best layer instantly */}
                                  {bestSingleSetup.layers !== layers && (
                                    <button
                                      type="button"
                                      onClick={() => handlePresetLayer(piece.id, bestSingleSetup.layers)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[8px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm shadow-indigo-600/30"
                                    >
                                      <Sparkles size={10} /> Escolha Inteligente
                                    </button>
                                  )}
                                  <span className={`text-[8px] font-black px-2.5 py-1 rounded-full ${
                                    currentSobra === 0
                                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                      : currentSobra <= 2
                                        ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                        : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                  }`}>
                                    {currentSobra === 0 ? 'DESPERDÍCIO ZERO' : `SOBRA ATUAL: ${currentSobra} PARES`}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
                                {/* Left side - optimization recommendations */}
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Análise de Rendimento</span>
                                  </div>

                                  <div className="flex flex-col gap-2">
                                    {/* Config atual */}
                                    <div className={`p-3 rounded-xl flex items-center justify-between border ${
                                      isDarkMode ? 'bg-slate-900/60 border-slate-850' : 'bg-white border-slate-150 shadow-sm'
                                    }`}>
                                      <div>
                                        <p className="font-bold text-slate-400 uppercase text-[8px] tracking-wider">Infesto Selecionado</p>
                                        <p className="font-black text-slate-800 dark:text-white uppercase mt-0.5">{currentPresetName}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-bold text-slate-400 uppercase text-[8px] tracking-wider">Excedente</p>
                                        <p className={`font-black mt-0.5 ${currentSobra === 0 ? 'text-emerald-500 text-[11px]' : 'text-rose-600 dark:text-rose-400 text-[13px]'}`}>
                                          {currentSobra} Par(es)
                                        </p>
                                      </div>
                                    </div>

                                    {/* Config Recomendada */}
                                    {bestSingleSetup.layers !== layers && (
                                      <div className={`p-3 rounded-xl flex items-center justify-between border border-dashed ${
                                        isDarkMode 
                                          ? 'bg-indigo-950/20 border-indigo-900/60' 
                                          : 'bg-indigo-50/40 border-indigo-150'
                                      }`}>
                                        <div>
                                          <p className="font-black text-indigo-650 dark:text-indigo-400 uppercase text-[8px] tracking-wider flex items-center gap-1">
                                            <Sparkles size={8} /> Melhor Configuração Única
                                          </p>
                                          <p className="font-black text-slate-850 dark:text-white uppercase mt-0.5">
                                            {bestPresetName} ({bestSingleSetup.layers} Camadas)
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-bold text-slate-400 uppercase text-[8px] tracking-wider">Menor Sobra</p>
                                          <p className="font-black text-emerald-500 mt-0.5">
                                            {bestSingleSetup.sobra} Par(es)
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    {/* Default message if current is best */}
                                    {bestSingleSetup.layers === layers && currentSobra > 0 && (
                                      <div className="px-2 py-1 flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[8px]">
                                        <CheckCircle2 size={10} className="text-emerald-500" /> O infesto atual é o melhor setup único para este lote.
                                      </div>
                                    )}
                                    {currentSobra === 0 && (
                                      <div className="px-2 py-1 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black uppercase text-[8px]">
                                        <CheckCircle2 size={10} className="text-emerald-500" /> Ótimo! Todas as facadas cortam a quantidade exata demandada.
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right side - Physical Folding Instructions */}
                                <div className="flex flex-col gap-3">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Instruções Físicas de Dobra</span>

                                  <div className="flex flex-col gap-2">
                                    {/* Standard Single Fold */}
                                    <div className={`p-3 rounded-xl border ${
                                      isDarkMode ? 'bg-slate-900/60 border-slate-850' : 'bg-white border-slate-150 shadow-sm'
                                    }`}>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-black uppercase tracking-widest text-[8px] text-slate-450 dark:text-slate-400">
                                          Opção A: Dobra Única Padrão
                                        </span>
                                        {currentSobra > 0 && isTwoFoldBetter && (
                                          <span className="text-[8px] font-black uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded border border-rose-300/30">
                                            Sobra: {currentSobra}p
                                          </span>
                                        )}
                                      </div>
                                      <p className="font-bold text-slate-650 dark:text-slate-300 leading-relaxed">
                                        Cortar <span className="font-black text-indigo-650 dark:text-indigo-400">{totalConsumoMetros.toFixed(2)} {materialUnit}</span> dobrados em <span className="font-black text-slate-805 dark:text-white">{layers} camadas</span> de <span className="font-black text-slate-805 dark:text-white">{singleLayerLength.toFixed(2)} {materialUnit}</span>.
                                      </p>
                                    </div>

                                    {/* Smart Two Folds Option */}
                                    {run2Pairs > 0 && (
                                      <div className={`p-3 rounded-xl border ${
                                        isTwoFoldBetter 
                                          ? isDarkMode 
                                            ? 'bg-emerald-950/20 border-emerald-900/40' 
                                            : 'bg-emerald-50/30 border-emerald-100 shadow-sm'
                                          : isDarkMode
                                            ? 'bg-slate-900/40 border-slate-850'
                                            : 'bg-white border-slate-150 shadow-sm'
                                      }`}>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-black uppercase tracking-widest text-[8px] text-emerald-650 dark:text-emerald-400 flex items-center gap-1">
                                            <Layers size={10} /> Opção B: Instrução de Dobra Dupla
                                          </span>
                                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                            isTwoFoldBetter
                                              ? totalTwoFoldSobra === 0
                                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-300/30'
                                                : 'bg-emerald-500/10 text-emerald-600 border-emerald-300/30'
                                              : totalTwoFoldSobra > 0
                                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-300/30'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent'
                                          }`}>
                                            {totalTwoFoldSobra > 0 ? `Sobra: ${totalTwoFoldSobra}p` : 'Zero Sobra'} {isTwoFoldBetter && '⭐ Economia'}
                                          </span>
                                        </div>
                                        <div className="flex flex-col gap-1 text-slate-650 dark:text-slate-300 leading-tight">
                                          <p>
                                            <span className="font-black text-slate-700 dark:text-slate-200">1. Dobra Principal:</span> Esticar <span className="font-bold">{run1Consumo.toFixed(2)} {materialUnit}</span> em <span className="font-bold">{layers} camadas</span> de <span className="font-bold">{run1LayerLength.toFixed(2)} {materialUnit}</span>.
                                          </p>
                                          <p>
                                            <span className="font-bold text-slate-700 dark:text-slate-205">2. Dobra de Ajuste:</span> Esticar <span className="font-bold">{run2Consumo.toFixed(2)} {materialUnit}</span> em <span className="font-bold">{bestSubLayer} camadas</span> de <span className="font-bold">{run2LayerLength.toFixed(2)} {materialUnit}</span>.
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Strokes (Facadas) Calculation Grid per Size */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Cálculo de Batidas/Facadas por Numeração (Grade)
                            </span>
                            <span className={`text-[9px] font-black px-3 py-1 rounded-full border ${
                              isDarkMode 
                                ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/10' 
                                : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            }`}>
                              CONJUGAÇÃO FACA: {conjugation} PAR/BATIDA
                            </span>
                          </div>

                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            {Object.entries(selectedLot.pairs || {}).map(([size, qty]) => {
                              if (qty === 0) return null;
                              
                              // Calculate strokes needed for this size
                              // Strokes = Ceil( Required Pairs / (Layers * Conjugation) )
                              const strokesNeeded = Math.ceil(qty / (conjugation * layers));

                              return (
                                <div 
                                  key={size} 
                                  className={`p-3 rounded-2xl flex flex-col items-center border transition-all ${
                                    isDarkMode ? 'bg-slate-950 border-slate-850' : 'bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <span className="text-[9px] font-black text-slate-500 mb-0.5 leading-none">TAM {size}</span>
                                  <span className="text-[9px] font-bold text-slate-450 dark:text-slate-400 mb-1 leading-none">{qty} Par(es)</span>
                                  
                                  {/* Calculated stroke box */}
                                  <div className={`w-full py-1.5 rounded-lg text-center border ${
                                    isDarkMode 
                                      ? 'bg-slate-900 border-indigo-950' 
                                      : 'bg-indigo-50 border-indigo-100/50'
                                  }`}>
                                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{strokesNeeded}</span>
                                    <p className="text-[7px] font-bold uppercase tracking-widest text-slate-500 leading-none mt-0.5">Golpes</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                          {/* Total strokes info bar */}
                          <div className={`flex flex-col gap-1.5 p-4 rounded-2xl border mt-2 ${
                            isDarkMode 
                              ? 'bg-slate-950/30 border-slate-800' 
                              : 'bg-indigo-50/30 border-indigo-100/40'
                          }`}>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                              <span className="text-[9px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-widest">
                                Total de batidas necessárias para o lote:
                              </span>
                            </div>
                            <div className="pl-3.5 flex items-baseline gap-1.5">
                              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                {totalFacadas}
                              </span>
                              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">
                                Batidas / Facadas
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}
        </div>

      </div>

      {/* High-Fidelity Print Preview Modal */}
      <AnimatePresence>
        {printModalData && (() => {
          const lot = printModalData.lot;
          const pieces = printModalData.pieces;
          const product = products.find(p => p.id === lot.productId);
          const variation = product?.variations.find(v => v.id === lot.variationId);
          
          const osNumber = printModalData.osNumber || existingOS?.osNumber || `OS-CORTE-PREVIA`;
          const providerName = printModalData.providerName || existingOS?.providerName || 'Sem Cortador Designado';
          const valPerPair = printModalData.isFromOSCreation 
            ? printModalData.lot.quantity 
            : (existingOS?.valuePerPair || 0);
          const totalValue = lot.quantity * valPerPair;
          
          const formattedDate = new Date().toLocaleDateString('pt-BR');

          // Consolidated materials summary
          const materialsSummary: Record<string, { name: string; ref: string; consumption: number; unit: string }> = {};
          pieces.forEach(item => {
            const mat = item.material;
            if (!mat) return;
            const matId = mat.id;
            const unitName = productionConfigs.find(u => u.id === mat?.metadata?.unitId)?.name || 'UN';
            const unitCons = Number(item.piece.quantity) || 0;
            const totalCons = lot.quantity * unitCons;
            
            if (!materialsSummary[matId]) {
              materialsSummary[matId] = {
                name: mat.name,
                ref: mat.metadata?.reference || 'S/Ref',
                consumption: 0,
                unit: unitName
              };
            }
            materialsSummary[matId].consumption += totalCons;
          });

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className={`w-full max-w-5xl h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <Printer size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black uppercase tracking-wider">Visualizador e Central de Impressão</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Visualize e envie para impressão o Lote #{lot.orderNumber}
                      </p>
                    </div>
                  </div>

                  {/* Document Switcher tabs */}
                  <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setPrintTab('both')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        printTab === 'both'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                      }`}
                    >
                      Completo (Ambos)
                    </button>
                    <button
                      onClick={() => setPrintTab('sheet')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        printTab === 'sheet'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                      }`}
                    >
                      Ficha de Corte
                    </button>
                    <button
                      onClick={() => setPrintTab('os')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        printTab === 'os'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                      }`}
                    >
                      Ordem de Serviço
                    </button>
                  </div>

                  <button
                    onClick={() => setPrintModalData(null)}
                    aria-label="Fechar"
                    title="Fechar"
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-250 dark:hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Document Preview (Simulates absolute printable paper sizing) */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-100 dark:bg-slate-950 flex flex-col items-center gap-8">
                  {/* Ordem de Serviço Preview */}
                  {(printTab === 'os' || printTab === 'both') && (
                    <div className="w-full max-w-[21cm] bg-white border border-slate-200 dark:border-slate-800 text-black shadow-lg p-10 font-sans min-h-[29.7cm] flex flex-col justify-between rounded-lg relative overflow-hidden">
                      {/* Document Watermark */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none opacity-[0.03]">
                        <Scissors size={350} className="text-black transform -rotate-12" />
                      </div>

                      <div>
                        {/* Title Bar */}
                        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                          <div>
                            <h1 className="margin-none text-2xl font-black uppercase tracking-tight">GESTÃO PRO</h1>
                            <p className="margin-none text-[8px] font-black tracking-widest text-slate-500 uppercase">Sistema de Produção & PCP</p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 border border-black bg-black text-white text-[9px] font-black tracking-widest uppercase rounded">
                              Ordem de Serviço de Corte
                            </span>
                            <p className="text-lg font-black mt-1.5 text-indigo-700">{osNumber}</p>
                          </div>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Mapa de Produção / Lote</span>
                            <span className="font-bold text-sm">#{lot.orderNumber}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Data de Emissão</span>
                            <span className="font-bold text-sm">{formattedDate}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Referência / Produto</span>
                            <span className="font-bold text-sm">
                              {product?.name || 'Não cadastrado'} <span className="font-normal text-xs text-slate-500">({product?.reference || 'S/Ref'})</span>
                            </span>
                          </div>
                          <div>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Cor / Variação</span>
                            <span className="font-bold text-sm">{variation?.colorName || 'Não cadastrada'}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Cortador Responsável</span>
                            <span className="font-bold text-sm">{providerName}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Setor</span>
                            <span className="font-bold text-sm">{currentSector?.name || 'Corte'}</span>
                          </div>
                        </div>

                        {/* Sizes Grid */}
                        <h4 className="text-xs font-black uppercase tracking-wider border-b border-black pb-1.5 mb-2 mt-8">Grade de Distribuição de Pares</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr>
                                <th className="border border-black p-2 text-left text-[10px] uppercase font-black bg-slate-100">Tamanho</th>
                                {Object.keys(lot.pairs || {}).map(sz => (
                                  <th key={sz} className="border border-black p-2 text-center text-[10px] uppercase font-black bg-slate-50">{sz}</th>
                                ))}
                                <th className="border border-black p-2 text-center text-[10px] uppercase font-black bg-slate-200">TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border border-black p-2 text-left font-black text-[11px]">Qtd (Pares)</td>
                                {Object.values(lot.pairs || {}).map((val, idx) => (
                                  <td key={idx} className="border border-black p-2 text-center font-black text-sm">{val}</td>
                                ))}
                                <td className="border border-black p-2 text-center font-black text-sm bg-slate-50">{lot.quantity}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Values details */}
                        <h4 className="text-xs font-black uppercase tracking-wider border-b border-black pb-1.5 mb-2 mt-8">Valores de Serviço</h4>
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="border border-black p-2 text-left text-[10px] uppercase font-black bg-slate-50">Pares Totais</th>
                              <th className="border border-black p-2 text-left text-[10px] uppercase font-black bg-slate-50">Valor por Par</th>
                              <th className="border border-black p-2 text-right text-[10px] uppercase font-black bg-slate-100">Total Mão de Obra</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-black p-2 text-left font-black text-xs">{lot.quantity} Pares</td>
                              <td className="border border-black p-2 text-left font-black text-xs text-indigo-700">R$ {valPerPair.toFixed(2)}</td>
                              <td className="border border-black p-2 text-right font-black text-sm text-green-700 bg-slate-50">R$ {totalValue.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* OS Notes */}
                        {(printModalData.osNotes || existingOS?.notes) && (
                          <div className="mt-8">
                            <h4 className="text-xs font-black uppercase tracking-wider border-b border-black pb-1.5 mb-2">Instruções e Detalhes Adicionais</h4>
                            <div className="border border-black p-4 text-[10px] leading-relaxed whitespace-pre-line bg-slate-50">
                              {printModalData.isFromOSCreation ? osNotes : (existingOS?.notes || '')}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Signatures */}
                      <div className="flex justify-between gap-10 mt-12 pt-8">
                        <div className="flex-1 text-center border-t border-black pt-2">
                          <span className="font-bold text-[11px] block">{providerName}</span>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Assinatura do Cortador</span>
                        </div>
                        <div className="flex-1 text-center border-t border-black pt-2">
                          <span className="font-bold text-[11px] block">Supervisão de Produção</span>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Controle de Qualidade</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ficha Detalhada com Padrões de Corte Preview */}
                  {(printTab === 'sheet' || printTab === 'both') && (
                    <>
                      {/* Part A: Materiais e Grade */}
                      <div className="w-full max-w-[21cm] bg-white border border-slate-200 dark:border-slate-800 text-black shadow-lg p-10 font-sans min-h-[29.7cm] flex flex-col justify-between rounded-lg relative overflow-hidden shrink-0">
                        {/* Document Watermark */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none opacity-[0.03]">
                          <Layers size={350} className="text-black transform rotate-12" />
                        </div>

                        <div>
                          {/* Title Bar */}
                          <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                            <div>
                              <h1 className="margin-none text-2xl font-black uppercase tracking-tight">GESTÃO PRO</h1>
                              <p className="margin-none text-[8px] font-black tracking-widest text-slate-500 uppercase">Sistema de Produção & PCP</p>
                            </div>
                            <div className="text-right">
                              <span className="px-2 py-0.5 border border-black bg-sky-100 text-black text-[9px] font-black tracking-widest uppercase rounded">
                                Ficha Técnica - Materiais e Grade
                              </span>
                              <p className="text-xs font-black mt-2 text-slate-500">Lote: #{lot.orderNumber} • Emissão: {formattedDate}</p>
                            </div>
                          </div>

                          {/* Details grid */}
                          <div className="grid grid-cols-3 gap-4 mb-6">
                            <div>
                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Referência / Modelo</span>
                              <span className="font-bold text-xs">{product?.name || 'Não cadastrado'} <span className="text-[10px] text-slate-500">({product?.reference || 'S/Ref'})</span></span>
                            </div>
                            <div>
                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Cor / Grade</span>
                              <span className="font-bold text-xs">{variation?.colorName || 'Não cadastrada'}</span>
                            </div>
                            <div>
                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Pares Totais do Mapa</span>
                              <span className="font-bold text-xs text-sky-850">{lot.quantity} Pares</span>
                            </div>
                          </div>

                          {/* Consolidated materials required */}
                          <h4 className="text-xs font-black uppercase tracking-wider border-b border-black pb-1.5 mb-2 mt-6">Requisição Consolidada de Materiais</h4>
                          <table className="w-full border-collapse">
                            <thead>
                              <tr>
                                <th className="border border-black p-2 text-left text-[10px] uppercase font-black bg-slate-50">Código / Nome do Material</th>
                                <th className="border border-black p-2 text-left text-[10px] uppercase font-black bg-slate-50">Referência</th>
                                <th className="border border-black p-2 text-right text-[10px] uppercase font-black bg-slate-100">Consumo Total Estimado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.values(materialsSummary).map((m, idx) => (
                                <tr key={idx}>
                                  <td className="border border-black p-2 text-left font-bold text-[11px]">{m.name}</td>
                                  <td className="border border-black p-2 text-left text-[11px] text-slate-600">{m.ref}</td>
                                  <td className="border border-black p-2 text-right font-black text-[11px] text-sky-850 bg-slate-50">{m.consumption.toFixed(3)} {m.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Pairs Grid */}
                          <h4 className="text-xs font-black uppercase tracking-wider border-b border-black pb-1.5 mb-2 mt-8">Grade Detalhada do Mapa</h4>
                          <table className="w-full border-collapse">
                            <thead>
                              <tr>
                                <th className="border border-black p-2 text-left text-[10px] uppercase font-black bg-slate-100">Tamanho</th>
                                {Object.keys(lot.pairs || {}).map(sz => (
                                  <th key={sz} className="border border-black p-2 text-center text-[10px] uppercase font-black bg-slate-50">{sz}</th>
                                ))}
                                <th className="border border-black p-2 text-center text-[10px] uppercase font-black bg-slate-200">TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border border-black p-2 text-left font-black text-[11px]">Pares</td>
                                {Object.values(lot.pairs || {}).map((val, idx) => (
                                  <td key={idx} className="border border-black p-2 text-center font-black text-[11px]">{val}</td>
                                ))}
                                <td className="border border-black p-2 text-center font-black text-[11px] bg-slate-50">{lot.quantity}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Extra bottom info */}
                        <div className="text-center pt-8 border-t border-slate-100">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Página 1 de 2 • Informações Consolidadas e Logística</span>
                        </div>
                      </div>

                      {/* Part B: Padrão de Corte & Assinaturas */}
                      <div className="w-full max-w-[21cm] bg-white border border-slate-200 dark:border-slate-800 text-black shadow-lg p-10 font-sans min-h-[29.7cm] flex flex-col justify-between rounded-lg relative overflow-hidden shrink-0">
                        {/* Document Watermark */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none opacity-[0.03]">
                          <Scissors size={350} className="text-black transform -rotate-12" />
                        </div>

                        <div>
                          {/* Title Bar */}
                          <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                            <div>
                              <h1 className="margin-none text-2xl font-black uppercase tracking-tight">GESTÃO PRO</h1>
                              <p className="margin-none text-[8px] font-black tracking-widest text-slate-500 uppercase">Sistema de Produção & PCP</p>
                            </div>
                            <div className="text-right">
                              <span className="px-2 py-0.5 border border-black bg-sky-100 text-black text-[9px] font-black tracking-widest uppercase rounded">
                                Ficha Técnica - Padrão de Corte
                              </span>
                              <p className="text-xs font-black mt-2 text-slate-500">Lote: #{lot.orderNumber} • Emissão: {formattedDate}</p>
                            </div>
                          </div>

                          {/* Details grid */}
                          <div className="grid grid-cols-3 gap-4 mb-6">
                            <div>
                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Referência / Modelo</span>
                              <span className="font-bold text-xs">{product?.name || 'Não cadastrado'} <span className="text-[10px] text-slate-500">({product?.reference || 'S/Ref'})</span></span>
                            </div>
                            <div>
                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Cor / Grade</span>
                              <span className="font-bold text-xs">{variation?.colorName || 'Não cadastrada'}</span>
                            </div>
                            <div>
                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Pares Totais do Mapa</span>
                              <span className="font-bold text-xs text-sky-800">{lot.quantity} Pares</span>
                            </div>
                          </div>

                          {/* Strikes breakdown table */}
                          <h4 className="text-xs font-black uppercase tracking-wider border-b border-black pb-1.5 mb-2 mt-8">Padrão de Facadas / Batidas por Peça e Tamanho</h4>
                          <p className="text-[9px] text-slate-500 italic mb-2 mt-1">* As batidas mostram exatamente quantos golpes o cortador precisa dar para cada grade com base nas camadas.</p>
                          <table className="w-full border-collapse">
                            <thead>
                              <tr>
                                <th className="border border-black p-2 text-left text-[9px] uppercase font-black bg-slate-50">Peça / Faca</th>
                                <th className="border border-black p-2 text-left text-[9px] uppercase font-black bg-slate-50">Material</th>
                                <th className="border border-black p-2 text-center text-[9px] uppercase font-black bg-slate-100">Conj.</th>
                                <th className="border border-black p-2 text-center text-[9px] uppercase font-black bg-slate-100">Infesto</th>
                                {Object.keys(lot.pairs || {}).map(sz => (
                                  <th key={sz} className="border border-black p-1 text-center text-[8px] uppercase font-black bg-slate-50">T{sz}</th>
                                ))}
                                <th className="border border-black p-2 text-center text-[9px] uppercase font-black bg-slate-200">Batidas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pieces.map((item, idx) => {
                                const conjugation = item.tool?.metadata?.conjugation || 1;
                                const layers = item.layers;
                                let totalStrikes = 0;

                                return (
                                  <tr key={idx}>
                                    <td className="border border-black p-2 text-left">
                                      <div className="font-black text-[10px]">{item.piece.name}</div>
                                      <div className="text-[7.5px] text-slate-500 mt-0.5">Faca: {item.tool?.name || 'S/Ref'}</div>
                                    </td>
                                    <td className="border border-black p-2 text-left">
                                      <div className="font-bold text-[10px]">{item.material?.name || 'Manual'}</div>
                                      <div className="text-[7.5px] text-slate-500 mt-0.5">Ref: {item.material?.metadata?.reference || 'S/Ref'}</div>
                                    </td>
                                    <td className="border border-black p-2 text-center font-black text-[10px]">{conjugation}x</td>
                                    <td className="border border-black p-2 text-center font-black text-[10px] text-indigo-700">{layers} c.</td>
                                    {Object.entries(lot.pairs || {}).map(([size, qty]) => {
                                      const strokesNeeded = Math.ceil(qty / (conjugation * layers));
                                      totalStrikes += strokesNeeded;
                                      return (
                                        <td key={size} className={`border border-black p-1 text-center text-[10px] ${strokesNeeded > 0 ? 'font-black text-black' : 'text-slate-300'}`}>
                                          {strokesNeeded || '-'}
                                        </td>
                                      );
                                    })}
                                    <td className="border border-black p-2 text-center font-black text-xs text-sky-855 bg-slate-50">{totalStrikes}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Footer signatures */}
                        <div className="flex justify-between gap-10 mt-12 pt-8">
                          <div className="flex-1 text-center border-t border-black pt-2">
                            <span className="font-bold text-[10px] block">{providerName}</span>
                            <span className="text-[7.5px] font-black text-slate-455 uppercase tracking-widest">Assinatura do Cortador</span>
                          </div>
                          <div className="flex-1 text-center border-t border-black pt-2">
                            <span className="font-bold text-[10px] block">Supervisão de Produção</span>
                            <span className="text-[7.5px] font-black text-slate-455 uppercase tracking-widest">Assinatura de Controle</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Modal Actions Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-slate-500">
                    * Pronto para impressão em papel tamanho A4
                  </span>
                  
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPrintModalData(null)}
                      className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${
                        isDarkMode 
                          ? 'bg-slate-900 border-slate-850 text-slate-350 hover:bg-slate-800 hover:text-white' 
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      Fechar Visualização
                    </button>

                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/35 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <Printer size={14} /> Imprimir Agora
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Etiqueta Térmica — editor completo de etiquetas para o produto do lote */}
      {labelModalOpen && lotProductDetails?.product && (
        <PrintLabelEditorModal
          isOpen={labelModalOpen}
          onClose={() => setLabelModalOpen(false)}
          product={lotProductDetails.product}
          isDarkMode={isDarkMode}
        />
      )}

      {/* ── QR Baixa Modal — Setor de Corte ──────────────────────────── */}
      {qrBaixaOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className={`w-full max-w-sm rounded-[2rem] border shadow-2xl flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>

            {/* Header */}
            <div className={`flex items-center justify-between px-6 pt-6 pb-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <QrCode size={20} className="text-violet-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Baixa por QR Code</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Setor de Corte</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                title="Fechar"
                onClick={() => { setQrBaixaOpen(false); setQrBaixaConfirm(null); setQrBaixaManualCode(''); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5 p-6">

              {/* Active OS info pill */}
              {activeOSForSelectedLot && !qrBaixaConfirm && (
                <div className={`p-4 rounded-2xl border flex flex-col gap-1 ${isDarkMode ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-100'}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">OS Ativa no Mapa Selecionado</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{activeOSForSelectedLot.osNumber}</span>
                  <span className="text-[10px] font-bold text-slate-400">{activeOSForSelectedLot.providerName} • R$ {activeOSForSelectedLot.totalValue.toFixed(2)}</span>
                </div>
              )}

              {/* Confirmation panel */}
              {qrBaixaConfirm ? (
                <div className="flex flex-col gap-4">
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckSquare size={16} className="text-emerald-500" />
                      <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Confirmar Baixa</span>
                    </div>
                    <div className="flex flex-col gap-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">OS</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400">{qrBaixaConfirm.os.osNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Cortador</span>
                        <span className="font-black text-slate-800 dark:text-slate-200">{qrBaixaConfirm.os.providerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Próximo Setor</span>
                        <span className={`font-black ${qrBaixaConfirm.nextSectorName === 'CONCLUÍDO' ? 'text-emerald-500' : 'text-violet-600 dark:text-violet-400'}`}>
                          {qrBaixaConfirm.nextSectorName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Valor</span>
                        <span className="font-black text-rose-500">R$ {qrBaixaConfirm.os.totalValue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setQrBaixaConfirm(null)}
                      className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const os = qrBaixaConfirm.os;
                        setQrBaixaOpen(false);
                        setQrBaixaConfirm(null);
                        setQrBaixaManualCode('');
                        await handleCompleteOSCutting(os);
                      }}
                      className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckSquare size={14} /> Confirmar Baixa
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Camera scan button */}
                  <button
                    type="button"
                    disabled={qrBaixaScanning}
                    onClick={async () => {
                      setQrBaixaScanning(true);
                      try {
                        if (activeOSForSelectedLot) {
                          // OS already known — go straight to confirm
                          handleQrBaixaResolve(`OS|${activeOSForSelectedLot.id}`);
                        } else {
                          const raw = await scannerService.scan();
                          if (raw) handleQrBaixaResolve(raw);
                        }
                      } finally {
                        setQrBaixaScanning(false);
                      }
                    }}
                    className={`w-full flex flex-col items-center justify-center gap-3 py-8 rounded-2xl border-2 border-dashed transition-all ${
                      qrBaixaScanning
                        ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/20 animate-pulse'
                        : isDarkMode
                          ? 'border-violet-700/50 bg-violet-950/10 hover:bg-violet-950/25 text-violet-400'
                          : 'border-violet-200 bg-violet-50/50 hover:bg-violet-50 text-violet-600'
                    }`}
                  >
                    <ScanLine size={40} className={qrBaixaScanning ? 'animate-bounce' : ''} />
                    <div className="text-center">
                      <p className="text-sm font-black uppercase tracking-widest">
                        {qrBaixaScanning ? 'Abrindo câmera...' : activeOSForSelectedLot ? 'Confirmar OS Ativa' : 'Escanear QR Code da OS'}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                        {activeOSForSelectedLot ? 'Toque para ver detalhes e confirmar a baixa' : 'Toque para abrir a câmera'}
                      </p>
                    </div>
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">ou digitar manualmente</span>
                    <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                  </div>

                  {/* Manual input */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={qrBaixaManualCode}
                        onChange={e => setQrBaixaManualCode(e.target.value.toUpperCase())}
                        onKeyDown={e => { if (e.key === 'Enter' && qrBaixaManualCode.trim()) handleQrBaixaResolve(qrBaixaManualCode); }}
                        placeholder="Ex: OS-C-1895"
                        className={`w-full pl-8 pr-3 py-3 rounded-2xl text-xs font-black uppercase tracking-widest outline-none border-2 transition-colors ${
                          isDarkMode
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-violet-500 placeholder:text-slate-700'
                            : 'bg-white border-slate-200 text-slate-900 focus:border-violet-500 placeholder:text-slate-300'
                        }`}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!qrBaixaManualCode.trim()}
                      onClick={() => handleQrBaixaResolve(qrBaixaManualCode)}
                      className="px-4 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 shrink-0"
                    >
                      Buscar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const fs = require('fs');

const file = 'c:\\Users\\SISTEMAS-PC\\Desktop\\PROJETOS ANTIGRAVIT\\APP VENDAS E PRODUCAO\\src\\views\\PCPView.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /  const handleCompleteOS = async \(os: ServiceOrder\) => \{[\s\S]*?  const handleQrBaixaResolve = \(raw: string\) => \{/;
const match = content.match(regex);
if (!match) throw new Error("Could not find handleCompleteOS block");

const replacement = `  const handleCompleteOS = async (os: ServiceOrder) => {
    if (!confirm(\`Deseja concluir a Ordem de Serviço \${os.osNumber}?\`)) return;
    try {
      const lotIds = os.lotIds || (os.lotId ? [os.lotId] : []);
      if (lotIds.length === 0) { toast.show('OS sem mapa vinculado.'); return; }

      const involvedLots = lotIds.map(id => lots.find(l => l.id === id)).filter(Boolean) as ProductionLot[];
      if (involvedLots.length === 0) { toast.show('Mapa(s) não encontrado(s).'); return; }

      const sectorId = os.sectorId || (involvedLots[0].route?.[involvedLots[0].currentSectorIndex] ?? '');

      // 1. Mark OS as completed
      await firebaseService.updateDocument('serviceOrders', os.id, {
        status: 'COMPLETED',
        finishedAt: Date.now(),
      });

      // 2. Settle transaction if present
      if (os.transactionId) {
        try { await financeService.settleTransaction(os.transactionId); } catch { /* ignore */ }
      }

      const currentSectorObj = sectors.find(s => s.id === sectorId);
      const isCycleEndSector = !!currentSectorObj?.isProductionCycleEnd;

      const lotsToAdvance: ProductionLot[] = [];
      const feedbackMessages: string[] = [];

      for (const lotObj of involvedLots) {
        // Se Expedição
        if (isCycleEndSector && os.sourceOrderIds && os.sourceOrderIds.length > 0) {
          // Filtrar os orders que pertencem a ESTE mapa
          const lotOrderIds = os.sourceOrderIds.filter(oid => {
             const si = (lotObj as any).metadata?.sourceItems || [];
             return si.some((s: any) => s.orderId === oid);
          });
          
          if (lotOrderIds.length > 0) {
            const { customerItems, stockItems } = classifyExpedicaoOrders(lotOrderIds.map(orderId => ({ orderId })));
            await applyExpedicaoStockUpdate(lotObj, stockItems, customerItems);

            const currentOrderSectors: Record<string, string> = (lotObj as any).metadata?.orderSectors || {};
            const updatedOrderSectors = { ...currentOrderSectors };
            lotOrderIds.forEach(oid => { updatedOrderSectors[oid] = ORDER_FINALIZED; });

            const allSI: any[] = (lotObj as any).metadata?.sourceItems
              || [{ orderId: lotObj.productionOrderId, itemIdx: 0, qty: lotObj.quantity }];
            const lotObjWithUpdatedSectors = { ...lotObj, metadata: { ...(lotObj as any).metadata, orderSectors: updatedOrderSectors } };
            const allFinalized = allSI.every((si: any) =>
              getOrderEffectiveSector(lotObjWithUpdatedSectors, si.orderId, si) === ORDER_FINALIZED
            );

            if (allFinalized) {
              await onSaveLot({
                ...lotObj,
                finishedAt: Date.now(),
                metadata: { ...(lotObj as any).metadata, orderSectors: updatedOrderSectors },
                history: [...(lotObj.history || []), {
                  sectorId, statusId: '', timestamp: Date.now(),
                  userName: userName || 'Usuário', notes: \`Mapa finalizado via OS \${os.osNumber}.\`,
                }],
              });
              feedbackMessages.push(\`MAPA\${lotObj.orderNumber}: Mapa finalizado!\`);
            } else {
              await firebaseService.updateDocument('productionLots', lotObj.id, {
                metadata: { ...(lotObj as any).metadata, orderSectors: updatedOrderSectors },
              });
              feedbackMessages.push(\`MAPA\${lotObj.orderNumber}: Pedido(s) baixado(s), demais continuam em Expedição.\`);
            }
          }
          continue; // Pula a checagem de avanço normal
        }

        // 3. Count remaining PENDING OS for THIS lot in this sector
        const otherPendingOS = serviceOrders.filter(o =>
          o.id !== os.id &&
          o.status === 'PENDING' &&
          o.sectorId === sectorId &&
          (o.lotId === lotObj.id || (o.lotIds?.includes(lotObj.id) ?? false))
        );

        if (otherPendingOS.length > 0) {
           feedbackMessages.push(\`MAPA\${lotObj.orderNumber}: Ainda \${otherPendingOS.length} OS pendente(s).\`);
        } else {
           lotsToAdvance.push(lotObj);
        }
      }

      if (isCycleEndSector && os.sourceOrderIds && os.sourceOrderIds.length > 0) {
         toast.show('Baixa de Expedição registrada:\\n' + feedbackMessages.join('\\n'));
         setIsDetailModalOpen(false);
         setSelectedLot(null);
      } else {
        if (feedbackMessages.length > 0 && lotsToAdvance.length === 0) {
           toast.show(feedbackMessages.join('\\n'));
           setIsDetailModalOpen(false);
           setSelectedLot(null);
        } else if (lotsToAdvance.length > 0) {
           // Queue the advance for all completed lots
           queueLotAdvanceConfirms(lotsToAdvance.map(lot => ({
             lot,
             nextStatusId: lot.currentStatusId || '',
             notes: \`Baixa via OS \${os.osNumber} concluída.\`
           })));
        }
      }
    } catch (e) {
      console.error(e);
      toast.show('Erro ao concluir OS: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleQrBaixaResolve = (raw: string) => {`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log("Updated handleCompleteOS successfully.");

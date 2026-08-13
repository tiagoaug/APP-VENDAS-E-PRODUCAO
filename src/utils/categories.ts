import { AppModulesConfig, Category } from '../types';

export type CategoryModuleValue = keyof AppModulesConfig | 'any';

// Categoria.module aceita tanto o formato antigo (um único módulo, ex.: 'sales')
// quanto o novo (array de módulos selecionados, ex.: ['sales', 'personal']) — categorias
// já salvas antes do multi-select continuam funcionando sem precisar de migração de dados.
export function getCategoryModules(module: Category['module']): CategoryModuleValue[] {
  if (!module) return [];
  return Array.isArray(module) ? module : [module];
}

export function categoryModulesInclude(module: Category['module'], config: AppModulesConfig): boolean {
  const modules = getCategoryModules(module);
  if (modules.includes('any')) return true;
  return modules.some(m => config[m as keyof AppModulesConfig]);
}

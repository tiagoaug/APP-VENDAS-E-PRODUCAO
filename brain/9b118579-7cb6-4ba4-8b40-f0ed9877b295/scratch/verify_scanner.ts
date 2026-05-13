
import { scannerService } from '../../src/services/scannerService';

console.log('Testing PRODUCT parsing:');
const productResult = scannerService.parseScanResult('PRD|prod123|var456|42');
console.log(productResult);

console.log('\nTesting LOT parsing:');
const lotResult = scannerService.parseScanResult('LOT|lot789');
console.log(lotResult);

console.log('\nTesting INVALID parsing:');
const invalidResult = scannerService.parseScanResult('INVALID|data');
console.log(invalidResult);

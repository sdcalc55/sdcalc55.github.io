import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMortgage } from '../lib/mortgage.ts';

const cases = [
 ['part',['6 000 000','20,1'],1206000], ['whole',['700 000','20,1'],3482588], ['adjustment',['5 000 000','600 000','20,1'],5440697],
 ['part',['1001','0,1'],2], ['part',['20.1','100'],21], ['part',['0','20,1'],0], ['part',['100','0'],0],
 ['part',['100','100'],100],
 ['whole',['100','3'],3334], ['whole',['20,1','20,1'],100], ['whole',['0','20,1'],0], ['whole',['700000','100'],700000],
 ['adjustment',['5000000','0','20'],6250000],
 ['adjustment',['5000000','600000','100'],41666667],
];
for (const [mode,values,expected] of cases) test(`Ипотека ${mode}: ${values.join(' / ')}`,()=>{
 const result=calculateMortgage(mode,values);assert.equal(result.status,'ok');assert.equal(result.total,expected);
});
for (const [mode,values] of [
 ['part',['','20']], ['whole',['100','']], ['adjustment',['100','10','']], ['adjustment',['100']], ['part',['-','2']],
]) test(`Пустые поля ${mode}/${values}`,()=>assert.equal(calculateMortgage(mode,values).status,'empty'));
for (const [mode,values] of [
 ['part',['abc','20']], ['part',['100','125']], ['whole',['100','0']], ['whole',['100','0,00']], ['whole',['100','-3']], ['part',['1e6','20']], ['part',['Infinity','20']],
 ['adjustment',['0','0','20']], ['adjustment',['-1','0','20']], ['adjustment',['100','-1','20']],
 ['adjustment',['100','0','-1']], ['adjustment',['100','0','101']], ['adjustment',['100','0','100']], ['adjustment',['5000000','0','0']], ['adjustment',['5000000','600000','0']], ['adjustment',['100','200','20']],
 ['part',['-100','20']], ['part',['-0.01','20']],
 ['whole',['-100','20']], ['whole',['-0.01','20']],
 ['part',['9007199254740991','10000']], ['part',['1'.repeat(101),'20']],
]) test(`Некорректная ипотека ${mode}/${values}`,()=>assert.equal(calculateMortgage(mode,values).status,'error'));
test('Не округлять проценты до вычисления корректировки',()=>{
 const result=calculateMortgage('adjustment',['3000000','123456,78','20,1']);
 assert.equal(result.status,'ok');assert.equal(result.total,3570782);
 assert.equal(result.clientPercent,4.115226);assert.equal(result.missingPercent,15.984774);
});
for (const values of [
 ['100','50','20'], ['5000000','1000000','20'],
 ['100','20,1000000001','20,1'],
]) test(`Достаточно ПВ: ${values.join(' / ')}`,()=>{
 const result=calculateMortgage('adjustment',values);
 assert.equal(result.status,'sufficient');
 assert.equal(result.clientPercent,Number(values[1].replace(',','.')) / Number(values[0]) * 100);
});
test('Чуть ниже точного порога ПВ продолжает рассчитывать корректировку',()=>{
 const result=calculateMortgage('adjustment',['100','20,0999999999','20,1']);
 assert.equal(result.status,'ok'); assert.equal(result.total,101);
});

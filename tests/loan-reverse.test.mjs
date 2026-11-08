import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLoan, calculateLoanFromPayment } from '../lib/loan.ts';

test('Обратный расчёт: платёж 40 000, 15 лет, 18%',()=>{
 const r=calculateLoanFromPayment(40000,180,18);
 const monthlyRate=0.18/12;
 const reference=40000*(1-Math.pow(1+monthlyRate,-180))/monthlyRate;
 assert(Math.abs(r.principal-reference)<0.011);
 assert(r.monthlyPayment<=40000+1e-8);
 assert(calculateLoan(Math.round((r.principal+0.01)*100)/100,180,18).monthlyPayment>40000);
 assert.equal(r.totalPayment,Math.round(r.monthlyPayment*180*100)/100);
 assert.equal(r.interest,Math.round((r.totalPayment-r.principal)*100)/100);
});
test('Нулевая ставка обратного расчёта сохраняет копейки',()=>{
 for(const payment of [0.01,0.29,40.13,40000])for(const months of [1,3,180,360]){
 const r=calculateLoanFromPayment(payment,months,0);
 assert.equal(r.principal,Math.round(payment*100)*months/100);
 assert.equal(r.interest,0);
 assert.equal(r.totalPayment,r.principal);
 }
});
test('Обратный расчёт согласован с прямым, в том числе при малой ставке',()=>{
 for(const payment of [100,9999.99,40000])for(const months of [1,12,180,360])for(const rate of [0.000001,5,18,30]){
 const r=calculateLoanFromPayment(payment,months,rate);
 const direct=calculateLoan(r.principal,months,rate);
 assert.deepEqual(r,direct);
 assert(r.monthlyPayment<=payment+1e-8);
 assert(r.monthlyPayment>payment-0.02);
 }
});
test('Обратный расчёт отклоняет ошибки и результаты вне точного диапазона',()=>{
 for(const values of [[0,180,18],[-1,180,18],[NaN,180,18],[Infinity,180,18],[0.001,180,18],[1.015,180,18],[40000,0,18],[40000,1.5,18],[40000,180,-1],[40000,180,Infinity],[Number.MAX_SAFE_INTEGER/100,360,0],[0.01,1,1e308]])assert.throws(()=>calculateLoanFromPayment(...values));
 assert.equal(calculateLoanFromPayment(40000,360,18).months,360);
 assert.throws(()=>calculateLoanFromPayment(40000,361,18),{message:'Срок кредита должен составлять не более 30 лет'});
});

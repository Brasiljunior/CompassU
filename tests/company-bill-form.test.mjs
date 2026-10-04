import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCompanyBill} from '../lib/companyBillForm.mjs';
const bill={vendor:'Vendor',description:'Hosting',category:'Technology',amount:'19.99',due_date:'2026-10-04'};
test('valid bills can proceed with or without a receipt',()=>{assert.equal(validateCompanyBill(bill),true);assert.equal(validateCompanyBill({...bill,receipt:'optional'}),true);});
test('missing fields get explicit feedback instead of silent browser validation',()=>{for(const [field,label]of [['vendor','Vendor'],['description','Bill description'],['category','Category']])assert.throws(()=>validateCompanyBill({...bill,[field]:' '}),new RegExp(label+' is required'));});
test('invalid totals and dates get actionable feedback',()=>{for(const amount of ['','0','19.999','-1'])assert.throws(()=>validateCompanyBill({...bill,amount}),/bill total/);assert.throws(()=>validateCompanyBill({...bill,due_date:''}),/due date/);});

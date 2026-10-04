import {cents,dateOnly} from './financeCore.mjs';
export function validatePayment(input,today,remaining){
 let amount;try{amount=cents(input.amount);}catch{throw new Error('Enter a payment amount greater than zero with no more than two decimal places.');}
 if(amount>remaining)throw new Error('Payment amount exceeds the remaining balance.');
 let date;try{date=dateOnly(input.paid_on);}catch{throw new Error('Choose a valid payment date.');}
 if(date>today)throw new Error('Payment date cannot be in the future.');
 const reference=String(input.reference||'').trim();
 if(input.kind==='invoice'&&!reference)throw new Error('Enter a bank or payment reference for this invoice payment.');
 if(reference.length>160)throw new Error('Payment reference must be 160 characters or fewer.');
 return true;
}

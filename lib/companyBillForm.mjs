import {cents,dateOnly} from './financeCore.mjs';
export function validateCompanyBill(input){
 for(const [field,label,max]of [['vendor','Vendor',160],['description','Bill description',500],['category','Category',100]]){const value=String(input[field]||'').trim();if(!value)throw new Error(label+' is required.');if(value.length>max)throw new Error(label+' must be '+max+' characters or fewer.');}
 try{cents(input.amount);}catch{throw new Error('Enter a bill total greater than zero with no more than two decimal places.');}
 try{dateOnly(input.due_date);}catch{throw new Error('Choose a valid due date.');}
 return true;
}

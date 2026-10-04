export const RECEIPT_MAX_BYTES=3*1024*1024;
export function receiptFileName(name,extension){const stem=String(name||'receipt').replace(/\.[^.]*$/,'').replace(/[^a-zA-Z0-9 _.-]/g,'_').replace(/^\.+/,'').trim().slice(0,140)||'receipt';return stem+'.'+extension;}
export async function validateReceipt(file){
 if(!file||typeof file.arrayBuffer!=='function'||!file.size)throw new Error('Choose a receipt file.');
 if(file.size>RECEIPT_MAX_BYTES)throw new Error('Receipts must be 3 MB or smaller.');
 const buffer=Buffer.from(await file.arrayBuffer());
 let mime,extension;
 if(buffer.subarray(0,5).toString()==='%PDF-'){mime='application/pdf';extension='pdf';}
 else if(buffer.length>=3&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255){mime='image/jpeg';extension='jpg';}
 else if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){mime='image/png';extension='png';}
 else if(buffer.length>=12&&buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP'){mime='image/webp';extension='webp';}
 else throw new Error('Use a PDF, JPG, PNG, or WebP receipt.');
 if(file.type&&file.type!=='application/octet-stream'&&file.type!==mime)throw new Error('The receipt contents do not match its file type.');
 return {buffer,mime,extension,name:receiptFileName(file.name,extension),size:buffer.length};
}

'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import Link from 'next/link';
export default function AdminFinanceLauncher(){const[target,setTarget]=useState(null);useEffect(()=>{const sync=()=>{const role=document.querySelector('.adminRole');const actions=document.querySelector('.adminTopActions');setTarget(role?.textContent?.includes('Master Administrator')?actions:null)};sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();},[]);return target?createPortal(<Link href="/admin/finance" className="btn primary" style={{textDecoration:'none'}}>Finance & Billing</Link>,target):null;}

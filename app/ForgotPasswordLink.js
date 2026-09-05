'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ForgotPasswordLink(){
  const[target,setTarget]=useState(null);

  useEffect(()=>{
    const locate=()=>{
      const panel=[...document.querySelectorAll('.panel')].find(node=>node.querySelector('h2')?.textContent?.includes('Welcome back'));
      const passwordField=panel?.querySelector('input[type="password"]')?.closest('.field');
      setTarget(current=>current===passwordField?current:(passwordField||null));
    };
    locate();
    const observer=new MutationObserver(locate);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  if(!target)return null;
  return createPortal(
    <a href="/forgot-password" style={{display:'block',marginTop:8,textAlign:'right',fontSize:13,fontWeight:700,color:'#2f6fed',textDecoration:'none'}}>Forgot password?</a>,
    target
  );
}

'use client';

import { useEffect } from 'react';

export default function AdminForgotPasswordLink(){
  useEffect(()=>{
    let link=null;

    const addLink=()=>{
      const card=document.querySelector('.adminLoginCard');
      if(!card||document.getElementById('compassu-admin-forgot-password'))return;

      const loginButton=[...card.querySelectorAll('button')].find(button=>button.textContent?.includes('Administrator Login')||button.textContent?.includes('Signing in'));
      if(!loginButton)return;

      link=document.createElement('a');
      link.id='compassu-admin-forgot-password';
      link.href='/forgot-password';
      link.textContent='Forgot password?';
      link.style.display='block';
      link.style.marginTop='12px';
      link.style.textAlign='center';
      link.style.fontSize='14px';
      link.style.fontWeight='700';
      link.style.textDecoration='none';
      link.style.color='inherit';
      link.style.opacity='0.82';
      loginButton.insertAdjacentElement('afterend',link);
    };

    addLink();
    const observer=new MutationObserver(addLink);
    observer.observe(document.body,{childList:true,subtree:true});

    return()=>{
      observer.disconnect();
      document.getElementById('compassu-admin-forgot-password')?.remove();
    };
  },[]);

  return null;
}

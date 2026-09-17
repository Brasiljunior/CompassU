'use client';

import { useEffect } from 'react';

export default function Admin50kConsoleRouter(){
  useEffect(()=>{
    // The reconciled admin-console Edge Function now contains the 50K
    // server-side pagination, filtering, aggregate, and bulk-operation logic.
    // Preserve requests to the deployed admin-console endpoint instead of
    // rewriting them to a separate function that is not part of this repo.
    return undefined;
  },[]);
  return null;
}

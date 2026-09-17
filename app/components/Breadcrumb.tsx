'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

/**
 * Ultimo tramo del breadcrumb del Topbar.
 *
 * La vista de resultados no es una ruta propia -es estado de AppShell-, asi que
 * el pathname no alcanza para saber donde esta parado el usuario. AppShell
 * publica aca el tramo extra y el Topbar lo lee.
 */
type Contexto = {
  detalle: string | null;
  setDetalle: (d: string | null) => void;
};

const BreadcrumbCtx = createContext<Contexto>({ detalle: null, setDetalle: () => {} });

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [detalle, setDetalle] = useState<string | null>(null);
  return (
    <BreadcrumbCtx.Provider value={{ detalle, setDetalle }}>
      {children}
    </BreadcrumbCtx.Provider>
  );
}

export const useBreadcrumb = () => useContext(BreadcrumbCtx);

"use client";

import * as React from "react";
import { markOfferViewed } from "./actions";

/**
 * Bilježi otvaranje ponude tek u pregledniku (JavaScript), da skeneri poveznica u poštanskim sustavima
 * (npr. Outlook Safe Links) ne bi lažno označili ponudu kao otvorenu.
 */
export function ViewPing({ token }: { token: string }) {
  React.useEffect(() => {
    const t = setTimeout(() => void markOfferViewed(token), 1500);
    return () => clearTimeout(t);
  }, [token]);
  return null;
}

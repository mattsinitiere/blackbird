"use client";

import { createContext, useContext, useState } from "react";

const PreviewContext = createContext({ panel: "scoring", setPanel: () => {} });

/** Which product-preview tab is open; the feature cards can switch it. */
export function PreviewProvider({ children }) {
  const [panel, setPanel] = useState("scoring");
  return <PreviewContext.Provider value={{ panel, setPanel }}>{children}</PreviewContext.Provider>;
}

export function usePreview() {
  return useContext(PreviewContext);
}

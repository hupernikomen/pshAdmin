import React, { createContext, useCallback, useContext, useState } from "react";

const AlertContext = createContext({});

export function AlertProvider({ children }) {
  const [config, setConfig] = useState(null);

  const hideAlert = useCallback(() => {
    setConfig(null);
  }, []);

  /**
   * showAlert({
   *   title,
   *   message,
   *   buttons: [{ text, onPress, style: 'default' | 'cancel' | 'destructive' }]
   * })
   */
  const showAlert = useCallback((opts = {}) => {
    const {
      title = "",
      message = "",
      buttons,
    } = opts;

    const lista =
      Array.isArray(buttons) && buttons.length
        ? buttons
        : [{ text: "OK", style: "default" }];

    setConfig({
      title,
      message,
      buttons: lista,
    });
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert, config }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAppAlert() {
  return useContext(AlertContext);
}

export default AlertProvider;
import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.me().then(setUser).catch(() => setToken("")).finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const { access_token } = await api.login(username, password);
    setToken(access_token);
    const me = await api.me();
    setUser(me);
    return me;
  };
  const logout = () => { setToken(""); setUser(null); };

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

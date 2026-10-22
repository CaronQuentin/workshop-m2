import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import "./index.css";
import { AuthProvider, useAuth } from "./auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import NewPayment from "./pages/NewPayment";
import History from "./pages/History";
import TransactionDetail from "./pages/TransactionDetail";
import Beneficiaries from "./pages/Beneficiaries";
import Profile from "./pages/Profile";
import Assistant from "./pages/Assistant";
import Status from "./pages/Status";
import BackOffice from "./pages/BackOffice";
import AdminOps from "./pages/AdminOps";
import AdminUsers from "./pages/AdminUsers";

function Protected({ adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-slate-400">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/status" element={<Status />} />
          <Route path="/backoffice" element={<BackOffice />} />
          <Route element={<Protected />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/payments/new" element={<NewPayment />} />
              <Route path="/history" element={<History />} />
              <Route path="/history/:ref" element={<TransactionDetail />} />
              <Route path="/beneficiaries" element={<Beneficiaries />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/profile" element={<Profile />} />
              <Route element={<Protected adminOnly />}>
                <Route path="/admin/ops" element={<AdminOps />} />
                <Route path="/admin/users" element={<AdminUsers />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);

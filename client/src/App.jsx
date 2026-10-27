import React from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import { GuestLayout, AuthLayout } from './pages/Layout'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import BuilderPage from './pages/BuilderPage'
import PreviewPage from './pages/PreviewPage'
import PricingPage from './pages/PricingPage'
import PublishPage from './pages/PublishPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AccountPage from './pages/AccountPage'
import { Toaster } from 'react-hot-toast'
import { useTheme } from './context/ThemeContext'

const App = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <>
      <Toaster
        toastOptions={{
          style: {
            background: isDark ? '#18181b' : '#ffffff',
            color: isDark ? '#f4f4f5' : '#09090b',
            border: isDark ? '1px solid #27272a' : '1px solid #e4e4e7',
          },
        }}
      />
      <Routes>
        {/* Login Routes */}
        <Route element={<GuestLayout />}>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
        </Route>

        {/* Protected Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/:tab" element={<AccountPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/builder/:id" element={<BuilderPage />} />
          <Route path="/preview/:id" element={<PreviewPage />} />
        </Route>

        {/* Public Routes */}
        <Route path="/publish/:id" element={<PublishPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Catch All Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App

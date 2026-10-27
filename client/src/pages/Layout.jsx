import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import Loading from '../components/Loading.jsx'
import EmailVerificationBanner from '../components/EmailVerificationBanner.jsx'

export function AuthLayout(){
  const {user, loadingUser} = useAppContext()

  if  (loadingUser) return <Loading />
  if (!user) return <Navigate to="/login" replace/>

  return (
    <>
      <EmailVerificationBanner />
      <Outlet />
    </>
  )
}

export function GuestLayout(){
  const {user, loadingUser} = useAppContext()

  if  (loadingUser) return <Loading />
  if (user) return <Navigate to="/" replace/>

  return <Outlet />
}

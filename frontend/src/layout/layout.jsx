import React from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'

const Layout = () => {
  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-base-100 to-base-200">
        <Outlet />
      </div>
    </div>
  )
}

export default Layout

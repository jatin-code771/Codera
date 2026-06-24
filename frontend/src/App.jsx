import React, { useEffect } from 'react'
import { Route, Routes, Navigate } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { Loader2 } from "lucide-react"
import Layout from "./layout/layout.jsx"
import HomePage from './page/HomePage'
import SignUpPage from './page/SignUpPage'
import LoginPage from './page/LoginPage'
import { useAuthStore } from './store/useAuthStore'
import AdminRoute from './components/AdminRoute.jsx'
import AddProblem from './page/AddProblem.jsx'
import ProblemPage from './page/ProblemPage.jsx'

const App = () => {
  const { authUser, isCheckingAuth, checkAuthUser } = useAuthStore();

  useEffect(() => {
    checkAuthUser();
  }, [checkAuthUser]);
 
  if (isCheckingAuth && !authUser) {
    return (
       <div className="flex items-center justify-center h-screen">
        <Loader2 className="size-10 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <Toaster />
      <Routes>
        <Route element={authUser ? <Layout /> : <Navigate to="/login" />}>
          <Route
            path='/'
            element={<HomePage/>}
          />
        </Route>
        
        <Route
          path='/login'
          element={!authUser ? <LoginPage /> : <Navigate to="/" />}
        />

        <Route
          path='/signup'
          element={!authUser ? <SignUpPage /> : <Navigate to="/" />}
        />
<Route 
path="/problem/:id"
element={authUser ? <ProblemPage /> : <Navigate to="/login" />}

/>

      <Route element={<AdminRoute/>}>

        <Route
        
        path='/add-problem'
        element={authUser ? <AddProblem/> : <Navigate to="/" />}
        
        />
      </Route>
      </Routes>
    </div>
  )
}

export default App

import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { ArkaProvider } from './context/ArkaContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ContentPipeline from './pages/ContentPipeline'
import PostLogger from './pages/PostLogger'
import Analytics from './pages/Analytics'
import OutboundPipeline from './pages/OutboundPipeline'
import InboundPipeline from './pages/InboundPipeline'
import LeadMagnetVault from './pages/LeadMagnetVault'
import TaskManager from './pages/TaskManager'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ArkaProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/content-pipeline" element={<ContentPipeline />} />
          <Route path="/posts" element={<PostLogger />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/outbound" element={<OutboundPipeline />} />
          <Route path="/inbound" element={<InboundPipeline />} />
          <Route path="/lead-magnets" element={<LeadMagnetVault />} />
          <Route path="/tasks" element={<TaskManager />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </ArkaProvider>
  )
}

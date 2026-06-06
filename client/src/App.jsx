import { Navigate, Route, Routes } from 'react-router-dom'
import HomeView from './views/HomeView'
import GroupView from './views/GroupView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeView />} />
      <Route path="/group/:gid" element={<GroupView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

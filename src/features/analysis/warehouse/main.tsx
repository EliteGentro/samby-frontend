import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WarehousePage from './WarehousePage'
import './warehouse.css'

createRoot(document.getElementById('root')!).render(<StrictMode><WarehousePage /></StrictMode>)
